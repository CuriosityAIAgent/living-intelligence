/**
 * batch-v2-upgrade.js — Run entries through the v2 Content Producer pipeline
 *
 * Reads entries from data/intelligence/, processes each through the full
 * Research → Write → Evaluate → Fabrication pipeline, saves upgraded entries
 * to /tmp/v2-upgrades/ for review before replacing originals.
 *
 * Usage:
 *   node --env-file=.env scripts/batch-v2-upgrade.js [--limit N] [--id entry-id]
 *
 * Options:
 *   --limit N    Process only the first N entries (default: all priority entries)
 *   --id X       Process a single entry by ID
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { produceEntry } from '../agents/content-producer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INTEL_DIR = join(__dirname, '..', '..', 'data', 'intelligence');
const OUTPUT_DIR = '/tmp/v2-upgrades';

// Parse args
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 999;
const idIdx = args.indexOf('--id');
const singleId = idIdx >= 0 ? args[idIdx + 1] : null;

// Ensure output dir
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// Load entries
const allEntries = readdirSync(INTEL_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => {
    const e = JSON.parse(readFileSync(join(INTEL_DIR, f), 'utf8'));
    return {
      id: e.id,
      url: e.source_url,
      source_name: e.source_name,
      headline: e.headline,
      key_stat: e.key_stat,
      gov: e._governance?.confidence || 0,
    };
  });

// Filter: single ID or priority entries (null key_stat or low governance)
let targets;
if (singleId) {
  targets = allEntries.filter(e => e.id === singleId);
  if (targets.length === 0) {
    console.error(`Entry not found: ${singleId}`);
    process.exit(1);
  }
} else {
  targets = allEntries
    .filter(e => !e.key_stat || e.gov < 80)
    .sort((a, b) => a.gov - b.gov)
    .slice(0, limit);
}

console.log(`\n=== V2 BATCH UPGRADE ===`);
console.log(`Entries to process: ${targets.length}\n`);

const results = { success: [], failed: [], aborted: [] };

for (let i = 0; i < targets.length; i++) {
  const entry = targets[i];
  const progress = `[${i + 1}/${targets.length}]`;

  console.log(`${progress} Processing: ${entry.id}`);
  console.log(`  URL: ${entry.url?.slice(0, 80)}`);

  const send = (event, data) => {
    // Only log key milestones
    if (['evaluate_v1_result', 'evaluate_v2_result', 'scoring', 'pipeline_complete'].includes(data.stage)) {
      console.log(`  ${data.stage}: ${(data.message || '').slice(0, 100)}`);
    }
  };

  try {
    const result = await produceEntry({
      url: entry.url,
      title: entry.headline,
      source_name: entry.source_name,
      send,
    });

    if (result.aborted) {
      console.log(`  ❌ ABORTED: ${result.reason?.slice(0, 100)}`);
      results.aborted.push({ id: entry.id, reason: result.reason });
    } else {
      // Keep original ID
      result.entry.id = entry.id;
      const outPath = join(OUTPUT_DIR, `${entry.id}.json`);
      writeFileSync(outPath, JSON.stringify(result.entry, null, 2));
      console.log(`  ✅ Score: ${result.entry._final_score} | Sources: ${result.entry.source_count} | Fab: ${result.entry._fabrication?.verdict} | Iterations: ${result.entry._iterations?.length}`);
      results.success.push({ id: entry.id, score: result.entry._final_score, sources: result.entry.source_count });
    }
  } catch (err) {
    console.log(`  ❌ ERROR: ${err.message?.slice(0, 100)}`);
    results.failed.push({ id: entry.id, error: err.message });
  }

  console.log('');
}

// Summary
console.log('=== RESULTS ===');
console.log(`Success: ${results.success.length}`);
results.success.forEach(r => console.log(`  ✅ ${r.id.padEnd(55)} score:${r.score} sources:${r.sources}`));
console.log(`Aborted: ${results.aborted.length}`);
results.aborted.forEach(r => console.log(`  ❌ ${r.id.padEnd(55)} ${r.reason?.slice(0, 60)}`));
console.log(`Failed: ${results.failed.length}`);
results.failed.forEach(r => console.log(`  ❌ ${r.id.padEnd(55)} ${r.error?.slice(0, 60)}`));
console.log(`\nUpgraded entries saved to: ${OUTPUT_DIR}`);
