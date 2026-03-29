/**
 * smoke-test.js — Quick verification that the system is healthy.
 *
 * Checks:
 *   1. All data files parse as valid JSON
 *   2. Every intelligence entry has required fields
 *   3. Every entry's company slug matches a competitor file (or is a known non-landscape company)
 *   4. No banned URLs in image_url fields
 *   5. No test artifacts in data directories
 *   6. Intake server health endpoint (if running)
 *   7. Portal builds successfully
 *
 * Usage:
 *   node intake-server/scripts/smoke-test.js          # data checks only
 *   node intake-server/scripts/smoke-test.js --server  # also check intake server health
 *   node intake-server/scripts/smoke-test.js --build   # also verify portal build
 *
 * Exit code 0 = all pass. Exit code 1 = failures found.
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(REPO_ROOT, 'data');
const INTEL_DIR = join(DATA_DIR, 'intelligence');
const TL_DIR = join(DATA_DIR, 'thought-leadership');
const COMP_DIR = join(DATA_DIR, 'competitors');
const LOGOS_DIR = join(REPO_ROOT, 'public', 'logos');

const args = process.argv.slice(2);
const checkServer = args.includes('--server');
const checkBuild = args.includes('--build');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', B = '\x1b[1m', RS = '\x1b[0m';
let passed = 0, failed = 0;
const failures = [];

function pass(msg) { passed++; console.log(`  ${G}✓${RS} ${msg}`); }
function fail(msg, detail) { failed++; failures.push({ msg, detail }); console.log(`  ${R}✗${RS} ${msg}\n    ${detail}`); }

// ── 1. Data file validity ─────────────────────────────────────────────────────

console.log(`\n${B}1. Data file validity${RS}`);

for (const [dir, label] of [[INTEL_DIR, 'intelligence'], [TL_DIR, 'thought-leadership'], [COMP_DIR, 'competitors']]) {
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  let valid = 0, invalid = 0;
  for (const f of files) {
    try {
      JSON.parse(readFileSync(join(dir, f), 'utf8'));
      valid++;
    } catch (e) {
      invalid++;
      fail(`${label}/${f} — invalid JSON`, e.message);
    }
  }
  if (invalid === 0) pass(`${label}: ${valid} files, all valid JSON`);
}

// ── 2. Required fields ────────────────────────────────────────────────────────

console.log(`\n${B}2. Required fields on intelligence entries${RS}`);

const REQUIRED = ['id', 'type', 'headline', 'company', 'company_name', 'date', 'source_url', 'summary'];
const intelFiles = readdirSync(INTEL_DIR).filter(f => f.endsWith('.json'));
let missingFields = 0;
for (const f of intelFiles) {
  const entry = JSON.parse(readFileSync(join(INTEL_DIR, f), 'utf8'));
  for (const field of REQUIRED) {
    if (!entry[field]) {
      missingFields++;
      fail(`${f} missing required field: ${field}`, `value: ${JSON.stringify(entry[field])}`);
    }
  }
}
if (missingFields === 0) pass(`All ${intelFiles.length} entries have all required fields`);

// ── 3. Company slug consistency ───────────────────────────────────────────────

console.log(`\n${B}3. Company slug consistency${RS}`);

const compFiles = new Set(readdirSync(COMP_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')));
// Companies that are valid but not in the landscape (infrastructure providers, retail brokers)
const NON_LANDSCAPE = new Set(['blackrock', 'fnz', 'webull', 'datos-insights']);
let slugMismatches = 0;
for (const f of intelFiles) {
  const entry = JSON.parse(readFileSync(join(INTEL_DIR, f), 'utf8'));
  if (entry.company && !compFiles.has(entry.company) && !NON_LANDSCAPE.has(entry.company)) {
    slugMismatches++;
    fail(`${f} — company "${entry.company}" not in competitors/ or NON_LANDSCAPE`, '');
  }
}
if (slugMismatches === 0) pass(`All company slugs match landscape or are known non-landscape`);

// ── 4. Banned URLs ────────────────────────────────────────────────────────────

console.log(`\n${B}4. Banned URLs${RS}`);

const BANNED = ['unavatar.io', 'clearbit.com'];
let bannedFound = 0;
for (const f of intelFiles) {
  const entry = JSON.parse(readFileSync(join(INTEL_DIR, f), 'utf8'));
  if (entry.image_url) {
    for (const b of BANNED) {
      if (entry.image_url.includes(b)) {
        bannedFound++;
        fail(`${f} has banned URL in image_url`, entry.image_url);
      }
    }
  }
}
if (bannedFound === 0) pass(`No banned URLs found in any image_url field`);

// ── 5. Test artifacts ─────────────────────────────────────────────────────────

console.log(`\n${B}5. Test artifacts${RS}`);

const testArtifacts = intelFiles.filter(f => f.startsWith('_testpub_'));
if (testArtifacts.length > 0) {
  fail(`${testArtifacts.length} test artifact(s) in intelligence/`, testArtifacts.join(', '));
} else {
  pass('No test artifacts in data directories');
}

// ── 6. Server health (optional) ───────────────────────────────────────────────

if (checkServer) {
  console.log(`\n${B}6. Intake server health${RS}`);
  try {
    const res = execSync('curl -sf http://localhost:3003/api/health 2>/dev/null', { timeout: 5000 }).toString();
    const health = JSON.parse(res);
    if (health.ok) {
      pass(`Server healthy — inbox: ${health.queue || 0}, blocked: ${health.blocked || 0}`);
    } else {
      fail('Server returned not-ok', res);
    }
  } catch {
    fail('Intake server not reachable at localhost:3003', 'Start with: cd intake-server && node --env-file=.env server.js');
  }
}

// ── 7. Portal build (optional) ────────────────────────────────────────────────

if (checkBuild) {
  console.log(`\n${B}7. Portal build${RS}`);
  try {
    execSync('npx next build', { cwd: REPO_ROOT, timeout: 120000, stdio: 'pipe' });
    pass('Portal builds successfully');
  } catch (e) {
    fail('Portal build failed', e.stderr?.toString().slice(0, 200) || 'Unknown error');
  }
}

// ── Results ───────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${'─'.repeat(50)}`);
console.log(`${B}Smoke test: ${passed}/${total} passed${RS}${failed > 0 ? `  ${R}${B}${failed} failed${RS}` : ''}`);

if (failures.length > 0) {
  console.log(`\n${R}${B}Failures:${RS}`);
  failures.forEach(f => console.log(`  ${R}✗${RS} ${f.msg}`));
}

console.log();
process.exit(failed > 0 ? 1 : 0);
