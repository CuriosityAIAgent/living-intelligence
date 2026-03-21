/**
 * scorer.js — Auto-judgment layer
 *
 * Scores each processed entry across 4 dimensions and decides:
 *   PUBLISH (score >= 75) — auto-publish, no Telegram notification
 *   REVIEW  (score 50–74) — send to Telegram with full breakdown so human can decide fast
 *   BLOCK   (score < 50 or any fabricated claims) — permanently block URL
 *
 * Dimension A: Source Quality — uses DataForSEO Backlinks API for live domain authority.
 *   Falls back to manual tier list when API unavailable.
 *   Results are cached in-memory for the duration of a pipeline run (one lookup per domain).
 */

import fetch from 'node-fetch';

// ── DataForSEO Backlinks API — live domain authority ──────────────────────────

// Cache domain authority for the duration of a process run (avoids duplicate API calls)
const domainAuthorityCache = new Map();

async function getDomainAuthority(hostname) {
  if (!hostname) return null;
  if (domainAuthorityCache.has(hostname)) return domainAuthorityCache.get(hostname);

  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) return null;

  const AUTH = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64');

  try {
    const res = await fetch('https://api.dataforseo.com/v3/backlinks/summary/live', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ target: hostname, limit: 1 }]),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { domainAuthorityCache.set(hostname, null); return null; }
    const data = await res.json();
    const result = data?.tasks?.[0]?.result?.[0] || null;
    const authority = result ? {
      rank:        result.rank          || 0,
      spam_score:  result.spam_score    || 0,
      ref_domains: result.referring_domains || 0,
    } : null;
    domainAuthorityCache.set(hostname, authority);
    return authority;
  } catch (_) {
    domainAuthorityCache.set(hostname, null);
    return null;
  }
}

// ── Fallback manual tier list (used when Backlinks API unavailable) ───────────

const PRESS_RELEASE_DOMAINS = new Set([
  'businesswire.com', 'prnewswire.com', 'globenewswire.com', 'accesswire.com',
]);

const NEWSROOM_PATTERNS = [
  'newsroom.', '.newsroom.', '/newsroom', '/news-releases', '/press-releases',
  '/press-release', '/investor-relations', '/media-centre', '/media-center',
  'investor.', 'press.', 'ir.',
];

const TIER1_MEDIA = new Set([
  'bloomberg.com', 'reuters.com', 'ft.com', 'wsj.com', 'cnbc.com',
  'fortune.com', 'businessinsider.com', 'axios.com', 'nytimes.com',
]);

const TIER2_MEDIA = new Set([
  'riabiz.com', 'thinkadvisor.com', 'investmentnews.com', 'wealthmanagement.com',
  'financial-planning.com', 'advisorperspectives.com', 'advisorhub.com',
  'citywire.com', 'wealthbriefing.com', 'wealthprofessional.ca',
  'fintech.global', 'pymnts.com', 'tearsheet.co', 'bankingdive.com',
  'techcrunch.com', 'theblock.co', 'wealthtechtoday.com', 'fintechnexus.com',
]);

function fallbackSourceScore(hostname, fullUrl) {
  if (PRESS_RELEASE_DOMAINS.has(hostname)) return { points: 30, label: `Press release wire (${hostname})`, tier: 'press_release' };
  if (NEWSROOM_PATTERNS.some(p => fullUrl.includes(p))) return { points: 30, label: `Company newsroom (${hostname})`, tier: 'newsroom' };
  if (TIER1_MEDIA.has(hostname)) return { points: 25, label: `Tier 1 media (${hostname})`, tier: 'tier1' };
  if (TIER2_MEDIA.has(hostname)) return { points: 20, label: `Industry press (${hostname})`, tier: 'tier2' };
  return { points: 12, label: `General press (${hostname})`, tier: 'general' };
}

// ── Dimension A: Source Quality (0–30) ───────────────────────────────────────

