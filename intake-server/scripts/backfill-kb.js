/**
 * backfill-kb.js — Seed Supabase Knowledge Base from existing flat-file data.
 *
 * Phases:
 *   A. Seed verticals table ('wealth')
 *   B. Seed companies table from data/competitors/*.json (37 companies)
 *   C. Seed company_verticals join table
 *   D. Seed sources from data/intelligence/*.json (use summary as content_md, is_thin=true)
 *   E. Seed editorial_decisions (published = approve, rejection log = reject)
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-kb.js
 *   node --env-file=.env scripts/backfill-kb.js --dry-run   # report only, no writes
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseClient, storeSource, logDecision } from '../agents/kb-client.js';
import { CONTENT_DIR, INTEL_DIR, COMPETITORS_DIR } from '../agents/config.js';

const DRY_RUN = process.argv.includes('--dry-run');

function log(phase, msg) {
  console.log(`[backfill:${phase}] ${msg}`);
}

function readJSON(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

// ── Phase A: Seed verticals ────────────────────────────────────────────────

async function seedVerticals(supabase) {
  log('A', 'Seeding verticals...');

  if (DRY_RUN) {
    log('A', 'DRY RUN — would insert vertical: wealth');
    return;
  }

  const { error } = await supabase
    .from('verticals')
    .upsert({ id: 'wealth', label: 'AI in Wealth Management' }, { onConflict: 'id' });

  if (error) {
    log('A', `ERROR: ${error.message}`);
  } else {
    log('A', 'Done — 1 vertical seeded');
  }
}

// ── Phase B: Seed companies ────────────────────────────────────────────────

async function seedCompanies(supabase) {
  log('B', 'Seeding companies...');

  const files = readdirSync(COMPETITORS_DIR).filter(f => f.endsWith('.json'));
  log('B', `Found ${files.length} competitor files`);

  let inserted = 0;
  let skipped = 0;

  for (const file of files) {
    const comp = readJSON(join(COMPETITORS_DIR, file));

    if (DRY_RUN) {
      log('B', `DRY RUN — would insert company: ${comp.id} (${comp.name})`);
      inserted++;
      continue;
    }

    const { error } = await supabase
      .from('companies')
      .upsert({
        id: comp.id,
        name: comp.name,
        domain: null, // we don't store domains in competitor files
      }, { onConflict: 'id' });

    if (error) {
      log('B', `SKIP ${comp.id}: ${error.message}`);
      skipped++;
    } else {
      inserted++;
    }
  }

  log('B', `Done — ${inserted} companies seeded, ${skipped} skipped`);
  return files.map(f => readJSON(join(COMPETITORS_DIR, f)));
}

// ── Phase C: Seed company_verticals ────────────────────────────────────────

async function seedCompanyVerticals(supabase, companies) {
  log('C', 'Seeding company_verticals...');

  let inserted = 0;

  for (const comp of companies) {
    if (DRY_RUN) {
      log('C', `DRY RUN — would link ${comp.id} → wealth (${comp.segment})`);
      inserted++;
      continue;
    }

    const { error } = await supabase
      .from('company_verticals')
      .upsert({
        company_id: comp.id,
        vertical_id: 'wealth',
        segment: comp.segment,
      }, { onConflict: 'company_id,vertical_id' });

    if (error) {
      log('C', `SKIP ${comp.id}: ${error.message}`);
    } else {
      inserted++;
    }
  }

  log('C', `Done — ${inserted} company-vertical links`);
}

// ── Phase D: Seed sources from intelligence entries ────────────────────────

async function seedSources(supabase) {
  log('D', 'Seeding sources from intelligence entries...');

  const files = readdirSync(INTEL_DIR).filter(f => f.endsWith('.json'));
  log('D', `Found ${files.length} intelligence entries`);

  let inserted = 0;
  let skipped = 0;
  let duplicates = 0;

  for (const file of files) {
    const entry = readJSON(join(INTEL_DIR, file));

    if (!entry.source_url) {
      log('D', `SKIP ${entry.id}: no source_url`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      log('D', `DRY RUN — would store source: ${entry.source_url} (${entry.company})`);
      inserted++;
      continue;
    }

    // Use summary as content_md placeholder (is_thin = true)
    const contentMd = [
      `# ${entry.headline}`,
      '',
      entry.summary,
      '',
      entry.the_so_what ? `**So what:** ${entry.the_so_what}` : '',
    ].filter(Boolean).join('\n');

    const sourceId = await storeSource({
      url: entry.source_url,
      title: entry.headline,
      source_name: entry.source_name,
      source_type: entry.type === 'press_release' ? 'press_release' : 'article',
      content_md: contentMd,
      company_id: entry.company || null,
      vertical_id: 'wealth',
      topics: entry.tags?.theme || [],
      capability: entry.tags?.capability || null,
      published_at: entry.date || null,
      fetched_by: 'backfill',
      is_thin: true,
      is_paywalled: entry._governance?.paywall_caveat || false,
      word_count: contentMd.split(/\s+/).length,
    });

    if (sourceId) {
      inserted++;
    } else {
      // Could be duplicate URL (23505) or other error — kb-client logs it
      duplicates++;
    }

    // Also store any additional sources from entry.sources array if present
    if (entry.sources && Array.isArray(entry.sources)) {
      for (const src of entry.sources) {
        if (!src.url || src.url === entry.source_url) continue;

        const addlId = await storeSource({
          url: src.url,
          title: src.title || entry.headline,
          source_name: src.source || 'Unknown',
          source_type: src.type === 'press_release' ? 'press_release' : 'article',
          content_md: `Source referenced in ${entry.id}. Original content not fetched during backfill.`,
          company_id: entry.company || null,
          vertical_id: 'wealth',
          topics: entry.tags?.theme || [],
          capability: entry.tags?.capability || null,
          published_at: entry.date || null,
          fetched_by: 'backfill',
          is_thin: true,
        });

        if (addlId) inserted++;
        else duplicates++;
      }
    }
  }

  log('D', `Done — ${inserted} sources stored, ${duplicates} duplicates, ${skipped} skipped`);
}

// ── Phase E: Seed editorial decisions ──────────────────────────────────────

async function seedEditorialDecisions(supabase) {
  log('E', 'Seeding editorial decisions...');

  let inserted = 0;

  // E1: All published intelligence entries → decision = 'approve'
  const intelFiles = readdirSync(INTEL_DIR).filter(f => f.endsWith('.json'));

  for (const file of intelFiles) {
    const entry = readJSON(join(INTEL_DIR, file));

    if (DRY_RUN) {
      log('E', `DRY RUN — would log approve: ${entry.id}`);
      inserted++;
      continue;
    }

    const decisionId = await logDecision({
      entry_id: entry.id,
      decision: 'approve',
      reason: 'Published entry — backfill',
      editor_notes: entry._governance?.notes || null,
      evaluator_score: entry._governance ? {
        verdict: entry._governance.verdict,
        confidence: entry._governance.confidence,
      } : null,
      pipeline_score: entry._governance?.confidence || null,
      company_id: entry.company || null,
      capability: entry.tags?.capability || null,
      entry_type: entry.type || null,
      vertical_id: 'wealth',
    });

    if (decisionId) inserted++;
  }

  // E2: Rejection log entries → decision = 'reject'
  const rejectionLogPath = join(CONTENT_DIR, '.rejection-log.json');
  try {
    const rejections = readJSON(rejectionLogPath);
    if (Array.isArray(rejections)) {
      for (const rej of rejections) {
        if (DRY_RUN) {
          log('E', `DRY RUN — would log reject: ${rej.id || rej.url}`);
          inserted++;
          continue;
        }

        const decisionId = await logDecision({
          entry_id: rej.id || `rejected-${Date.now()}`,
          decision: 'reject',
          reason: rej.reason || 'Rejected',
          editor_notes: rej.notes || null,
          evaluator_score: rej.governance_verdict ? { verdict: rej.governance_verdict } : null,
          pipeline_score: rej.score || null,
          entry_type: null,
          vertical_id: 'wealth',
        });

        if (decisionId) inserted++;
      }
    }
  } catch {
    log('E', 'No rejection log found — skipping');
  }

  log('E', `Done — ${inserted} editorial decisions logged`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Knowledge Base Backfill');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_KEY not set — cannot backfill');
    process.exit(1);
  }

  // Quick connectivity check
  const { error: pingError } = await supabase.from('verticals').select('id').limit(1);
  if (pingError) {
    console.error(`Cannot reach Supabase: ${pingError.message}`);
    process.exit(1);
  }
  log('init', 'Supabase connection OK');

  await seedVerticals(supabase);
  const companies = await seedCompanies(supabase);
  await seedCompanyVerticals(supabase, companies);
  await seedSources(supabase);
  await seedEditorialDecisions(supabase);

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Backfill complete!');
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
