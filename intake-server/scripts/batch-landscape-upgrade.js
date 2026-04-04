/**
 * batch-landscape-upgrade.js — Run landscape profiles through v2 pipeline
 *
 * Usage:
 *   node --env-file=.env scripts/batch-landscape-upgrade.js [--limit N] [--id company-slug]
 *
 * Saves upgraded profiles to /tmp/landscape-v2/ for review before replacing originals.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { produceLandscape } from '../agents/landscape-producer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMP_DIR = join(__dirname, '..', '..', 'data', 'competitors');
const OUTPUT_DIR = '/tmp/landscape-v2';

// Parse args
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 999;
const idIdx = args.indexOf('--id');
const singleId = idIdx >= 0 ? args[idIdx + 1] : null;

// Ensure output dir
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// Load companies
const allCompanies = readdirSync(COMP_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => {
    const c = JSON.parse(readFileSync(join(COMP_DIR, f), 'utf8'));
    return { id: c.id, name: c.name, segment: c.segment, updated: c.last_updated };
  });

// Skip already-processed (check /tmp/landscape-v2/)
const alreadyDone = new Set(
  existsSync(OUTPUT_DIR) ? readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')) : []
);

// Filter targets
let targets;
if (singleId) {
  targets = allCompanies.filter(c => c.id === singleId);
  if (targets.length === 0) {
    console.error(`Company not found: ${singleId}`);
    process.exit(1);
  }
} else {
  targets = allCompanies
    .filter(c => !alreadyDone.has(c.id))
    .slice(0, limit);
}

console.log(`\n=== LANDSCAPE V2 BATCH ===`);
console.log(`Companies to process: ${targets.length}\n`);

const results = { success: [], failed: [], aborted: [] };

for (let i = 0; i < targets.length; i++) {
  const company = targets[i];
  const progress = `[${i + 1}/${targets.length}]`;

  console.log(`${progress} Processing: ${company.name} (${company.id})`);

  const send = (event, data) => {
    if (['evaluate_v1_result', 'evaluate_v2_result', 'landscape_complete'].includes(data.stage)) {
      console.log(`  ${data.stage}: ${(data.message || '').slice(0, 120)}`);
    }
  };

  try {
    const result = await produceLandscape({ companySlug: company.id, send });

    if (result.aborted) {
      console.log(`  ❌ ABORTED: ${result.reason?.slice(0, 100)}`);
      results.aborted.push({ id: company.id, reason: result.reason });
    } else {
      const outPath = join(OUTPUT_DIR, `${company.id}.json`);
      writeFileSync(outPath, JSON.stringify(result.profile, null, 2));
      const score = result.profile._landscape_v2?.evaluation?.quality_score || 0;
      const caps = Object.keys(result.profile.capabilities || {}).length;
      console.log(`  ✅ Score: ${score}/10 | Caps: ${caps} | Fab: ${result.profile._landscape_v2?.fabrication?.verdict}`);
      results.success.push({ id: company.id, name: company.name, score, caps });
    }
  } catch (err) {
    console.log(`  ❌ ERROR: ${err.message?.slice(0, 100)}`);
    results.failed.push({ id: company.id, error: err.message });
  }

  console.log('');
}

// Summary
console.log('=== RESULTS ===');
console.log(`Success: ${results.success.length}`);
results.success.forEach(r => console.log(`  ✅ ${r.name.padEnd(35)} score:${r.score}/10 caps:${r.caps}`));
console.log(`Aborted: ${results.aborted.length}`);
results.aborted.forEach(r => console.log(`  ❌ ${r.id.padEnd(35)} ${r.reason?.slice(0, 60)}`));
console.log(`Failed: ${results.failed.length}`);
results.failed.forEach(r => console.log(`  ❌ ${r.id.padEnd(35)} ${r.error?.slice(0, 60)}`));
console.log(`\nUpgraded profiles saved to: ${OUTPUT_DIR}`);