async function scoreSourceQuality(sourceUrl) {
  let hostname = '';
  let fullUrl = '';
  try {
    const u = new URL(sourceUrl);
    hostname = u.hostname.replace(/^www\./, '');
    fullUrl = sourceUrl.toLowerCase();
  } catch (_) {
    return { points: 5, label: 'Unrecognised source', tier: 'unknown' };
  }

  // Press releases and newsrooms: always 30 — no API call needed
  if (PRESS_RELEASE_DOMAINS.has(hostname)) {
    return { points: 30, label: `Press release wire (${hostname})`, tier: 'press_release' };
  }
  if (NEWSROOM_PATTERNS.some(p => fullUrl.includes(p))) {
    return { points: 30, label: `Company newsroom (${hostname})`, tier: 'newsroom' };
  }

  // For all other domains, try DataForSEO Backlinks for real domain authority
  const authority = await getDomainAuthority(hostname);

  if (authority) {
    // Spam filter: high spam score → low trust regardless of rank
    if (authority.spam_score >= 40) {
      return { points: 3, label: `Flagged source (spam ${authority.spam_score}) (${hostname})`, tier: 'spam' };
    }

    // Map domain rank (0–100) to points
    let points, tier;
    if (authority.rank >= 70)      { points = 28; tier = 'high_authority'; }
    else if (authority.rank >= 50) { points = 22; tier = 'mid_authority'; }
    else if (authority.rank >= 30) { points = 14; tier = 'low_authority'; }
    else                           { points = 7;  tier = 'very_low_authority'; }

    return {
      points,
      label: `${hostname} (rank ${authority.rank}, spam ${authority.spam_score})`,
      tier,
    };
  }

  // API unavailable — fall back to manual tier list
  return fallbackSourceScore(hostname, fullUrl);
}

// ── Dimension B: Claim Verification (0–30, or -100 for fabrications) ─────────

function scoreClaimVerification(governance) {
  const fabricated = governance.fabricated_claims || [];
  const unverified = governance.unverified_claims || [];

  if (fabricated.length > 0) {
    return { points: -100, label: `${fabricated.length} fabricated claim(s)`, fabricated: true };
  }
  if (unverified.length === 0) return { points: 30, label: 'All claims verified', fabricated: false };
  if (unverified.length === 1) return { points: 18, label: '1 unverified claim', fabricated: false };
  if (unverified.length === 2) return { points: 8,  label: '2 unverified claims', fabricated: false };
  return { points: 0, label: `${unverified.length} unverified claims`, fabricated: false };
}

// ── Dimension C: Content Freshness (0–20) ────────────────────────────────────

function scoreFreshness(dateStr) {
  if (!dateStr) return { points: 0, label: 'Date unknown' };
  const articleDate = new Date(dateStr);
  if (isNaN(articleDate)) return { points: 0, label: 'Invalid date' };
  const ageDays = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 7)  return { points: 20, label: `${Math.round(ageDays)}d old` };
  if (ageDays <= 30) return { points: 14, label: `${Math.round(ageDays)}d old` };
  if (ageDays <= 90) return { points: 6,  label: `${Math.round(ageDays)}d old` };
  return { points: 0, label: `${Math.round(ageDays)}d old — stale` };
}

// ── Dimension D: Relevance Signal (0–20) ─────────────────────────────────────

// Hardcoded fallback IDs — used when file loading fails
const TRACKED_IDS_FALLBACK = new Set([
  'goldman-sachs', 'morgan-stanley', 'jpmorgan', 'bofa-merrill', 'ubs',
  'wells-fargo', 'citi-private-bank', 'hsbc', 'julius-baer', 'bnp-paribas-wealth',
  'dbs', 'bbva', 'rbc-wealth-management', 'standard-chartered',
  'altruist', 'lpl-financial', 'robinhood', 'wealthfront', 'etoro', 'public-com',
  'arta-ai', 'savvy-wealth', 'jump-ai', 'nevis', 'zocks', 'holistiplan',
  'conquest-planning',
]);

// Loaded at startup from data/competitors/*.json — includes display names
// e.g. "jump" (from jump-ai.json name field) so "jump" matches correctly
let TRACKED_IDS   = new Set(TRACKED_IDS_FALLBACK);
let TRACKED_NAMES = new Set(); // lowercased display names: "jump", "lpl financial", etc.

try {
  const fs   = await import('fs');
  const path = await import('path');
  const dataDir = process.env.PORTAL_DATA_DIR
    || path.default.join(path.default.dirname(new URL(import.meta.url).pathname), '../../data');
  const dir   = path.default.join(dataDir, 'competitors');
  const files = fs.default.readdirSync(dir).filter(f => f.endsWith('.json'));
  TRACKED_IDS   = new Set();
  TRACKED_NAMES = new Set();
  for (const f of files) {
    const c = JSON.parse(fs.default.readFileSync(path.default.join(dir, f), 'utf8'));
    if (c.id)   TRACKED_IDS.add(c.id.toLowerCase());
    if (c.name) TRACKED_NAMES.add(c.name.toLowerCase());
  }
} catch (_) {
  // File loading failed — use hardcoded fallback, TRACKED_NAMES stays empty
}

