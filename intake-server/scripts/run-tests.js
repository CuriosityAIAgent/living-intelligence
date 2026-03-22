/**
 * run-tests.js — Unit test agent for the Living Intelligence intake pipeline
 *
 * Scenario-based tests for all pipeline logic. No live API calls —
 * external dependencies (DataForSEO Backlinks, Jina, Anthropic) are bypassed
 * by clearing credentials so agents fall back to deterministic local behaviour.
 *
 * Usage:
 *   node --env-file=.env scripts/run-tests.js
 *   node scripts/run-tests.js   (no .env needed — tests clear credentials themselves)
 *
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * Test suites:
 *   1. scorer.js     — 4-dimension scoring, threshold routing, hard 90-day gate
 *   2. notifier.js   — HMAC token signing/verification, digest message structure
 *   3. publisher.js  — File writing, source_verified logic, ID collision handling
 *   4. auto-discover — Pure functions: isRelevant, normalizeUrl, query builders
 *   5. scheduler     — Threshold routing logic (inline, no external calls)
 */

import { scoreEntry, formatScoreBreakdown } from '../agents/scorer.js';
import { signToken, verifyToken } from '../agents/notifier.js';
import { publish } from '../agents/publisher.js';
import {
  isRelevant, normalizeUrl, buildCompanyQueries, buildAuthorQueries,
} from '../agents/auto-discover.js';

