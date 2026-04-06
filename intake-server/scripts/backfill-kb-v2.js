/**
 * backfill-kb-v2.js — Comprehensive KB backfill with full source content.
 *
 * This is the "make the KB real" script. It:
 *   1. Fetches FULL article content via Jina for every source URL
 *   2. Stores all intelligence entries in published_entries
 *   3. Stores all thought leadership entries in published_entries (type='thought_leadership')
 *   4. Stores all landscape profiles in landscape_profiles
 *   5. Creates intelligence ↔ landscape relationships
 *   6. Stores ALL source URLs from entries + landscape profiles
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-kb-v2.js
 *   node --env-file=.env scripts/backfill-kb-v2.js --dry-run
 *   node --env-file=.env scripts/backfill-kb-v2.js --skip-fetch   # use summaries, don't call Jina
 *   node --env-file=.env scripts/backfill-kb-v2.js --phase sources  # run only one phase
 *   node --env-file=.env scripts/backfill-kb-v2.js --phase entries
 *   node --env-file=.env scripts/backfill-kb-v2.js --phase landscape
 *   node --env-file=.env scripts/backfill-kb-v2.js --phase relationships
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  getSupabaseClient, storeSource, getSourceByUrl, updateSource,
  storePublishedEntry, storeLandscapeProfile, logDecision,
} from '../agents/kb-client.js';
import { CONTENT_DIR, INTEL_DIR, COMPETITORS_DIR, TL_DIR } from '../agents/config.js';

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_FETCH = process.argv.includes('--skip-fetch');
const PHASE_ARG = process.argv.find((a, i) => process.argv[i - 1] === '--phase');
const JINA_API_KEY = process.env.JINA_API_KEY;

// Rate limiting for Jina
const JINA_DELAY_MS = 800; // ~75 RPM, well within limits
let lastJinaCall = 0;

function log(phase, msg) {
  console.log(`[v2:${phase}] ${msg}`);
}

function readJSON(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Jina Reader ─────────────────────────────────────────────────────────────

async function fetchViaJina(url) {
  if (SKIP_FETCH) return null;
  if (!JINA_API_KEY) {
    log('jina', 'No JINA_API_KEY — skipping fetch');
    return null;
  }

  // Rate limit
  const now = Date.now();
  const elapsed = now - lastJinaCall;
  if (elapsed < JINA_DELAY_MS) {
    await sleep(JINA_DELAY_MS - elapsed);
  }
  lastJinaCall = Date.now();

  try {
    const response = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: {
        'Authorization': `Bearer ${JINA_API_KEY}`,
        'Accept': 'text/markdown',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      log('jina', `HTTP ${response.status} for ${url.slice(0, 80)}`);
      return null;
    }

    const text = await response.text();
    if (!text || text.length < 100) {
      log('jina', `Thin content (${text?.length || 0} chars) for ${url.slice(0, 80)}`);
      return null;
    }

    return text;
  } catch (err) {
    log('jina', `Error fetching ${url.slice(0, 80)}: ${err.message}`);
    return null;
  }
}

// ── Phase 1: Sources — fetch full content for ALL URLs ──────────────────────

async function seedSources(supabase) {
  log('sources', '═══ Phase 1: Seeding sources with full content ═══');

  // Collect ALL unique URLs from intelligence entries
  const intelFiles = readdirSync(INTEL_DIR).filter(f => f.endsWith('.json'));
  const allUrls = new Map(); // url → {title, source_name, source_type, company_id, topics, capability, published_at}

  for (const file of intelFiles) {
    const entry = readJSON(join(INTEL_DIR, file));

    // Primary source
    if (entry.source_url) {
      allUrls.set(entry.source_url, {
        title: entry.headline,
        source_name: entry.source_name,
        source_type: entry.type === 'press_release' ? 'press_release' : 'article',
        company_id: entry.company || null,
        topics: entry.tags?.theme || [],
        capability: entry.tags?.capability || null,
        published_at: entry.date || null,
        entry_id: entry.id,
        role: 'primary',
      });
    }

    // Multi-source array (v2 entries on main)
    if (entry.sources && Array.isArray(entry.sources)) {
      for (const src of entry.sources) {
        if (!src.url || allUrls.has(src.url)) continue;
        allUrls.set(src.url, {
          title: src.title || entry.headline,
          source_name: src.source || src.name || 'Unknown',
          source_type: src.type === 'primary' ? 'press_release' : 'article',
          company_id: entry.company || null,
          topics: entry.tags?.theme || [],
          capability: entry.tags?.capability || null,
          published_at: entry.date || null,
          entry_id: entry.id,
          role: src.type || 'coverage',
        });
      }
    }

    // Additional sources (older format)
    if (entry.additional_sources && Array.isArray(entry.additional_sources)) {
      for (const src of entry.additional_sources) {
        if (!src.url || allUrls.has(src.url)) continue;
        allUrls.set(src.url, {
          title: entry.headline,
          source_name: src.name || 'Unknown',
          source_type: 'article',
          company_id: entry.company || null,
          topics: entry.tags?.theme || [],
          capability: entry.tags?.capability || null,
          published_at: entry.date || null,
          entry_id: entry.id,
          role: 'coverage',
        });
      }
    }
  }

  // Collect landscape source URLs
  const compFiles = readdirSync(COMPETITORS_DIR).filter(f => f.endsWith('.json'));
  for (const file of compFiles) {
    const comp = readJSON(join(COMPETITORS_DIR, file));

    if (comp.primary_source && !allUrls.has(comp.primary_source)) {
      allUrls.set(comp.primary_source, {
        title: `${comp.name} — AI Strategy`,
        source_name: 'Company/Industry',
        source_type: 'article',
        company_id: comp.id,
        topics: [],
        capability: null,
        published_at: comp.last_updated || null,
        entry_id: null,
        role: 'landscape',
      });
    }

    // Capability-level sources
    for (const [capId, cap] of Object.entries(comp.capabilities || {})) {
      if (cap.sources && Array.isArray(cap.sources)) {
        for (const src of cap.sources) {
          if (!src.url || allUrls.has(src.url)) continue;
          allUrls.set(src.url, {
            title: src.name || `${comp.name} — ${capId}`,
            source_name: src.name || 'Industry Source',
            source_type: 'article',
            company_id: comp.id,
            topics: [],
            capability: capId,
            published_at: cap.date_assessed || comp.last_updated || null,
            entry_id: null,
            role: 'landscape_evidence',
          });
        }
      }
    }
  }

  // Collect TL source URLs
  const tlFiles = readdirSync(TL_DIR).filter(f => f.endsWith('.json'));
  for (const file of tlFiles) {
    const tl = readJSON(join(TL_DIR, file));
    if (tl.source_url && !allUrls.has(tl.source_url)) {
      allUrls.set(tl.source_url, {
        title: tl.title,
        source_name: tl.publication || 'Unknown',
        source_type: 'article',
        company_id: null,
        topics: tl.tags || [],
        capability: null,
        published_at: tl.date_published || null,
        entry_id: tl.id,
        role: 'thought_leadership',
      });
    }
  }

  log('sources', `Found ${allUrls.size} unique URLs to process`);

  let stored = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let i = 0;

  for (const [url, meta] of allUrls) {
    i++;
    if (i % 25 === 0) log('sources', `Progress: ${i}/${allUrls.size} (stored: ${stored}, updated: ${updated}, skipped: ${skipped})`);

    if (DRY_RUN) {
      log('sources', `DRY RUN — ${meta.role} | ${url.slice(0, 80)}`);
      stored++;
      continue;
    }

    // Check if URL already exists in KB
    const existing = await getSourceByUrl(url);

    if (existing && !existing.is_thin) {
      // Already has full content — skip
      skipped++;
      continue;
    }

    // Fetch full content via Jina
    const fullContent = await fetchViaJina(url);

    if (existing && existing.is_thin && fullContent) {
      // Upgrade thin source to full content
      await updateSource(existing.id, {
        content_md: fullContent,
        word_count: fullContent.split(/\s+/).length,
        is_thin: false,
        fetched_by: 'backfill-v2',
      });
      updated++;
      continue;
    }

    if (existing) {
      // Exists but Jina fetch failed — keep existing thin record
      skipped++;
      continue;
    }

    // New URL — store it
    const contentMd = fullContent || `# ${meta.title}\n\nSource referenced in ${meta.entry_id || 'landscape'}. Content not fetched during backfill.`;
    const isThin = !fullContent;

    const sourceId = await storeSource({
      url,
      title: meta.title,
      source_name: meta.source_name,
      source_type: meta.source_type,
      content_md: contentMd,
      company_id: meta.company_id,
      vertical_id: 'wealth',
      topics: meta.topics,
      capability: meta.capability,
      published_at: meta.published_at,
      fetched_by: 'backfill-v2',
      is_thin: isThin,
      word_count: contentMd.split(/\s+/).length,
    });

    if (sourceId) stored++;
    else failed++;
  }

  log('sources', `Done — ${stored} stored, ${updated} upgraded, ${skipped} skipped, ${failed} failed`);
}

// ── Phase 2: Published Entries ──────────────────────────────────────────────

async function seedPublishedEntries(supabase) {
  log('entries', '═══ Phase 2: Seeding published entries ═══');

  // Intelligence entries
  const intelFiles = readdirSync(INTEL_DIR).filter(f => f.endsWith('.json'));
  log('entries', `Found ${intelFiles.length} intelligence entries`);

  let stored = 0;

  for (const file of intelFiles) {
    const entry = readJSON(join(INTEL_DIR, file));

    // Collect all source URLs for this entry
    const sourceUrls = [];
    if (entry.source_url) sourceUrls.push(entry.source_url);
    if (entry.sources) entry.sources.forEach(s => { if (s.url && !sourceUrls.includes(s.url)) sourceUrls.push(s.url); });
    if (entry.additional_sources) entry.additional_sources.forEach(s => { if (s.url && !sourceUrls.includes(s.url)) sourceUrls.push(s.url); });

    // key_stat as string (table stores TEXT)
    const keyStatStr = entry.key_stat
      ? `${entry.key_stat.number} — ${entry.key_stat.label}`
      : null;

    if (DRY_RUN) {
      log('entries', `DRY RUN — intel: ${entry.id} (${sourceUrls.length} sources)`);
      stored++;
      continue;
    }

    const result = await storePublishedEntry({
      id: entry.id,
      entry_type: 'intelligence',
      company_id: entry.company || null,
      vertical_id: 'wealth',
      headline: entry.headline,
      summary: entry.summary,
      the_so_what: entry.the_so_what,
      key_stat: keyStatStr,
      capability: entry.tags?.capability || null,
      source_url: entry.source_url,
      source_urls: sourceUrls,
      week: entry.week,
      published_at: entry.published_at || entry.date,
      tags: [
        ...(entry.tags?.theme || []),
        entry.tags?.region,
        entry.tags?.segment,
        entry.type,
      ].filter(Boolean),
      related_landscape_ids: entry.company ? [entry.company] : [],
    });

    if (result) stored++;
  }

  // Thought leadership entries
  const tlFiles = readdirSync(TL_DIR).filter(f => f.endsWith('.json'));
  log('entries', `Found ${tlFiles.length} thought leadership entries`);

  for (const file of tlFiles) {
    const tl = readJSON(join(TL_DIR, file));

    if (DRY_RUN) {
      log('entries', `DRY RUN — tl: ${tl.id}`);
      stored++;
      continue;
    }

    // Build a unified summary from TL structure
    const summaryParts = [];
    if (tl.executive_summary) summaryParts.push(tl.executive_summary.join(' '));
    if (tl.key_quotes?.length) {
      summaryParts.push('Key quotes: ' + tl.key_quotes.map(q => `"${q.text}"`).join('; '));
    }

    const result = await storePublishedEntry({
      id: tl.id,
      entry_type: 'thought_leadership',
      company_id: null, // TL entries aren't about specific companies
      vertical_id: 'wealth',
      headline: tl.title,
      summary: summaryParts.join('\n\n') || null,
      the_so_what: tl.the_one_insight,
      key_stat: null,
      capability: null,
      source_url: tl.source_url,
      source_urls: tl.source_url ? [tl.source_url] : [],
      week: tl.week,
      published_at: tl.date_published,
      tags: tl.tags || [],
    });

    if (result) stored++;
  }

  log('entries', `Done — ${stored} published entries stored`);
}

// ── Phase 3: Landscape Profiles ─────────────────────────────────────────────

async function seedLandscapeProfiles(supabase) {
  log('landscape', '═══ Phase 3: Seeding landscape profiles ═══');

  const compFiles = readdirSync(COMPETITORS_DIR).filter(f => f.endsWith('.json'));
  log('landscape', `Found ${compFiles.length} competitor profiles`);

  // Pre-compute: which intelligence entries reference each company
  const intelFiles = readdirSync(INTEL_DIR).filter(f => f.endsWith('.json'));
  const entriesByCompany = {};
  for (const file of intelFiles) {
    const entry = readJSON(join(INTEL_DIR, file));
    if (entry.company) {
      if (!entriesByCompany[entry.company]) entriesByCompany[entry.company] = [];
      entriesByCompany[entry.company].push(entry.id);
    }
  }

  let stored = 0;

  for (const file of compFiles) {
    const comp = readJSON(join(COMPETITORS_DIR, file));

    // Build capabilities JSONB — store the FULL v2 structure
    const capabilities = {};
    for (const [capId, cap] of Object.entries(comp.capabilities || {})) {
      capabilities[capId] = {
        maturity: cap.maturity,
        headline: cap.headline,
        detail: cap.detail,
        evidence: cap.evidence || [],
        sources: cap.sources || [],
        date_assessed: cap.date_assessed,
      };
    }

    // Evidence entry IDs — all intelligence entries about this company
    const evidenceEntryIds = entriesByCompany[comp.id] || [];

    if (DRY_RUN) {
      log('landscape', `DRY RUN — ${comp.id} (${Object.keys(capabilities).length} caps, ${evidenceEntryIds.length} entries)`);
      stored++;
      continue;
    }

    const result = await storeLandscapeProfile({
      id: comp.id,
      company_id: comp.id,
      vertical_id: 'wealth',
      segment: comp.segment,
      ai_strategy_summary: comp.ai_strategy_summary,
      headline_metric: comp.headline_metric,
      headline_initiative: comp.headline_initiative,
      overall_maturity: comp.overall_maturity,
      capabilities,
      evidence_entry_ids: evidenceEntryIds,
      last_updated: comp.last_updated,
    });

    if (result) stored++;
  }

  log('landscape', `Done — ${stored} landscape profiles stored`);
}

// ── Phase 4: Relationships ──────────────────────────────────────────────────

async function seedRelationships(supabase) {
  log('relationships', '═══ Phase 4: Updating entry ↔ landscape relationships ═══');

  // Update published_entries with related_landscape_ids
  const intelFiles = readdirSync(INTEL_DIR).filter(f => f.endsWith('.json'));
  const compIds = new Set(readdirSync(COMPETITORS_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')));

  let updated = 0;

  for (const file of intelFiles) {
    const entry = readJSON(join(INTEL_DIR, file));
    if (!entry.company) continue;

    // Check if company has a landscape profile
    if (!compIds.has(entry.company)) continue;

    if (DRY_RUN) {
      log('relationships', `DRY RUN — ${entry.id} → landscape:${entry.company}`);
      updated++;
      continue;
    }

    // Update the published entry to reference its landscape profile
    const { error } = await supabase
      .from('published_entries')
      .update({ related_landscape_ids: [entry.company] })
      .eq('id', entry.id);

    if (!error) updated++;
  }

  log('relationships', `Done — ${updated} entry ↔ landscape links created`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Knowledge Base V2 Backfill — Comprehensive');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${SKIP_FETCH ? ' (skip Jina fetch)' : ''}`);
  if (PHASE_ARG) console.log(`  Phase: ${PHASE_ARG} only`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_KEY not set');
    process.exit(1);
  }

  // Connectivity check
  const { error: pingError } = await supabase.from('verticals').select('id').limit(1);
  if (pingError) {
    console.error(`Cannot reach Supabase: ${pingError.message}`);
    process.exit(1);
  }
  log('init', 'Supabase connection OK');

  if (!JINA_API_KEY && !SKIP_FETCH && !DRY_RUN) {
    log('init', '⚠️  JINA_API_KEY not set — will store placeholder content for unfetched sources');
  }

  const phases = PHASE_ARG ? [PHASE_ARG] : ['sources', 'entries', 'landscape', 'relationships'];

  if (phases.includes('sources')) await seedSources(supabase);
  if (phases.includes('entries')) await seedPublishedEntries(supabase);
  if (phases.includes('landscape')) await seedLandscapeProfiles(supabase);
  if (phases.includes('relationships')) await seedRelationships(supabase);

  // Print summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  if (!DRY_RUN) {
    const counts = {};
    for (const t of ['sources', 'published_entries', 'landscape_profiles']) {
      const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
      counts[t] = count;
    }
    // Count non-thin sources
    const { count: fullCount } = await supabase.from('sources').select('*', { count: 'exact', head: true }).eq('is_thin', false);
    counts.full_sources = fullCount;

    console.log('  Final KB State:');
    console.log(`    Sources:           ${counts.sources} total (${counts.full_sources} with full content)`);
    console.log(`    Published entries:  ${counts.published_entries}`);
    console.log(`    Landscape profiles: ${counts.landscape_profiles}`);
  }
  console.log('  Backfill complete!');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