function isTrackedCompany(entry) {
  const id   = (entry.company      || '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const name = (entry.company_name || '').toLowerCase();
  if (TRACKED_IDS.has(id))     return true;
  if (TRACKED_NAMES.has(name)) return true;
  // Partial ID match: "jump" matches "jump-ai", "bofa" matches "bofa-merrill"
  for (const tid of TRACKED_IDS) {
    if (id.length >= 3 && (tid.startsWith(id) || id.startsWith(tid))) return true;
  }
  return false;
}

const SPECIFIC_AI_SIGNALS = [
  'launch', 'launches', 'launched', 'deploy', 'deployed', 'announces', 'announced',
  'million users', 'billion interactions', 'billion', 'million', '$',
  'platform', 'product', 'assistant', 'agent', 'integration', 'partnership',
  'acquisition', 'funding', 'raises', 'advisors', 'clients', 'firms',
  '%', 'milestone', 'first',
];

function scoreRelevance(entry) {
  const headline = (entry.headline || '').toLowerCase();
  const summary  = (entry.summary  || '').toLowerCase();
  const combined = `${headline} ${summary}`;
  const tracked       = isTrackedCompany(entry);
  const hasSpecificAI = SPECIFIC_AI_SIGNALS.some(s => combined.includes(s));
  if (tracked && hasSpecificAI) return { points: 20, label: 'Tracked company + specific AI signal', tracked };
  if (tracked)                  return { points: 13, label: 'Tracked company, general mention', tracked };
  if (hasSpecificAI)            return { points: 8,  label: 'Untracked company, specific AI signal', tracked };
  return { points: 3, label: 'Tangential relevance', tracked };
}

// ── Main scorer ───────────────────────────────────────────────────────────────

export async function scoreEntry({ entry, governance, sourceUrl }) {
  // Hard date gate — nothing older than 90 days enters the portal, ever
  if (entry.date) {
    const ageDays = (Date.now() - new Date(entry.date).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 90) {
      return {
        action: 'BLOCK',
        score: 0,
        breakdown: {
          source:    { points: 0, label: 'n/a' },
          claims:    { points: 0, label: 'n/a' },
          freshness: { points: 0, label: `${Math.round(ageDays)}d old — exceeds 90-day limit` },
          relevance: { points: 0, label: 'n/a' },
        },
        reason: `Article is ${Math.round(ageDays)} days old — exceeds 90-day freshness limit`,
      };
    }
  }

  const [dimA, dimB, dimC, dimD] = await Promise.all([
    scoreSourceQuality(sourceUrl || entry.source_url || ''),
    Promise.resolve(scoreClaimVerification(governance)),
    Promise.resolve(scoreFreshness(entry.date)),
    Promise.resolve(scoreRelevance(entry)),
  ]);

  // Fabricated claims: block unless source was paywalled (can't verify = not the same as fabricated)
  if (dimB.fabricated) {
    if (governance.paywall_caveat) {
      // Paywalled source — claims couldn't be verified, not truly fabricated → send to REVIEW
      return {
        action: 'REVIEW',
        score: 40,
        breakdown: { source: dimA, claims: { ...dimB, points: 0, label: 'Unverifiable — paywalled source' }, freshness: dimC, relevance: dimD },
        reason: 'Paywalled source — claims unverifiable, not fabricated. Human review required.',
      };
    }
    return {
      action: 'BLOCK',
      score: 0,
      breakdown: { source: dimA, claims: dimB, freshness: dimC, relevance: dimD },
      reason: `Fabricated claims: ${(governance.fabricated_claims || []).join('; ')}`,
    };
  }

  let score = Math.max(0, Math.min(100, dimA.points + dimB.points + dimC.points + dimD.points));

  // Tracked company floor: if we explicitly track this company and the article is fresh,
  // always send to REVIEW — never silently block a story about a company we monitor.
  const ageDaysNow = entry.date
    ? (Date.now() - new Date(entry.date).getTime()) / (1000 * 60 * 60 * 24) : 999;
  if (dimD.tracked && ageDaysNow <= 30 && score < 65) {
    score = 65;
  }

  let action = score >= 75 ? 'PUBLISH' : score >= 65 ? 'REVIEW' : 'BLOCK';

  // Paywall caveat: can't fully verify → downgrade PUBLISH to REVIEW
  if (action === 'PUBLISH' && governance.paywall_caveat) action = 'REVIEW';

  return {
    action,
    score,
    breakdown: { source: dimA, claims: dimB, freshness: dimC, relevance: dimD },
    reason: null,
  };
}

export function formatScoreBreakdown(scorerResult) {
  const { score, breakdown: { source, claims, freshness, relevance } } = scorerResult;
  return [
    `Score: ${score}/100`,
    `Source: ${source.label} (${source.points})`,
    `Claims: ${claims.label} (${claims.points > 0 ? '+' : ''}${claims.points})`,
    `Fresh: ${freshness.label} (${freshness.points})`,
    `Relevance: ${relevance.label} (${relevance.points})`,
  ].join(' · ');
}
