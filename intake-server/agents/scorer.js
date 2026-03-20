/**
 * scorer.js — Auto-judgment layer
 *
 * Scores each processed entry across 4 dimensions and decides:
 *   PUBLISH (score >= 75) — auto-publish, no Telegram notification
 *   REVIEW  (score 50–74) — send to Telegram with full breakdown so human can decide fast
 *   BLOCK   (score < 50 or any fabricated claims) — permanently block URL
 *
 * Score breakdown sent in Telegram digest so the human knows exactly why
 * something needs review and what the specific concern is.
 */

// ── Source tier definitions ────────────────────────────────────────────────────

const PRESS_RELEASE_DOMAINS = new Set([
  'businesswire.com', 'prnewswire.com', 'globenewswire.com', 'accesswire.com',
]);

// Company newsroom signals — in subdomain or URL path
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

// Tracked companies — matched against entry.company slug
const TRACKED_COMPANIES = new Set([
  'goldman-sachs', 'morgan-stanley', 'jpmorgan', 'bofa-merrill', 'ubs',
  'wells-fargo', 'citi-private-bank', 'hsbc', 'julius-baer', 'bnp-paribas-wealth',
  'dbs', 'bbva', 'rbc-wealth-management', 'standard-chartered',
  'altruist', 'lpl-financial', 'robinhood', 'wealthfront', 'etoro', 'public-com',
  'arta-ai', 'savvy-wealth', 'jump-ai', 'nevis', 'zocks', 'holistiplan',
  'conquest-planning', 'betterment', 'webull', 'orion', 'envestnet',
]);

// Keywords that signal a specific AI product/metric rather than a generic mention
const SPECIFIC_AI_SIGNALS = [
  'launch', 'launches', 'launched', 'deploy', 'deployed', 'announces', 'announced',
  'million users', 'billion interactions', 'billion', 'million', '$',
  'platform', 'product', 'assistant', 'agent', 'integration', 'partnership',
  'acquisition', 'funding', 'raises', 'advisors', 'clients', 'firms',
  '%', 'billion', 'milestone', 'first', 'new',
];

// ── Dimension A: Source Quality (0–30) ───────────────────────────────────────

function scoreSourceQuality(sourceUrl) {
  let hostname = '';
  let fullUrl = '';
  try {
    const u = new URL(sourceUrl);
    hostname = u.hostname.replace(/^www\./, '');
    fullUrl = sourceUrl.toLowerCase();
  } catch (_) {
    return { points: 5, label: `Unrecognised source`, tier: 'unknown' };
  }

  if (PRESS_RELEASE_DOMAINS.has(hostname)) {
    return { points: 30, label: `Press release wire (${hostname})`, tier: 'press_release' };
  }

  const isNewsroom = NEWSROOM_PATTERNS.some(p => fullUrl.includes(p));
  if (isNewsroom) {
    return { points: 30, label: `Company newsroom (${hostname})`, tier: 'newsroom' };
  }

  if (TIER1_MEDIA.has(hostname)) {
    return { points: 25, label: `Tier 1 media (${hostname})`, tier: 'tier1' };
  }

  if (TIER2_MEDIA.has(hostname)) {
    return { points: 20, label: `Industry press (${hostname})`, tier: 'tier2' };
  }

  return { points: 12, label: `General press (${hostname})`, tier: 'general' };
}

// ── Dimension B: Claim Verification (0–30, or -100 for fabrications) ─────────

function scoreClaimVerification(governance) {
  const fabricated = governance.fabricated_claims || [];
  const unverified = governance.unverified_claims || [];

  if (fabricated.length > 0) {
    return {
      points: -100,
      label: `${fabricated.length} fabricated claim(s)`,
      fabricated: true,
    };
  }

  if (unverified.length === 0) {
    return { points: 30, label: 'All claims verified', fabricated: false };
  }
  if (unverified.length === 1) {
    return { points: 18, label: '1 unverified claim', fabricated: false };
  }
  if (unverified.length === 2) {
    return { points: 8, label: '2 unverified claims', fabricated: false };
  }
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

function scoreRelevance(entry) {
  const company  = (entry.company  || '').toLowerCase();
  const headline = (entry.headline || '').toLowerCase();
  const summary  = (entry.summary  || '').toLowerCase();
  const combined = `${headline} ${summary}`;

  const isTracked       = TRACKED_COMPANIES.has(company);
  const hasSpecificAI   = SPECIFIC_AI_SIGNALS.some(s => combined.includes(s));

  if (isTracked && hasSpecificAI) {
    return { points: 20, label: 'Tracked company + specific AI signal' };
  }
  if (isTracked) {
    return { points: 13, label: 'Tracked company, general mention' };
  }
  if (hasSpecificAI) {
    return { points: 8, label: 'Untracked company, specific AI signal' };
  }
  return { points: 3, label: 'Tangential relevance' };
}

// ── Main scorer ───────────────────────────────────────────────────────────────

/**
 * Score an entry and return a routing decision.
 *
 * @param {object} params
 * @param {object} params.entry       - Structured IntelligenceEntry from intake.js
 * @param {object} params.governance  - Governance result from governance.js
 * @param {string} params.sourceUrl   - The original URL (may differ from entry.source_url if enriched)
 * @returns {{ action: string, score: number, breakdown: object, reason: string|null }}
 */
export function scoreEntry({ entry, governance, sourceUrl }) {
  const dimA = scoreSourceQuality(sourceUrl || entry.source_url || '');
  const dimB = scoreClaimVerification(governance);
  const dimC = scoreFreshness(entry.date);
  const dimD = scoreRelevance(entry);

  // Any fabricated claim → BLOCK immediately, score is irrelevant
  if (dimB.fabricated) {
    return {
      action: 'BLOCK',
      score: 0,
      breakdown: { source: dimA, claims: dimB, freshness: dimC, relevance: dimD },
      reason: `Fabricated claims: ${(governance.fabricated_claims || []).join('; ')}`,
    };
  }

  const rawScore  = dimA.points + dimB.points + dimC.points + dimD.points;
  const score     = Math.max(0, Math.min(100, rawScore));

  let action;
  if (score >= 75) action = 'PUBLISH';
  else if (score >= 50) action = 'REVIEW';
  else action = 'BLOCK';

  // Paywall caveat: can't fully verify → downgrade PUBLISH to REVIEW
  if (action === 'PUBLISH' && governance.paywall_caveat) {
    action = 'REVIEW';
  }

  return {
    action,
    score,
    breakdown: { source: dimA, claims: dimB, freshness: dimC, relevance: dimD },
    reason: null,
  };
}

/**
 * Format the score breakdown as a compact string for Telegram messages.
 * e.g. "Score: 62 · Source: 20 · Claims: 18 · Fresh: 14 · Relevance: 8"
 */
export function formatScoreBreakdown(scorerResult) {
  const { score, breakdown } = scorerResult;
  const { source, claims, freshness, relevance } = breakdown;
  return [
    `Score: ${score}/100`,
    `Source: ${source.label} (${source.points})`,
    `Claims: ${claims.label} (${claims.points > 0 ? claims.points : claims.points})`,
    `Fresh: ${freshness.label} (${freshness.points})`,
    `Relevance: ${relevance.label} (${relevance.points})`,
  ].join(' · ');
}
