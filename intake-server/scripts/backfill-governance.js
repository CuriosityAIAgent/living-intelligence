/**
 * backfill-governance.js
 *
 * One-time script: runs governance verification on all existing intelligence
 * entries that don't yet have a _governance audit block.
 *
 * Usage:
 *   node --env-file=../.env scripts/backfill-governance.js
 *
 * What it does:
 *   - Reads every *.json in data/intelligence/
 *   - Skips entries that already have _governance
 *   - Re-fetches each source URL via Jina (with paywall fallback)
 *   - Runs Claude governance verification
 *   - Writes _governance + updated source_verified back into the file
 *   - Prints a summary table at the end
 *
 * What it does NOT do:
 *   - Does not change headline, summary, key_stat, or any other field
 *   - Does not delete or unpublish entries
 *   - Does not commit to git (you review first, then commit manually)
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'living-intelligence', 'data', 'intelligence');
const client = new Anthropic();

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function log(icon, msg) { console.log(`${icon}  ${msg}`); }

const PAYWALLED_DOMAINS = new Set([
  'ft.com', 'wsj.com', 'bloomberg.com', 'barrons.com',
  'economist.com', 'hbr.org', 'morningstar.com',
]);

// ── Jina fetch with paywall fallback (mirrors intake.js logic) ────────────────

async function fetchWithFallback(url) {
  const jinaHeaders = {
    'Accept': 'text/markdown',
    'X-Return-Format': 'markdown',
    ...(process.env.JINA_API_KEY ? { 'Authorization': `Bearer ${process.env.JINA_API_KEY}` } : {}),
  };

  // Primary fetch
  let primary = null;
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: jinaHeaders,
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const md = await res.text();
      if (md.length >= 200) primary = md;
    }
  } catch (_) {}

  if (!primary) {
    return { markdown: null, paywall: true, fallback_sources: [] };
  }

  const paywallSignals =
    primary.includes('Subscribe to continue') ||
    primary.includes('Sign in to read') ||
    primary.includes('Create a free account') ||
    primary.includes('[Click here to read more]') ||
    primary.toLowerCase().includes('paywall');

  if (!paywallSignals) {
    return { markdown: primary, paywall: false, fallback_sources: [] };
  }

  // Paywall detected — search for alternative coverage
  if (!process.env.JINA_API_KEY) {
    return { markdown: primary, paywall: true, fallback_sources: [] };
  }

  // Build search query from URL slug
  let slug = '';
  try {
    slug = new URL(url).pathname
      .replace(/[^a-z0-9\s-]/gi, ' ').replace(/-/g, ' ').trim();
  } catch (_) {}
  const stopWords = new Set(['the','a','an','and','or','in','of','to','for','with',
    'on','at','by','from','is','are','was','be','its','this','that','html','www','com']);
  const queryWords = `${slug} ${primary.slice(0, 200)}`
    .toLowerCase().split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 8);
  const query = queryWords.join(' ');

  let altUrls = [];
  try {
    const searchRes = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${process.env.JINA_API_KEY}` },
      signal: AbortSignal.timeout(20000),
    });
    if (searchRes.ok) {
      const data = await searchRes.json();
      const originalHost = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; } })();
      altUrls = (data.data || [])
        .filter(r => {
          if (!r.url) return false;
          let h = ''; try { h = new URL(r.url).hostname.replace(/^www\./, ''); } catch (_) { return false; }
          return h !== originalHost && !PAYWALLED_DOMAINS.has(h);
        })
        .map(r => r.url)
        .slice(0, 4);
    }
  } catch (_) {}

  // Fetch alternatives, take first 2 that are usable
  const usable = [];
  for (const altUrl of altUrls) {
    if (usable.length >= 2) break;
    try {
      const res = await fetch(`https://r.jina.ai/${altUrl}`, {
        headers: jinaHeaders,
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const md = await res.text();
      if (md.length < 200) continue;
      const alsoPaywalled = md.includes('Subscribe to continue') || md.includes('Sign in to read');
      if (alsoPaywalled) continue;
      usable.push({ url: altUrl, markdown: md });
    } catch (_) {}
    await sleep(500); // be gentle between fallback fetches
  }

  if (usable.length === 0) {
    return { markdown: primary, paywall: true, fallback_sources: [] };
  }

  const combined = [
    `<!-- Original (paywalled): ${url} -->\n${primary.slice(0, 800)}`,
    ...usable.map(s => `<!-- Alternative: ${s.url} -->\n${s.markdown.slice(0, 3500)}`),
  ].join('\n\n---\n\n');

  return { markdown: combined, paywall: true, fallback_sources: usable.map(s => s.url) };
}

// ── Governance verification (mirrors governance.js logic) ─────────────────────

async function runGovernance(entry, markdown) {
  const prompt = `You are a fact-checking agent for an AI in wealth management publication.

Your job: verify that every factual claim in the GENERATED ENTRY is supported by the SOURCE ARTICLE.

GENERATED ENTRY (what we plan to publish):
---
Headline: ${entry.headline}
Summary: ${entry.summary}
Key stat: ${entry.key_stat ? `${entry.key_stat.number} — ${entry.key_stat.label}` : 'none'}
---

SOURCE ARTICLE (ground truth):
---
${markdown.slice(0, 6000)}
---

Verify each claim in the generated entry against the source article.

Return a JSON object in this exact format:
{
  "verdict": "PASS" | "REVIEW" | "FAIL",
  "confidence": 0-100,
  "verified_claims": ["list of claims that are clearly supported by the source"],
  "unverified_claims": ["list of claims that could not be found in or clearly inferred from the source"],
  "fabricated_claims": ["list of claims that appear to contradict the source or cannot exist in it"],
  "notes": "Brief explanation of your verdict",
  "paywall_caveat": true | false
}

Verdict rules:
- PASS: All claims are verifiable in the source. Minor paraphrasing is fine. No fabrications.
- REVIEW: 1-2 claims could not be verified (may be implied but not explicit). No fabrications.
- FAIL: Any claim contradicts the source, OR any specific number/name/statistic appears to be fabricated.
- If paywall_caveat is true (insufficient source content), give REVIEW even if other signals look fine.

Return only valid JSON. No explanation outside the JSON.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in governance response');
  return JSON.parse(jsonMatch[0]);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).sort();

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║     Living Intelligence — Governance Backfill        ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`  Found ${files.length} entries in data/intelligence/\n`);

  const results = [];
  let skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filepath = join(DATA_DIR, file);
    const entry = JSON.parse(readFileSync(filepath, 'utf-8'));

    // Skip if already has governance audit
    if (entry._governance) {
      log('⏭ ', `[${i + 1}/${files.length}] SKIP (already audited): ${entry.id}`);
      skipped++;
      continue;
    }

    log('🔍', `[${i + 1}/${files.length}] Processing: ${entry.id}`);
    log('   ', `Source: ${entry.source_url}`);

    const result = { id: entry.id, file, verdict: null, fallback: false, error: null };

    try {
      // Fetch content (with paywall fallback)
      const { markdown, paywall, fallback_sources } = await fetchWithFallback(entry.source_url);
      result.fallback = fallback_sources.length > 0;

      if (!markdown) {
        log('⚠️ ', `  Could not fetch content — skipping governance, marking REVIEW`);
        result.verdict = 'REVIEW (fetch failed)';

        entry._governance = {
          verdict: 'REVIEW',
          confidence: 0,
          verified_claims: [],
          unverified_claims: ['Could not fetch source content for verification'],
          fabricated_claims: [],
          notes: 'Backfill: source URL could not be fetched',
          paywall_caveat: true,
          verified_at: new Date().toISOString(),
          human_approved: false,
          approved_at: null,
          backfill: true,
        };
        entry.source_verified = false;
      } else {
        if (paywall && result.fallback) {
          log('🔄 ', `  Paywall detected — using ${fallback_sources.length} alternative source(s)`);
        } else if (paywall) {
          log('⚠️ ', `  Paywall detected — no alternatives found, using partial content`);
        }

        // Run governance
        const gov = await runGovernance(entry, markdown);
        result.verdict = gov.verdict;

        const verdictIcon = gov.verdict === 'PASS' ? '✅' : gov.verdict === 'REVIEW' ? '🟡' : '❌';
        log(verdictIcon, `  ${gov.verdict} (confidence: ${gov.confidence}) — ${gov.notes?.slice(0, 80) || ''}`);
        if (gov.unverified_claims?.length > 0) {
          log('   ', `  Unverified: ${gov.unverified_claims.slice(0, 2).join('; ')}`);
        }
        if (gov.fabricated_claims?.length > 0) {
          log('🚨 ', `  FABRICATED: ${gov.fabricated_claims.join('; ')}`);
        }

        entry._governance = {
          verdict: gov.verdict,
          confidence: gov.confidence,
          verified_claims: gov.verified_claims || [],
          unverified_claims: gov.unverified_claims || [],
          fabricated_claims: gov.fabricated_claims || [],
          notes: gov.notes || '',
          paywall_caveat: gov.paywall_caveat || false,
          verified_at: new Date().toISOString(),
          human_approved: false,
          approved_at: null,
          fallback_sources: fallback_sources.length > 0 ? fallback_sources : undefined,
          backfill: true,
        };
        entry.source_verified = gov.verdict === 'PASS';
      }

      writeFileSync(filepath, JSON.stringify(entry, null, 2), 'utf-8');
      log('💾 ', `  Saved`);

    } catch (err) {
      result.error = err.message;
      result.verdict = 'ERROR';
      log('💥 ', `  Error: ${err.message}`);
    }

    results.push(result);

    // Rate limit: 3s between entries to avoid hammering Jina + Claude
    if (i < files.length - 1) await sleep(3000);
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  const pass   = results.filter(r => r.verdict === 'PASS').length;
  const review = results.filter(r => r.verdict?.startsWith('REVIEW')).length;
  const fail   = results.filter(r => r.verdict === 'FAIL').length;
  const errors = results.filter(r => r.verdict === 'ERROR').length;

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║                    BACKFILL SUMMARY                  ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`  Total entries : ${files.length}`);
  console.log(`  Skipped       : ${skipped} (already had _governance)`);
  console.log(`  Processed     : ${results.length}`);
  console.log(`  ✅ PASS       : ${pass}`);
  console.log(`  🟡 REVIEW     : ${review}`);
  console.log(`  ❌ FAIL       : ${fail}`);
  console.log(`  💥 ERROR      : ${errors}`);

  if (fail > 0) {
    console.log(`\n⚠️  FAIL entries — review these manually:`);
    results.filter(r => r.verdict === 'FAIL').forEach(r => console.log(`   - ${r.id} (${r.file})`));
  }
  if (review > 0) {
    console.log(`\n🟡 REVIEW entries — may need human sign-off:`);
    results.filter(r => r.verdict?.startsWith('REVIEW')).forEach(r => console.log(`   - ${r.id} (${r.file})`));
  }

  console.log(`\n  All _governance blocks written inline to each JSON.`);
  console.log(`  Review the results above, then commit manually:\n`);
  console.log(`    cd living-intelligence`);
  console.log(`    git add data/intelligence/`);
  console.log(`    git commit -m "Add governance audit backfill to all intelligence entries"`);
  console.log(`    git push origin dev\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
