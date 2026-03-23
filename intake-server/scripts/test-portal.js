/**
 * test-portal.js — Portal health & link checker
 *
 * Tests all data URLs across the portal data files:
 *   - intelligence entries: source_url, image_url
 *   - thought-leadership entries: source_url, document_url, author.photo_url
 *   - competitor entries: (future)
 *
 * Auto-fixes what it can:
 *   - has_document: true with broken document_url → sets has_document: false, document_url: null
 *   - image_url pointing to broken unavatar.io → falls back to null
 *
 * Usage:
 *   node scripts/test-portal.js           # check + auto-fix
 *   node scripts/test-portal.js --dry-run # check only, no writes
 *
 * Options:
 *   --dry-run    Report issues without writing any fixes
 *   --fast       Skip source_url checks (they're slow, many are paywalled)
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORTAL_DIR = join(__dirname, '..', '..');
const INTEL_DIR = join(PORTAL_DIR, 'data', 'intelligence');
const TL_DIR = join(PORTAL_DIR, 'data', 'thought-leadership');

const DRY_RUN = process.argv.includes('--dry-run');
const FAST = process.argv.includes('--fast');
const TIMEOUT_MS = 10000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── URL checker ───────────────────────────────────────────────────────────────

async function checkUrl(url) {
  if (!url || !url.startsWith('http')) return { ok: false, status: 0, reason: 'invalid url' };
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; portal-health-checker/1.0)' },
      redirect: 'follow',
    });
    return { ok: res.ok, status: res.status, reason: res.ok ? 'ok' : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, status: 0, reason: err.name === 'TimeoutError' ? 'timeout' : err.message };
  }
}

// ── Issue tracker ─────────────────────────────────────────────────────────────

const issues = [];
const fixes = [];

function issue(severity, file, field, url, reason) {
  issues.push({ severity, file, field, url: url?.slice(0, 80), reason });
}

function fix(file, description) {
  fixes.push({ file, description });
}

// ── Intelligence entries ──────────────────────────────────────────────────────

async function checkIntelligence() {
  console.log('\n── Intelligence entries ─────────────────────────────────────────');
  const files = readdirSync(INTEL_DIR).filter(f => f.endsWith('.json')).sort();

  for (const file of files) {
    const filepath = join(INTEL_DIR, file);
    const entry = JSON.parse(readFileSync(filepath, 'utf-8'));
    let changed = false;

    // Check source_url (skip in fast mode — many are paywalled, slow to check)
    if (!FAST && entry.source_url) {
      const result = await checkUrl(entry.source_url);
      if (!result.ok && result.reason !== 'timeout') {
        issue('warn', file, 'source_url', entry.source_url, result.reason);
        process.stdout.write(`  ⚠  ${file}: source_url → ${result.reason}\n`);
      }
      await sleep(300);
    }

    // Check image_url
    if (entry.image_url && entry.image_url.startsWith('http')) {
      const result = await checkUrl(entry.image_url);
      if (!result.ok) {
        issue('error', file, 'image_url', entry.image_url, result.reason);
        process.stdout.write(`  ❌ ${file}: image_url → ${result.reason}\n`);

        // Auto-fix: clear broken remote image_url
        if (!DRY_RUN) {
          entry.image_url = null;
          changed = true;
          fix(file, `Cleared broken image_url (${result.reason})`);
        }
      }
    }

    // Check governance verdict vs source_verified consistency
    if (entry._governance) {
      const gov = entry._governance;
      const expectedVerified = gov.verdict === 'PASS' || gov.human_approved === true;
      if (entry.source_verified !== expectedVerified) {
        issue('warn', file, 'source_verified', null, `source_verified=${entry.source_verified} but governance=${gov.verdict}/human_approved=${gov.human_approved}`);
        process.stdout.write(`  ⚠  ${file}: source_verified mismatch\n`);
        if (!DRY_RUN) {
          entry.source_verified = expectedVerified;
          changed = true;
          fix(file, `Fixed source_verified to ${expectedVerified}`);
        }
      }
    }

    if (changed) writeFileSync(filepath, JSON.stringify(entry, null, 2), 'utf-8');
  }

  process.stdout.write(`  Checked ${files.length} entries\n`);
}

// ── Thought-leadership entries ────────────────────────────────────────────────

async function checkThoughtLeadership() {
  console.log('\n── Thought-leadership entries ───────────────────────────────────');
  const files = readdirSync(TL_DIR).filter(f => f.endsWith('.json')).sort();

  for (const file of files) {
    const filepath = join(TL_DIR, file);
    const entry = JSON.parse(readFileSync(filepath, 'utf-8'));
    let changed = false;

    // Check document_url
    if (entry.has_document && entry.document_url) {
      const result = await checkUrl(entry.document_url);
      if (!result.ok) {
        issue('error', file, 'document_url', entry.document_url, result.reason);
        process.stdout.write(`  ❌ ${file}: document_url → ${result.reason}\n`);

        // Auto-fix: set has_document false when PDF is broken
        if (!DRY_RUN) {
          entry.has_document = false;
          entry.document_url = null;
          changed = true;
          fix(file, `Cleared broken document_url, set has_document=false (${result.reason})`);
        }
      } else {
        process.stdout.write(`  ✅ ${file}: document_url → ok\n`);
      }
      await sleep(300);
    }

    // Check source_url
    if (!FAST && entry.source_url) {
      const result = await checkUrl(entry.source_url);
      if (!result.ok && result.reason !== 'timeout') {
        issue('warn', file, 'source_url', entry.source_url, result.reason);
        process.stdout.write(`  ⚠  ${file}: source_url → ${result.reason}\n`);
      }
      await sleep(300);
    }

    // Check author photo
    if (entry.author?.photo_url) {
      const result = await checkUrl(entry.author.photo_url);
      if (!result.ok) {
        issue('warn', file, 'author.photo_url', entry.author.photo_url, result.reason);
        process.stdout.write(`  ⚠  ${file}: author.photo_url → ${result.reason}\n`);
        if (!DRY_RUN) {
          entry.author.photo_url = null;
          changed = true;
          fix(file, `Cleared broken author.photo_url`);
        }
      }
    }

    if (changed) writeFileSync(filepath, JSON.stringify(entry, null, 2), 'utf-8');
  }

  process.stdout.write(`  Checked ${files.length} entries\n`);
}

// ── Portal page checker ───────────────────────────────────────────────────────

async function checkPortalPages() {
  const BASE = process.env.PORTAL_URL || 'http://localhost:3002';
  console.log(`\n── Portal pages (${BASE}) ────────────────────────────────────────`);

  // Read IDs from data files to build expected routes
  const intelligenceIds = readdirSync(INTEL_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));

  const tlIds = readdirSync(TL_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));

  const competitorIds = readdirSync(join(PORTAL_DIR, 'data', 'competitors'))
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));

  const pages = [
    // Core nav pages
    { path: '/',                      label: 'Home' },
    { path: '/intelligence',          label: 'Intelligence feed' },
    { path: '/thought-leadership',    label: 'Thought leadership' },
    { path: '/landscape',             label: 'Landscape' },
    // All intelligence article pages
    ...intelligenceIds.map(id => ({ path: `/intelligence/${id}`, label: `Article: ${id}` })),
    // All thought-leadership pages
    ...tlIds.map(id => ({ path: `/thought-leadership/${id}`, label: `TL: ${id}` })),
    // All competitor profile pages
    ...competitorIds.map(id => ({ path: `/competitors/${id}`, label: `Competitor: ${id}` })),
  ];

  let ok = 0, broken = 0;

  // Run checks in batches of 8 for speed
  const BATCH = 8;
  for (let i = 0; i < pages.length; i += BATCH) {
    const batch = pages.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async p => ({ ...p, result: await checkUrl(`${BASE}${p.path}`) }))
    );
    for (const { path, label, result } of results) {
      if (result.ok) {
        process.stdout.write(`  ✅ ${path}\n`);
        ok++;
      } else {
        process.stdout.write(`  ❌ ${path} (${label}) → ${result.reason}\n`);
        issue('error', path, 'page', `${BASE}${path}`, result.reason);
        broken++;
      }
    }
    await sleep(50);
  }

  process.stdout.write(`\n  ${ok} ok, ${broken} broken (${pages.length} total pages checked)\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║        Living Intelligence — Portal Health Check      ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no fixes)' : 'LIVE (auto-fix where possible)'}`);
  console.log(`  URL checks: ${FAST ? 'fast (skip source_url)' : 'full'}`);

  await checkThoughtLeadership();
  await checkIntelligence();
  await checkPortalPages();

  // ── Summary ────────────────────────────────────────────────────────────────

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warn');

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║                     HEALTH REPORT                    ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`  ❌ Errors   : ${errors.length}`);
  console.log(`  ⚠️  Warnings : ${warnings.length}`);
  console.log(`  🔧 Auto-fixed: ${fixes.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(i => console.log(`   [${i.file}] ${i.field}: ${i.reason}\n     ${i.url || ''}`));
  }
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(i => console.log(`   [${i.file}] ${i.field}: ${i.reason}\n     ${i.url || ''}`));
  }
  if (fixes.length > 0) {
    console.log('\n🔧 Auto-fixes applied:');
    fixes.forEach(f => console.log(`   [${f.file}] ${f.description}`));
    console.log('\n  Commit fixes:\n');
    console.log('    cd ../living-intelligence');
    console.log('    git add data/');
    console.log('    git commit -m "Fix broken URLs detected by portal health check"');
    console.log('    git push origin dev');
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('\n  ✅ All checks passed — portal is healthy\n');
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