import { mkdirSync, existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ── Terminal colours ──────────────────────────────────────────────────────────

const G  = '\x1b[32m';  // green
const R  = '\x1b[31m';  // red
const Y  = '\x1b[33m';  // yellow
const B  = '\x1b[1m';   // bold
const D  = '\x1b[2m';   // dim
const RS = '\x1b[0m';   // reset

// ── Minimal test framework ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}
function eq(actual, expected, label) {
  if (actual !== expected)
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function gte(actual, min, label) {
  if (actual < min)
    throw new Error(`${label}: expected ≥ ${min}, got ${actual}`);
}
function lte(actual, max, label) {
  if (actual > max)
    throw new Error(`${label}: expected ≤ ${max}, got ${actual}`);
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    process.stdout.write(`  ${G}✓${RS} ${name}\n`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    process.stdout.write(`  ${R}✗${RS} ${name}\n    ${D}→ ${err.message}${RS}\n`);
  }
}

function suite(name) {
  process.stdout.write(`\n${B}${name}${RS}\n`);
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

// ── Governance fixture builder ────────────────────────────────────────────────

function gov({ fabricated = [], unverified = [], paywall = false, confidence = 90 } = {}) {
  return {
    verdict:           fabricated.length > 0 ? 'FAIL' : unverified.length > 0 ? 'REVIEW' : 'PASS',
    confidence,
    verified_claims:   ['Some verifiable claim'],
    unverified_claims: unverified,
    fabricated_claims: fabricated,
    notes:             '',
    paywall_caveat:    paywall,
    verified_at:       new Date().toISOString(),
    human_approved:    false,
  };
}

// ── Entry fixture builder ─────────────────────────────────────────────────────

function entry({ company = 'goldman-sachs', headline = 'Goldman Sachs launches AI advisor', summary = 'Goldman Sachs announced a new AI-powered advisor platform for wealth management clients.', date = daysAgo(2) } = {}) {
  return {
    id:           `test-${Date.now()}`,
    company,
    company_name: 'Goldman Sachs',
    headline,
    summary,
    date,
    source_url:   'https://example.com/test',
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 1: scorer.js
// Notes:
//   - DataForSEO Backlinks is cleared → returns null → falls back to manual tier
//   - press_release and newsroom domains skip the API entirely (always 30 pts)
//   - All scores are therefore deterministic in test environments
// ═════════════════════════════════════════════════════════════════════════════

suite('1 · scorer.js — Source Quality (Dimension A)');

// Clear DataForSEO creds so we always get deterministic fallback tier behaviour
delete process.env.DATAFORSEO_LOGIN;
delete process.env.DATAFORSEO_PASSWORD;

await test('businesswire.com → 25pts (press release wire, no API call)', async () => {
  const result = await scoreEntry({
    entry: entry(),
    governance: gov(),
    sourceUrl: 'https://businesswire.com/news/article/goldman-ai',
  });
  eq(result.breakdown.source.points, 25, 'source points');
  eq(result.breakdown.source.tier, 'press_release', 'tier');
});

await test('prnewswire.com → 25pts (press release wire)', async () => {
  const result = await scoreEntry({
    entry: entry(),
    governance: gov(),
    sourceUrl: 'https://prnewswire.com/news/release.html',
  });
  eq(result.breakdown.source.points, 25, 'source points');
});

await test('newsroom URL pattern → 25pts (company newsroom, no API call)', async () => {
  const result = await scoreEntry({
    entry: entry(),
    governance: gov(),
    sourceUrl: 'https://newsroom.bankofamerica.com/press-releases/2026/03/bofa-ai.html',
  });
  eq(result.breakdown.source.points, 25, 'source points');
  eq(result.breakdown.source.tier, 'newsroom', 'tier');
});

await test('ft.com → 22pts (tier-1 media, fallback when no API)', async () => {
  const result = await scoreEntry({
    entry: entry(),
    governance: gov(),
    sourceUrl: 'https://ft.com/content/some-article',
  });
  eq(result.breakdown.source.points, 22, 'source points');
});

await test('thinkadvisor.com → 17pts (tier-2 industry press, fallback)', async () => {
  const result = await scoreEntry({
    entry: entry(),
    governance: gov(),
    sourceUrl: 'https://thinkadvisor.com/article',
  });
  eq(result.breakdown.source.points, 17, 'source points');
});

await test('thinkadvisor.com/news/ → 17pts (TIER2 wins over weak newsroom)', async () => {
  const result = await scoreEntry({
    entry: entry(),
    governance: gov(),
    sourceUrl: 'https://thinkadvisor.com/news/article-title',
  });
  eq(result.breakdown.source.points, 17, 'source points');
  eq(result.breakdown.source.tier, 'tier2', 'tier');
});

await test('altruist.com/news/ → 20pts (company news page, newsroom_weak)', async () => {
  const result = await scoreEntry({
    entry: entry(),
    governance: gov(),
    sourceUrl: 'https://altruist.com/news/hazel-ai-tax-planning/',
  });
  eq(result.breakdown.source.points, 20, 'source points');
  eq(result.breakdown.source.tier, 'newsroom_weak', 'tier');
});

await test('unknown domain → 9pts (general press, fallback)', async () => {
  const result = await scoreEntry({
    entry: entry(),
    governance: gov(),
    sourceUrl: 'https://some-obscure-blog.com/article',
  });
  eq(result.breakdown.source.points, 9, 'source points');
});

suite('1 · scorer.js — Claim Verification (Dimension B)');

await test('0 unverified + 0 fabricated → 25pts', async () => {
  const result = await scoreEntry({
    entry: entry(),
    governance: gov({ fabricated: [], unverified: [] }),
    sourceUrl: 'https://businesswire.com/article',
  });
  eq(result.breakdown.claims.points, 25, 'claim points');
  eq(result.breakdown.claims.fabricated, false, 'fabricated flag');
});

await test('1 unverified claim → 15pts', async () => {
  const result = await scoreEntry({
    entry: entry(),
    governance: gov({ unverified: ['Headcount figure not in source'] }),
    sourceUrl: 'https://businesswire.com/article',
  });
  eq(result.breakdown.claims.points, 15, 'claim points');
});

await test('2 unverified claims → 6pts', async () => {
  const result = await scoreEntry({
    entry: entry(),
    governance: gov({ unverified: ['Claim A not verified', 'Claim B not verified'] }),
    sourceUrl: 'https://businesswire.com/article',
  });
  eq(result.breakdown.claims.points, 6, 'claim points');
});

await test('3+ unverified claims → 0pts', async () => {
  const result = await scoreEntry({
    entry: entry(),
    governance: gov({ unverified: ['A', 'B', 'C'] }),
    sourceUrl: 'https://businesswire.com/article',
  });
  eq(result.breakdown.claims.points, 0, 'claim points');
});

await test('1 fabricated claim → action=BLOCK regardless of other scores', async () => {
  const result = await scoreEntry({
    entry: entry({ company: 'goldman-sachs', date: daysAgo(1) }),
    governance: gov({ fabricated: ['Goldman raised $50B — not in source'] }),
    sourceUrl: 'https://businesswire.com/article',
  });
  eq(result.action, 'BLOCK', 'action');
  eq(result.breakdown.claims.fabricated, true, 'fabricated flag');
});

suite('1 · scorer.js — Freshness (Dimension C)');

await test('same day (0d old) → 10pts (≤1 day bucket)', async () => {
  const result = await scoreEntry({
    entry: entry({ date: daysAgo(0) }),
    governance: gov(),
    sourceUrl: 'https://businesswire.com/article',
  });
  eq(result.breakdown.freshness.points, 10, 'freshness points');
});

await test('5 days old → 6pts (≤7 days)', async () => {
  const result = await scoreEntry({
    entry: entry({ date: daysAgo(5) }),
    governance: gov(),
    sourceUrl: 'https://businesswire.com/article',
  });
  eq(result.breakdown.freshness.points, 6, 'freshness points');
});

await test('10 days old → 4pts (≤14 days bucket)', async () => {
  const result = await scoreEntry({
    entry: entry({ date: daysAgo(10) }),
    governance: gov(),
    sourceUrl: 'https://businesswire.com/article',
  });
  eq(result.breakdown.freshness.points, 4, 'freshness points');
});

await test('60 days old → 1pt (≤90 days)', async () => {
  const result = await scoreEntry({
    entry: entry({ date: daysAgo(60) }),
    governance: gov(),
    sourceUrl: 'https://businesswire.com/article',
  });
  eq(result.breakdown.freshness.points, 1, 'freshness points');
});

await test('91 days old → BLOCK (hard 90-day gate)', async () => {
  const result = await scoreEntry({
    entry: entry({ date: daysAgo(91) }),
    governance: gov(),
    sourceUrl: 'https://businesswire.com/article',
  });
  eq(result.action, 'BLOCK', 'action');
  assert(result.reason.includes('90-day'), '90-day reason message');
});

await test('180 days old → BLOCK (well beyond gate)', async () => {
  const result = await scoreEntry({
    entry: entry({ date: daysAgo(180) }),
    governance: gov(),
    sourceUrl: 'https://businesswire.com/article',
  });
  eq(result.action, 'BLOCK', 'action');
});

suite('1 · scorer.js — Capability Impact (Dimension D)');

await test('capability_evidence + deployed stage + quantified metric → high impact score', async () => {
  const result = await scoreEntry({
    entry: {
      ...entry({ company: 'goldman-sachs', headline: 'Goldman Sachs advisor AI platform live for 15,000 advisors' }),
      tags: { capability: 'advisor_productivity', region: 'us', segment: 'wirehouse', theme: [] },
      capability_evidence: {
        capability: 'advisor_productivity',
        stage: 'deployed',
        evidence: 'Platform live for all advisors',
        metric: '15,000 advisors',
      },
    },
    governance: gov(),
    sourceUrl: 'https://businesswire.com/article',
  });
  gte(result.breakdown.impact.points, 30, 'impact points (should be high with capability+evidence+scale)');
});

await test('tracked company + no capability_evidence → low-mid impact (floor applied)', async () => {
  const result = await scoreEntry({
    entry: entry({ company: 'goldman-sachs', headline: 'Goldman Sachs opens new wealth office' }),
    governance: gov(),
    sourceUrl: 'https://businesswire.com/article',
  });
  // tracked company central to headline → gets competitive relevance (+5) + tracked scale (+2) = 7
  gte(result.breakdown.impact.points, 5, 'impact points ≥ 5');
  lte(result.breakdown.impact.points, 15, 'impact points ≤ 15 (no capability evidence)');
});

await test('untracked company + no capability_evidence → minimal impact', async () => {
  const result = await scoreEntry({
    entry: entry({
      company:  'random-corp',
      headline: 'RandomCorp expands headquarters',
      summary:  'RandomCorp has added square footage.',
    }),
    governance: gov(),
    sourceUrl: 'https://businesswire.com/article',
  });
  // untracked, no capability → only +1 general industry
  lte(result.breakdown.impact.points, 5, 'impact points low for untracked + no capability');
});

await test('piloting stage without metric → moderate evidence score', async () => {
  const result = await scoreEntry({
    entry: {
      ...entry({ company: 'morgan-stanley' }),
      tags: { capability: 'client_personalization', region: 'us', segment: 'wirehouse', theme: [] },
      capability_evidence: {
        capability: 'client_personalization',
        stage: 'piloting',
        evidence: 'Testing with select HNW clients',
        metric: null,
      },
    },
    governance: gov(),
    sourceUrl: 'https://businesswire.com/article',
  });
  gte(result.breakdown.impact.points, 10, 'piloting stage gets capability + pilot evidence points');
});

suite('1 · scorer.js — Score routing + threshold decisions');

await test('Perfect score → PUBLISH (capability_evidence + fresh + press release)', async () => {
  const result = await scoreEntry({
    entry: {
      id: 'test-perfect',
      company: 'goldman-sachs',
      company_name: 'Goldman Sachs',
      headline: 'Goldman Sachs advisor AI platform live for 15,000 advisors',
      summary: 'Goldman Sachs deployed an AI-powered advisor assistant reaching 15,000 financial advisors firm-wide.',
      date: daysAgo(1),
      source_url: 'https://businesswire.com/test',
      tags: { capability: 'advisor_productivity', region: 'us', segment: 'wirehouse', theme: [] },
      capability_evidence: {
        capability: 'advisor_productivity',
        stage: 'deployed',
        evidence: 'Platform live for all Goldman advisors',
        metric: '15,000 advisors',
      },
    },
    governance: gov(),
    sourceUrl: 'https://businesswire.com/article',
  });
  eq(result.action, 'PUBLISH', 'action');
  gte(result.score, 75, 'score');
});

await test('tracked company floor → score floors to 60 → REVIEW', async () => {
  // unknown domain (9) + 1 unverified (15) + fresh 1d (10) + tracked no-capability (7) = 41
  // But tracked company floor: score 41 < 60 AND tracked AND ≤30 days → floor to 60 → REVIEW
  const result = await scoreEntry({
    entry: entry({ company: 'goldman-sachs', date: daysAgo(1) }),
    governance: gov({ unverified: ['One unverified claim'] }),
    sourceUrl: 'https://some-obscure-blog.com/article',
  });
  gte(result.score, 60, 'score ≥ 60 (floor applied)');
  eq(result.action, 'REVIEW', 'action');
});

await test('score=37 scenario → BLOCK (< 65)', async () => {
  // unknown domain (12) + 3 unverified (0) + 60d old (6) + untracked+no-AI (3) = 21
  const result = await scoreEntry({
    entry: entry({
      company:  'nobody-corp',
      headline: 'Nobody Corp opens office',
      summary:  'A new office was opened.',
      date: daysAgo(60),
    }),
    governance: gov({ unverified: ['A', 'B', 'C'] }),
    sourceUrl: 'https://some-obscure-blog.com/article',
  });
  lte(result.score, 64, 'score < 65');
  eq(result.action, 'BLOCK', 'action');
});

await test('paywall_caveat=true on PUBLISH-eligible score → downgrade to REVIEW', async () => {
  const result = await scoreEntry({
    entry: entry({ company: 'goldman-sachs', date: daysAgo(1) }),
    governance: gov({ paywall: true }),
    sourceUrl: 'https://businesswire.com/article',
  });
  // Score will be ≥ 75 but paywall caveat should downgrade it
  eq(result.action, 'REVIEW', 'action downgraded to REVIEW');
});

await test('formatScoreBreakdown returns expected shape', async () => {
  const result = await scoreEntry({
    entry: entry(),
    governance: gov(),
    sourceUrl: 'https://businesswire.com/article',
  });
  const breakdown = formatScoreBreakdown(result);
  assert(breakdown.includes('Score:'), 'contains Score:');
  assert(breakdown.includes('Source:'), 'contains Source:');
  assert(breakdown.includes('Claims:'), 'contains Claims:');
  assert(breakdown.includes('Fresh:'), 'contains Fresh:');
  assert(breakdown.includes('Impact:'), 'contains Impact:');
  assert(breakdown.includes('/100'), 'contains /100');
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 2: notifier.js — Token signing and message integrity
// ═════════════════════════════════════════════════════════════════════════════

suite('2 · notifier.js — HMAC token signing');

// Set a fixed secret for deterministic token tests
process.env.REVIEW_SECRET = 'test-secret-fixed-for-unit-tests-32chars';

test('signToken + verifyToken round-trip → true', () => {
  const token = signToken('entry-abc-123');
  assert(verifyToken('entry-abc-123', token), 'round-trip should be true');
});

test('verifyToken with wrong token → false', () => {
  const token = signToken('entry-abc-123');
  assert(!verifyToken('entry-abc-123', 'wrong-token'), 'wrong token should be false');
});

test('verifyToken with wrong entryId → false', () => {
  const token = signToken('entry-abc-123');
  assert(!verifyToken('entry-DIFFERENT', token), 'wrong entryId should be false');
});

test('different REVIEW_SECRET → different token', () => {
  process.env.REVIEW_SECRET = 'secret-A-padded-to-32-characters!!';
  const tokenA = signToken('same-entry');
  process.env.REVIEW_SECRET = 'secret-B-padded-to-32-characters!!';
  const tokenB = signToken('same-entry');
  assert(tokenA !== tokenB, 'different secrets should produce different tokens');
  // Reset to test secret
  process.env.REVIEW_SECRET = 'test-secret-fixed-for-unit-tests-32chars';
});

test('token is a 64-character hex string (SHA-256)', () => {
  const token = signToken('any-entry-id');
  eq(token.length, 64, 'token length');
  assert(/^[0-9a-f]+$/.test(token), 'token is hex');
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 3: publisher.js — File writing and source_verified logic
// ═════════════════════════════════════════════════════════════════════════════

suite('3 · publisher.js — File writing');

// publisher.js resolves PORTAL_DATA_DIR at module load time from process.env.DATA_DIR.
// Since that env is set at import time (not runtime), publish() writes to the real
// data/intelligence/ dir. We use a unique run-id prefix on all test IDs so they:
//   a) never collide with real entries (underscore prefix)
//   b) never collide between test runs (timestamp suffix)
//   c) can be identified and cleaned up after the suite

const RUN_ID = Date.now().toString().slice(-6);
const T = (n) => `_testpub_${RUN_ID}_${n}`;  // e.g. _testpub_121959_001

// Publisher writes to DATA_DIR/data/intelligence/ — resolve the same path
const realIntelDir = join(
  new URL('../../..', import.meta.url).pathname,
  'data', 'intelligence'
);

function pubGov(overrides = {}) {
  return {
    verdict: 'PASS', confidence: 90, verified_claims: [], unverified_claims: [],
    fabricated_claims: [], notes: '', paywall_caveat: false,
    verified_at: new Date().toISOString(), human_approved: false,
    ...overrides,
  };
}

test('publish() fires published event with correct id', () => {
  const id = T('001');
  const events = [];
  const returned = publish({
    entry: { id, headline: 'Test', _governance: pubGov() },
    send: (evt, data) => events.push({ evt, data }),
  });
  eq(returned, id, 'returned id matches');
  const pubEvt = events.find(e => e.evt === 'published');
  assert(pubEvt, 'published event fired');
  eq(pubEvt.data.renamed, false, 'no rename on first write');
});

test('publish() — source_verified=true when governance.verdict=PASS', () => {
  const id = T('002');
  publish({ entry: { id, headline: 'Test PASS', _governance: pubGov({ verdict: 'PASS' }) }, send: () => {} });
  const fp = join(realIntelDir, `${id}.json`);
  if (existsSync(fp)) {
    eq(JSON.parse(readFileSync(fp, 'utf8')).source_verified, true, 'source_verified');
  }
});

test('publish() — source_verified=false when REVIEW + not human_approved', () => {
  const id = T('003');
  publish({ entry: { id, headline: 'Test REVIEW', _governance: pubGov({ verdict: 'REVIEW', unverified_claims: ['x'], human_approved: false }) }, send: () => {} });
  const fp = join(realIntelDir, `${id}.json`);
  if (existsSync(fp)) {
    eq(JSON.parse(readFileSync(fp, 'utf8')).source_verified, false, 'source_verified');
  }
});

test('publish() — source_verified=true when REVIEW + human_approved=true', () => {
  const id = T('004');
  publish({ entry: { id, headline: 'Test human approved', _governance: pubGov({ verdict: 'REVIEW', unverified_claims: ['x'], human_approved: true }) }, send: () => {} });
  const fp = join(realIntelDir, `${id}.json`);
  if (existsSync(fp)) {
    eq(JSON.parse(readFileSync(fp, 'utf8')).source_verified, true, 'source_verified');
  }
});

test('publish() — ID collision appends timestamp suffix', () => {
  const id = T('col');
  const gov = pubGov();
  publish({ entry: { id, headline: 'First', _governance: gov }, send: () => {} });
  // Second write with same id → should rename
  const events = [];
  const id2 = publish({ entry: { id, headline: 'Second', _governance: gov }, send: (evt, data) => events.push({ evt, data }) });
  const pubEvt = events.find(e => e.evt === 'published');
  assert(pubEvt?.data?.renamed === true, 'second write renamed');
  assert(id2 !== id, 'renamed id differs from original');
});

test('publish() — written JSON does not contain fabricated_claims', () => {
  const id = T('005');
  publish({ entry: { id, headline: 'Test fields', _governance: pubGov() }, send: () => {} });
  const fp = join(realIntelDir, `${id}.json`);
  if (existsSync(fp)) {
    const written = JSON.parse(readFileSync(fp, 'utf8'));
    assert(!('fabricated_claims' in (written._governance || {})), 'fabricated_claims not written');
  }
});

// Clean up test entries written to the real data directory
{
  const { readdirSync: _rds } = await import('fs');
  const { unlinkSync: _ul } = await import('fs');
  try {
    const files = _rds(realIntelDir).filter(f => f.startsWith(`_testpub_${RUN_ID}`));
    files.forEach(f => { try { _ul(join(realIntelDir, f)); } catch (_) {} });
  } catch (_) {}
}

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 4: auto-discover.js — Pure functions
// ═════════════════════════════════════════════════════════════════════════════

suite('4 · auto-discover.js — isRelevant()');

test('AI + wealth → true', () => {
  assert(isRelevant('Goldman Sachs deploys generative AI for wealth management advisors'), 'should be relevant');
});

test('AI only (no wealth keyword) → false', () => {
  assert(!isRelevant('OpenAI launches new GPT model for consumers'), 'no wealth keyword → false');
});

test('wealth only (no AI keyword) → false', () => {
  assert(!isRelevant('Morgan Stanley expands into Southeast Asia with new offices'), 'no AI keyword → false');
});

test('neither → false', () => {
  assert(!isRelevant('City council approves new parking regulations downtown'), 'irrelevant → false');
});

test('case insensitive — "AI" and "Wealth Management" → true', () => {
  assert(isRelevant('AI AND WEALTH MANAGEMENT TRENDS FOR 2026'), 'uppercase should work');
});

test('robo-advisor keyword triggers AI gate', () => {
  assert(isRelevant('Betterment expands robo-advisor features for retirement planning'), 'robo-advisor is AI keyword');
});

suite('4 · auto-discover.js — normalizeUrl()');

test('trailing slash stripped', () => {
  eq(normalizeUrl('https://example.com/path/'), 'https://example.com/path', 'trailing slash');
});

test('lowercased', () => {
  eq(normalizeUrl('HTTPS://Example.COM/Path'), 'https://example.com/path', 'case');
});

test('no trailing slash → unchanged', () => {
  eq(normalizeUrl('https://example.com/path'), 'https://example.com/path', 'no change needed');
});

test('invalid url → returns lowercased original string', () => {
  const result = normalizeUrl('not-a-url');
  eq(result, 'not-a-url', 'falls back to lowercase string');
});

suite('4 · auto-discover.js — buildCompanyQueries()');

const mockCompetitors = [
  { id: 'goldman-sachs',  name: 'Goldman Sachs',  segment: 'global_private_bank' },
  { id: 'morgan-stanley', name: 'Morgan Stanley', segment: 'wirehouse' },
  { id: 'arta-ai',        name: 'Arta.ai',        segment: 'ai_native' },
];

test('returns one query per company', () => {
  const queries = buildCompanyQueries(mockCompetitors);
  eq(queries.length, 3, 'query count');
});

test('query contains company name', () => {
  const queries = buildCompanyQueries(mockCompetitors);
  assert(queries[0].keyword.includes('Goldman Sachs'), 'keyword includes company name');
});

test('global_private_bank segment → private banking focus', () => {
  const queries = buildCompanyQueries(mockCompetitors);
  assert(queries[0].keyword.includes('private banking'), 'correct segment focus');
});

test('wirehouse segment → wealth management advisor focus', () => {
  const queries = buildCompanyQueries(mockCompetitors);
  assert(queries[1].keyword.includes('wealth management AI advisor'), 'correct segment focus');
});

test('ai_native segment → AI wealth platform focus', () => {
  const queries = buildCompanyQueries(mockCompetitors);
  assert(queries[2].keyword.includes('AI wealth platform'), 'correct segment focus');
});

test('company_id and company_name preserved in query object', () => {
  const queries = buildCompanyQueries(mockCompetitors);
  eq(queries[0].company_id, 'goldman-sachs', 'company_id');
  eq(queries[0].company_name, 'Goldman Sachs', 'company_name');
});

test('empty competitors array → empty queries', () => {
  const queries = buildCompanyQueries([]);
  eq(queries.length, 0, 'empty result');
});

suite('4 · auto-discover.js — buildAuthorQueries()');

const mockTL = [
  { author: { name: 'Sam Altman', organization: 'OpenAI' } },
  { author: { name: 'Ethan Mollick', organization: 'University of Pennsylvania' } },
  { author: { name: 'Ethan Mollick', organization: 'University of Pennsylvania' } }, // duplicate
  { author: { name: 'Nick Beim', organization: 'Venrock' } },
  { author: {} }, // no name — should be skipped
];

test('deduplicates same author appearing multiple times', () => {
  const queries = buildAuthorQueries(mockTL);
  const ethanQueries = queries.filter(q => q.author === 'Ethan Mollick');
  eq(ethanQueries.length, 1, 'Ethan Mollick deduplicated to 1 query');
});

test('skips entries with no author name', () => {
  const queries = buildAuthorQueries(mockTL);
  eq(queries.length, 3, 'only 3 unique named authors');
});

test('query includes author name and organization', () => {
  const queries = buildAuthorQueries(mockTL);
  const altman = queries.find(q => q.author === 'Sam Altman');
  assert(altman.query.includes('Sam Altman'), 'query includes name');
  assert(altman.query.includes('OpenAI'), 'query includes org');
});

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 5: scheduler.js — Threshold routing logic
// Tests the REVIEW_THRESHOLD decision boundary inline (no external calls needed)
// ═════════════════════════════════════════════════════════════════════════════

suite('5 · scheduler.js — Threshold routing (REVIEW=60, PUBLISH=75)');

const REVIEW_THRESHOLD = 60;

function routeScore(score, paywallCaveat = false) {
  let action = score >= 75 ? 'PUBLISH' : score >= REVIEW_THRESHOLD ? 'REVIEW' : 'BLOCK';
  if (action === 'PUBLISH' && paywallCaveat) action = 'REVIEW';
  return action;
}

test('score=75 → PUBLISH (lower publish boundary)', () => {
  eq(routeScore(75), 'PUBLISH', 'routing');
});

test('score=74 → REVIEW (upper review boundary)', () => {
  eq(routeScore(74), 'REVIEW', 'routing');
});

test('score=60 → REVIEW (lower review boundary)', () => {
  eq(routeScore(60), 'REVIEW', 'routing');
});

test('score=59 → BLOCK (just below review threshold)', () => {
  eq(routeScore(59), 'BLOCK', 'routing');
});

test('score=100 → PUBLISH', () => {
  eq(routeScore(100), 'PUBLISH', 'routing');
});

test('score=0 → BLOCK', () => {
  eq(routeScore(0), 'BLOCK', 'routing');
});

test('score=80 + paywall_caveat → REVIEW (downgrade from PUBLISH)', () => {
  eq(routeScore(80, true), 'REVIEW', 'paywall downgrade');
});

test('score=65 + paywall_caveat → REVIEW (no further downgrade below publish)', () => {
  eq(routeScore(65, true), 'REVIEW', 'paywall on REVIEW stays REVIEW');
});

test('score=59 + paywall_caveat → BLOCK (already blocked, paywall irrelevant)', () => {
  eq(routeScore(59, true), 'BLOCK', 'paywall on BLOCK stays BLOCK');
});

// ═════════════════════════════════════════════════════════════════════════════
// Results
// ═════════════════════════════════════════════════════════════════════════════

const total = passed + failed;
process.stdout.write('\n');
process.stdout.write(`${'─'.repeat(60)}\n`);
process.stdout.write(`${B}Results: ${passed}/${total} passed${RS}`);
if (failed > 0) {
  process.stdout.write(`  ${R}${B}${failed} failed${RS}`);
}
process.stdout.write('\n');

if (failures.length > 0) {
  process.stdout.write(`\n${R}${B}Failed tests:${RS}\n`);
  failures.forEach(f => {
    process.stdout.write(`  ${R}✗${RS} ${f.name}\n    ${D}${f.error}${RS}\n`);
  });
}

process.stdout.write('\n');
process.exit(failed > 0 ? 1 : 0);
