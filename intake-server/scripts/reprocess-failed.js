/**
 * reprocess-failed.js
 *
 * Reprocesses FAIL entries through the intake pipeline with strict grounding.
 *
 * Strategy per entry:
 *   1. If the original source URL is on an open domain → reprocess it directly
 *      (the issue was Claude hallucinating stats, not a bad URL)
 *   2. If the original URL is paywalled/dead → use the override URL provided below,
 *      with paywall fallback search if needed
 *   3. If governance still FAILs → leave old file, report for manual action
 *
 * Usage:
 *   node --env-file=.env scripts/reprocess-failed.js
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import Anthropic from '@anthropic-ai/sdk';
import slugify from 'slugify';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'living-intelligence', 'data', 'intelligence');
const client = new Anthropic();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(icon, msg) { console.log(`${icon}  ${msg}`); }
function hostname(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; } }

const PAYWALLED_DOMAINS = new Set([
  'ft.com', 'wsj.com', 'bloomberg.com', 'barrons.com',
  'economist.com', 'hbr.org', 'morningstar.com', 'thinkadvisor.com',
]);

const INTAKE_SCHEMA = `{
  "id": "url-slug-style-id",
  "type": "partnership | product_launch | milestone | strategy_move | market_signal",
  "headline": "Concise, factual headline under 120 chars",
  "company": "company-slug",
  "company_name": "Full Company Name",
  "date": "YYYY-MM-DD",
  "source_name": "Publication Name",
  "source_url": "the actual URL",
  "source_verified": true,
  "image_url": "https://unavatar.io/[company-domain]",
  "summary": "3-5 sentence summary. Only what is in the source article. No inference.",
  "key_stat": { "number": "X", "label": "what it measures" },
  "tags": {
    "capability": "advisor_productivity | client_experience | investment_analytics | operations_compliance | new_business_models | client_acquisition",
    "region": "us | emea | asia | latam | global",
    "segment": "global_bank | regional_champion | retail_digital | ria_independent | uhnw_digital | ai_native",
    "theme": ["2-4 lowercase_underscore tags"]
  },
  "week": "YYYY-MM-DD (monday of current week)",
  "featured": false
}`;

// ── FAIL entries with strategy ────────────────────────────────────────────────
// override_url: use this instead of the original (for dead/wrong/paywalled URLs)
// If no override_url, we use the existing source_url from the JSON file

const FAIL_ENTRIES = [
  {
    file: 'altruist-hazel-custodial-integration-real-time-account-data.json',
    // businesswire URL is valid — just reprocess with strict grounding
  },
  {
    file: 'altruist-hazel-market-signal.json',
    // bloomberg is paywalled — find open coverage of the Altruist Hazel AI disruption story
    override_url: 'https://www.businesswire.com/news/home/20251118149396/en/Altruist-Debuts-Industry-First-Custodial-Integration-for-its-Transformative-AI-Platform-Hazel-Bringing-Real-Time-Account-Data-Into-Every-Advisor-Conversation',
  },
  {
    file: 'arta-ai-chief-of-staff.json',
    // fortune.com URL is 404 — use the actual Arta Finance press release
    override_url: 'https://www.prnewswire.com/news-releases/arta-finance-launches-arta-ai-private-wealth-guided-by-ai-302418182.html',
  },
  {
    file: 'bofa-erica-2billion.json',
    // bankofamerica.com newsroom — valid, just had a fabricated superlative
  },
  {
    file: 'citigroup-askwealth-ai-advisors-2025-08.json',
    // citigroup.com URL valid — fabricated stats were added on top
  },
  {
    file: 'fidelity-trader-plus-launch-2025-09.json',
    // businesswire URL valid — fabricated customer count stat
  },
  {
    file: 'hsbc-jade-ai.json',
    // fintech.global is paywalled — use HSBC's own press coverage
    override_url: 'https://hsbc-launches-ai-powered-wealth-intelligence-platform',
    search_fallback: 'HSBC Jade private banking AI wealth intelligence platform 2025',
  },
  {
    file: 'lpl-anthropic-partnership.json',
    // thinkadvisor is paywalled — search for open press release
    search_fallback: 'LPL Financial Anthropic partnership AI advisors 2026',
  },
  {
    file: 'morgan-stanley-ai-assistant-scaled.json',
    // morganstanley.com corporate page — use the businesswire press release
    override_url: 'https://www.businesswire.com/news/home/20240625048568/en/Morgan-Stanley-Wealth-Management-Announces-Latest-Game-Changing-Addition-to-Suite-of-GenAI-Tools',
  },
  {
    file: 'public-com-agentic-brokerage-2025-11.json',
    // axios.com — try direct fetch first; has paywall fallback if needed
  },
  {
    file: 'ubs-ai-transformation-factory.json',
    // wrong article (points to Chief AI Officer, not Singapore factory)
    // Use the Chief AI Officer article as the actual source — that's the real story
    override_url: 'https://www.ubs.com/global/en/media/display-page-ndp/en-20251016-ai-strategy.html',
  },
  {
    file: 'wealthfront-automated-planning.json',
    // blog homepage used as source — already reprocessed to a REVIEW entry in previous run
    // skip it (it was handled)
    skip: true,
  },
];

// ── Jina fetch with paywall fallback ─────────────────────────────────────────

async function fetchWithFallback(url, searchFallback = null) {
  const jinaHeaders = {
    'Accept': 'text/markdown',
    'X-Return-Format': 'markdown',
    ...(process.env.JINA_API_KEY ? { 'Authorization': `Bearer ${process.env.JINA_API_KEY}` } : {}),
  };

  let primary = null;
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, { headers: jinaHeaders, signal: AbortSignal.timeout(30000) });
    if (res.ok) { const md = await res.text(); if (md.length >= 200) primary = md; }
  } catch (_) {}

  if (!primary) return { markdown: null, paywall: true, fallback_sources: [] };

  const paywallSignals =
    primary.includes('Subscribe to continue') ||
    primary.includes('Sign in to read') ||
    primary.includes('Create a free account') ||
    primary.includes('[Click here to read more]') ||
    primary.toLowerCase().includes('paywall');

  if (!paywallSignals) return { markdown: primary, paywall: false, fallback_sources: [] };

  // Paywall hit — try search fallback
  if (!process.env.JINA_API_KEY) return { markdown: primary, paywall: true, fallback_sources: [] };

  const query = searchFallback || (() => {
    let slug = ''; try { slug = new URL(url).pathname.replace(/[^a-z0-9\s-]/gi, ' ').replace(/-/g, ' ').trim(); } catch (_) {}
    const stopWords = new Set(['the','a','an','and','or','in','of','to','for','with','on','at','by','from','is','are','was','be','its','html','www','com']);
    return `${slug} ${primary.slice(0, 150)}`.toLowerCase().split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w)).slice(0, 8).join(' ');
  })();

  let altUrls = [];
  try {
    const searchRes = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${process.env.JINA_API_KEY}` },
      signal: AbortSignal.timeout(20000),
    });
    if (searchRes.ok) {
      const data = await searchRes.json();
      const origHost = hostname(url);
      altUrls = (data.data || [])
        .filter(r => { if (!r.url) return false; const h = hostname(r.url); return h !== origHost && !PAYWALLED_DOMAINS.has(h); })
        .map(r => r.url).slice(0, 4);
    }
  } catch (_) {}

  const usable = [];
  for (const altUrl of altUrls) {
    if (usable.length >= 2) break;
    try {
      const res = await fetch(`https://r.jina.ai/${altUrl}`, { headers: jinaHeaders, signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const md = await res.text();
      if (md.length < 200 || md.includes('Subscribe to continue') || md.includes('Sign in to read')) continue;
      usable.push({ url: altUrl, markdown: md });
    } catch (_) {}
    await sleep(500);
  }

  if (usable.length === 0) return { markdown: primary, paywall: true, fallback_sources: [] };

  const combined = [
    `<!-- Original (paywalled): ${url} -->\n${primary.slice(0, 800)}`,
    ...usable.map(s => `<!-- Alternative: ${s.url} -->\n${s.markdown.slice(0, 3500)}`),
  ].join('\n\n---\n\n');

  return { markdown: combined, paywall: true, fallback_sources: usable.map(s => s.url) };
}

// ── Structure entry ───────────────────────────────────────────────────────────

async function structureEntry(url, markdown, sourceName, fallbackSources) {
  const prompt = `You are a structured content extractor for an AI in wealth management intelligence publication.

SOURCE ARTICLE URL: ${url}
SOURCE NAME: ${sourceName}
${fallbackSources?.length ? `\nADDITIONAL SOURCES (original paywalled):\n${fallbackSources.map(s => `- ${s}`).join('\n')}\n` : ''}
ARTICLE CONTENT:
---
${markdown.slice(0, 8000)}
---

CRITICAL RULES:
1. The summary must ONLY contain information present in the article above. Do NOT infer or add from training data.
2. key_stat must be a specific number explicitly stated in the article. If none exists, set to null.
3. Headline must be factual and specific.
4. If not about AI in wealth management, set type to null.
5. image_url: https://unavatar.io/[primary-company-domain]

Today: ${new Date().toISOString().split('T')[0]}

OUTPUT: Valid JSON only:
${INTAKE_SCHEMA}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = response.content[0].text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');
  const entry = JSON.parse(jsonMatch[0]);
  entry.source_url = url;
  entry.source_verified = false;
  if (!entry.id || entry.id === 'url-slug-style-id') {
    entry.id = slugify(entry.headline || 'untitled', { lower: true, strict: true, trim: true }).slice(0, 60);
  }
  return entry;
}

// ── Governance ────────────────────────────────────────────────────────────────

async function runGovernance(entry, markdown) {
  const prompt = `You are a fact-checking agent for an AI in wealth management publication.

GENERATED ENTRY:
---
Headline: ${entry.headline}
Summary: ${entry.summary}
Key stat: ${entry.key_stat ? `${entry.key_stat.number} — ${entry.key_stat.label}` : 'none'}
---

SOURCE (ground truth):
---
${markdown.slice(0, 6000)}
---

Return JSON:
{
  "verdict": "PASS" | "REVIEW" | "FAIL",
  "confidence": 0-100,
  "verified_claims": [...],
  "unverified_claims": [...],
  "fabricated_claims": [...],
  "notes": "brief explanation",
  "paywall_caveat": true | false
}

Rules:
- PASS: all claims verifiable. Minor paraphrasing ok.
- REVIEW: 1-2 unverified (implied not explicit). No fabrications.
- FAIL: any claim contradicts source or stat appears fabricated.
- paywall_caveat → give REVIEW.

Return only valid JSON.`;

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
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║   Living Intelligence — Reprocess FAIL Entries       ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);

  const summary = { pass: [], review: [], still_fail: [], error: [], skipped: [] };

  for (let i = 0; i < FAIL_ENTRIES.length; i++) {
    const { file, override_url, search_fallback, skip } = FAIL_ENTRIES[i];
    const filepath = join(DATA_DIR, file);

    if (skip) {
      log('⏭ ', `[${i + 1}/${FAIL_ENTRIES.length}] SKIP: ${file}`);
      summary.skipped.push(file);
      continue;
    }

    // Read existing entry for original URL and ID
    let oldEntry = null;
    try { oldEntry = JSON.parse(readFileSync(filepath, 'utf-8')); } catch (_) {}

    const targetUrl = override_url || oldEntry?.source_url;
    console.log(`\n── [${i + 1}/${FAIL_ENTRIES.length}] ${file.replace('.json', '')} ──`);
    log('🔗', `URL: ${targetUrl}`);

    if (!targetUrl) {
      log('⚠️ ', `No URL — skipping`);
      summary.error.push({ file, reason: 'No URL available' });
      continue;
    }

    // Fetch
    const { markdown, paywall, fallback_sources } = await fetchWithFallback(targetUrl, search_fallback);

    if (!markdown) {
      log('⚠️ ', `Could not fetch content`);
      summary.error.push({ file, reason: 'Fetch failed' });
      await sleep(3000);
      continue;
    }

    if (paywall && fallback_sources.length > 0) {
      log('🔄', `Paywall — using: ${fallback_sources.map(hostname).join(', ')}`);
    } else if (paywall) {
      log('⚠️ ', `Paywall detected, no open alternatives found — proceeding with partial content`);
    } else {
      log('📄', `Fetched ${markdown.split(/\s+/).length} words from ${hostname(targetUrl)}`);
    }

    // Structure
    log('🤖', `Structuring...`);
    let entry;
    try {
      entry = await structureEntry(targetUrl, markdown, hostname(targetUrl), fallback_sources);
    } catch (err) {
      log('💥', `Structuring failed: ${err.message}`);
      summary.error.push({ file, reason: err.message });
      await sleep(3000);
      continue;
    }

    if (!entry.type) {
      log('⏭ ', `Not relevant to AI in wealth management`);
      summary.error.push({ file, reason: 'Not relevant' });
      await sleep(3000);
      continue;
    }

    // Governance
    log('🛡️ ', `Governance check...`);
    let gov;
    try {
      gov = await runGovernance(entry, markdown);
    } catch (err) {
      log('💥', `Governance failed: ${err.message}`);
      summary.error.push({ file, reason: err.message });
      await sleep(3000);
      continue;
    }

    const icon = gov.verdict === 'PASS' ? '✅' : gov.verdict === 'REVIEW' ? '🟡' : '❌';
    log(icon, `${gov.verdict} (confidence: ${gov.confidence}) — ${gov.notes?.slice(0, 80) || ''}`);
    if (gov.unverified_claims?.length) log('   ', `Unverified: ${gov.unverified_claims[0]?.slice(0, 80)}`);
    if (gov.fabricated_claims?.length) log('🚨', `Fabricated: ${gov.fabricated_claims[0]?.slice(0, 80)}`);

    if (gov.verdict === 'FAIL') {
      log('⚠️ ', `Still FAIL — leaving original file`);
      summary.still_fail.push({ file, url: targetUrl, notes: gov.notes });
      await sleep(4000);
      continue;
    }

    // Write updated entry (preserve original file ID to keep filename stable)
    entry.id = oldEntry?.id || entry.id;
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
      reprocessed: true,
    };
    entry.source_verified = gov.verdict === 'PASS';

    writeFileSync(filepath, JSON.stringify(entry, null, 2), 'utf-8');
    log('💾', `Saved → ${file}`);

    if (gov.verdict === 'PASS') summary.pass.push(file);
    else summary.review.push({ file, unverified: gov.unverified_claims?.slice(0, 2) });

    await sleep(4000);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║                  REPROCESS SUMMARY                   ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`  ✅ PASS             : ${summary.pass.length}`);
  console.log(`  🟡 REVIEW           : ${summary.review.length}`);
  console.log(`  ❌ Still FAIL       : ${summary.still_fail.length}`);
  console.log(`  ⏭  Skipped          : ${summary.skipped.length}`);
  console.log(`  💥 Errors           : ${summary.error.length}`);

  if (summary.pass.length) {
    console.log(`\n✅ PASS:`);
    summary.pass.forEach(f => console.log(`   - ${f}`));
  }
  if (summary.review.length) {
    console.log(`\n🟡 REVIEW (needs human sign-off before publish):`);
    summary.review.forEach(r => {
      console.log(`   - ${r.file}`);
      r.unverified?.forEach(u => console.log(`     ↳ ${u?.slice(0, 80)}`));
    });
  }
  if (summary.still_fail.length) {
    console.log(`\n❌ Still FAIL — manual action needed:`);
    summary.still_fail.forEach(r => console.log(`   - ${r.file}\n     Notes: ${r.notes?.slice(0, 100)}`));
  }
  if (summary.error.length) {
    console.log(`\n💥 Errors:`);
    summary.error.forEach(r => console.log(`   - ${r.file}: ${r.reason}`));
  }

  console.log(`\n  Review results, then commit:\n`);
  console.log(`    cd ../living-intelligence`);
  console.log(`    git add data/intelligence/`);
  console.log(`    git commit -m "Reprocess FAIL entries through corrected intake pipeline"`);
  console.log(`    git push origin dev\n`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
