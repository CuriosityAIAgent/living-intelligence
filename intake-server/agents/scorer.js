/**
 * scorer.js — Auto-judgment layer (v2)
 *
 * Scores each processed entry across 4 dimensions (max 100):
 *   Dim A  Source Quality     0–25   credibility of the source
 *   Dim B  Claims Verified    0–25   governance verification outcome
 *   Dim C  Freshness          0–10   recency (less weight — impact > recency)
 *   Dim D  Capability Impact  0–40   the core value: capability + evidence + scale
 *
 * Actions:
 *   PUBLISH (score ≥ 75) — auto-publish, no Telegram notification
 *   REVIEW  (score 60–74) — send to Telegram for human decision
 *   BLOCK   (score < 60 or fabricated claims) — permanently block URL
 *
 * Philosophy: funding/acquisition/launch are triggers that make a story publishable.
 * The story is always about which of the 7 capability dimensions is advancing,
 * with what evidence, and at what scale. Dim D encodes this directly.
 */

import fetch from 'node-fetch';
import {
  PRESS_RELEASE_DOMAINS as _PRESS_RELEASE_DOMAINS,
  TIER1_MEDIA as _TIER1_MEDIA,
  VALID_CAPABILITIES as _VALID_CAPABILITIES,
  COMPETITORS_DIR,
} from './config.js';

// ── DataForSEO Backlinks API — live domain authority ──────────────────────────

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

// ── Fallback manual tier list ─────────────────────────────────────────────────

const PRESS_RELEASE_DOMAINS = _PRESS_RELEASE_DOMAINS;

// Strong newsroom signals — subdomain or explicit path (low false-positive risk)
const NEWSROOM_PATTERNS_STRONG = [
  'newsroom.', '.newsroom.', '/newsroom', '/news-releases', '/press-releases',
  '/press-release', '/investor-relations', '/media-centre', '/media-center',
  'investor.', 'press.', 'ir.',
];

// Weaker newsroom signals — only applied AFTER checking the domain is not a known outlet
const NEWSROOM_PATTERNS_WEAK = ['/news/', '/announcements/', '/blog/'];

const TIER1_MEDIA = _TIER1_MEDIA;

const TIER2_MEDIA = new Set([
  'riabiz.com', 'thinkadvisor.com', 'investmentnews.com', 'wealthmanagement.com',
  'financial-planning.com', 'advisorperspectives.com', 'advisorhub.com',
  'citywire.com', 'wealthbriefing.com', 'wealthprofessional.ca',
  'fintech.global', 'pymnts.com', 'tearsheet.co', 'bankingdive.com',
  'techcrunch.com', 'theblock.co', 'wealthtechtoday.com', 'fintechnexus.com',
]);

function fallbackSourceScore(hostname, fullUrl) {
  if (PRESS_RELEASE_DOMAINS.has(hostname)) return { points: 25, label: `Press release wire (${hostname})`, tier: 'press_release' };
  if (NEWSROOM_PATTERNS_STRONG.some(p => fullUrl.includes(p))) return { points: 25, label: `Company newsroom (${hostname})`, tier: 'newsroom' };
  if (TIER1_MEDIA.has(hostname)) return { points: 22, label: `Tier 1 media (${hostname})`, tier: 'tier1' };
  if (TIER2_MEDIA.has(hostname)) return { points: 17, label: `Industry press (${hostname})`, tier: 'tier2' };
  // Weak newsroom signals checked AFTER known outlets — prevents thinkadvisor.com/news/ from scoring as newsroom
  if (NEWSROOM_PATTERNS_WEAK.some(p => fullUrl.includes(p))) return { points: 20, label: `Company news page (${hostname})`, tier: 'newsroom_weak' };
  return { points: 9, label: `General press (${hostname})`, tier: 'general' };
}

// ── Dimension A: Source Quality (0–25) ───────────────────────────────────────

async function scoreSourceQuality(sourceUrl) {
  let hostname = '';
  let fullUrl = '';
  try {
    const u = new URL(sourceUrl);
    hostname = u.hostname.replace(/^www\./, '');
    fullUrl = sourceUrl.toLowerCase();
  } catch (_) {
    return { points: 4, label: 'Unrecognised source', tier: 'unknown' };
  }

  if (PRESS_RELEASE_DOMAINS.has(hostname)) {
    return { points: 25, label: `Press release wire (${hostname})`, tier: 'press_release' };
  }
  if (NEWSROOM_PATTERNS_STRONG.some(p => fullUrl.includes(p))) {
    return { points: 25, label: `Company newsroom (${hostname})`, tier: 'newsroom' };
  }

  const authority = await getDomainAuthority(hostname);

  if (authority) {
    if (authority.spam_score >= 40) {
      return { points: 2, label: `Flagged source (spam ${authority.spam_score}) (${hostname})`, tier: 'spam' };
    }
    let points, tier;
    if (authority.rank >= 70)      { points = 23; tier = 'high_authority'; }
    else if (authority.rank >= 50) { points = 18; tier = 'mid_authority'; }
    else if (authority.rank >= 30) { points = 12; tier = 'low_authority'; }
    else                           { points = 5;  tier = 'very_low_authority'; }
    return { points, label: `${hostname} (rank ${authority.rank}, spam ${authority.spam_score})`, tier };
  }

  return fallbackSourceScore(hostname, fullUrl);
}

// ── Dimension B: Claim Verification (0–25, or -100 for fabrications) ─────────

function scoreClaimVerification(governance) {
  const fabricated = governance.fabricated_claims || [];
  const unverified = governance.unverified_claims || [];

  if (fabricated.length > 0) {
    return { points: -100, label: `${fabricated.length} fabricated claim(s)`, fabricated: true };
  }
  if (unverified.length === 0) return { points: 25, label: 'All claims verified', fabricated: false };
  if (unverified.length === 1) return { points: 15, label: '1 unverified claim', fabricated: false };
  if (unverified.length === 2) return { points: 6,  label: '2 unverified claims', fabricated: false };
  return { points: 0, label: `${unverified.length} unverified claims`, fabricated: false };
}

// ── Dimension C: Freshness (0–10) ─────────────────────────────────────────────

function scoreFreshness(dateStr) {
  if (!dateStr) return { points: 0, label: 'Date unknown' };
  const articleDate = new Date(dateStr);
  if (isNaN(articleDate)) return { points: 0, label: 'Invalid date' };
  const ageDays = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60 * 24);

  if (ageDays <= 1)  return { points: 10, label: `${Math.round(ageDays * 24)}h old` };
  if (ageDays <= 3)  return { points: 8,  label: `${Math.round(ageDays)}d old` };
  if (ageDays <= 7)  return { points: 6,  label: `${Math.round(ageDays)}d old` };
  if (ageDays <= 14) return { points: 4,  label: `${Math.round(ageDays)}d old` };
  if (ageDays <= 30) return { points: 2,  label: `${Math.round(ageDays)}d old` };
  if (ageDays <= 90) return { points: 1,  label: `${Math.round(ageDays)}d old` };
  return { points: 0, label: `${Math.round(ageDays)}d old — stale` };
}

// ── Tracked company detection (dynamic from data/competitors/*.json) ──────────

const TRACKED_IDS_FALLBACK = new Set([
  'goldman-sachs', 'morgan-stanley', 'jpmorgan', 'bofa-merrill', 'ubs',
  'wells-fargo', 'citi-private-bank', 'hsbc', 'julius-baer', 'bnp-paribas-wealth',
  'dbs', 'bbva', 'rbc-wealth-management', 'standard-chartered',
  'altruist', 'lpl-financial', 'robinhood', 'wealthfront', 'etoro', 'public-com',
  'arta-ai', 'savvy-wealth', 'jump-ai', 'nevis', 'zocks', 'holistiplan',
  'conquest-planning',
]);

let TRACKED_IDS   = new Set(TRACKED_IDS_FALLBACK);
let TRACKED_NAMES = new Set();

try {
  const fs   = await import('fs');
  const path = await import('path');
  const files = fs.default.readdirSync(COMPETITORS_DIR).filter(f => f.endsWith('.json'));
  TRACKED_IDS   = new Set();
  TRACKED_NAMES = new Set();
  for (const f of files) {
    const c = JSON.parse(fs.default.readFileSync(path.default.join(COMPETITORS_DIR, f), 'utf8'));
    if (c.id)   TRACKED_IDS.add(c.id.toLowerCase());
    if (c.name) TRACKED_NAMES.add(c.name.toLowerCase());
  }
} catch (_) {
  // File loading failed — use hardcoded fallback
}

function isTrackedCompany(entry) {
  const id   = (entry.company      || '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const name = (entry.company_name || '').toLowerCase().trim();

  if (TRACKED_IDS.has(id))     return true;
  if (TRACKED_NAMES.has(name)) return true;

  // Partial ID match: "jump" matches "jump-ai", "bofa" matches "bofa-merrill"
  for (const tid of TRACKED_IDS) {
    if (id.length >= 3 && (tid.startsWith(id) || id.startsWith(tid))) return true;
  }

  // Fuzzy name match: "Zocks AI" contains "Zocks", or "LPL Financial Advisors" contains "LPL Financial"
  for (const tname of TRACKED_NAMES) {
    if (tname.length >= 3 && (name.includes(tname) || tname.includes(name))) return true;
  }

  return false;
}

// ── Dimension D: Capability Impact (0–40) ────────────────────────────────────
//
// This is the core dimension. It encodes whether an article:
//   1. Clearly advances one of the 7 capability dimensions (Clarity)
//   2. Has evidence it's real — deployed, piloting, or announced (Evidence)
//   3. Has quantified or described scale (Scale)
//   4. Is about a company we track (Competitive Relevance)

const VALID_CAPABILITIES = _VALID_CAPABILITIES;

const DEPLOYMENT_SIGNALS = [
  'deployed', 'live', 'launched', 'available', 'released', 'rolls out', 'rolled out',
  'goes live', 'general availability', 'now available', 'in production', 'in use',
  'active users', 'using the platform', 'using the tool',
];

const PILOT_SIGNALS = [
  'pilot', 'piloting', 'beta', 'beta launch', 'trial', 'testing', 'preview',
  'early access', 'limited release', 'select clients',
];

const SCALE_SIGNALS = [
  /\d[\d,]*\s*(advisors|financial advisors|clients|firms|institutions|users|wealth managers)/i,
  /\$[\d.]+\s*[bmt]\w*\s*(aum|assets|in assets)/i,
  /\d+\s*%\s*(of advisors|of clients|reduction|increase|improvement|faster|savings)/i,
  /\d+\s*(hours?|mins?|minutes?)\s*(per|a|each)\s*(week|day|month)/i,
];

const BREADTH_SIGNALS = [
  'firm-wide', 'all advisors', 'enterprise-wide', 'rolled out to all',
  'available to all', 'every advisor', 'across the firm', 'all wealth managers',
];

function scoreCapabilityImpact(entry) {
  const headline = (entry.headline || '').toLowerCase();
  const summary  = (entry.summary  || '').toLowerCase();
  const combined = `${headline} ${summary}`;
  const ce       = entry.capability_evidence || {};
  const tracked  = isTrackedCompany(entry);

  let points = 0;
  const signals = [];

  // ── 1. Capability Clarity (0–10) ──────────────────────────────────────────
  const hasValidCapability = VALID_CAPABILITIES.has(entry.tags?.capability);
  const capabilityDescribed = !!(ce.capability && ce.evidence); // Claude populated capability_evidence

  if (hasValidCapability && capabilityDescribed) {
    points += 10;
    signals.push(`capability clear: ${entry.tags.capability} (+10)`);
  } else if (hasValidCapability) {
    points += 5;
    signals.push(`capability tagged: ${entry.tags.capability} (+5)`);
  }
  // else 0 — no capability = no points here

  // ── 2. Evidence Quality (0–15) ────────────────────────────────────────────
  const stage = (ce.stage || '').toLowerCase();
  const hasDeployment = stage === 'deployed' || DEPLOYMENT_SIGNALS.some(s => combined.includes(s));
  const hasPilot      = stage === 'piloting'  || PILOT_SIGNALS.some(s => combined.includes(s));
  const hasQuantified = ce.metric || SCALE_SIGNALS.some(r => r.test(combined));

  if (hasDeployment && hasQuantified) {
    points += 15; signals.push('deployed+quantified (+15)');
  } else if (hasDeployment) {
    points += 10; signals.push('deployed (+10)');
  } else if (hasPilot) {
    points += 7;  signals.push('piloting (+7)');
  } else if (['funding', 'acquisition', 'regulatory', 'product_launch', 'partnership'].includes(entry.type)) {
    points += 3;  signals.push('announced (+3)');
  }
  // market_signal / strategy_move / no evidence = 0

  // ── 3. Business Scale (0–10) ──────────────────────────────────────────────
  const hasAdvisorCount = ce.advisors_affected || SCALE_SIGNALS.some(r => r.test(combined));
  const hasBreadth      = BREADTH_SIGNALS.some(s => combined.includes(s));

  if (hasAdvisorCount) {
    points += 10; signals.push('quantified scale (+10)');
  } else if (hasBreadth) {
    points += 4;  signals.push('breadth signal (+4)');
  } else if (tracked) {
    points += 2;  signals.push('tracked company (+2)');
  }

  // ── 4. Competitive Relevance (0–5) ────────────────────────────────────────
  const companyName = (entry.company_name || '').toLowerCase();
  const isCentral   = companyName.length > 2 && headline.includes(companyName);

  if (tracked && isCentral) {
    points += 5; signals.push('central tracked company (+5)');
  } else if (tracked) {
    points += 3; signals.push('tracked company (+3)');
  } else {
    points += 1; signals.push('general industry (+1)');
  }

  return {
    points: Math.min(points, 40),
    label:  signals.join(', ') || 'No capability signals',
    tracked,
  };
}

// ── Dimension E: CXO Relevance (0–10, rule-based) ────────────────────────────
//
// Does the_so_what actually answer "what should a CXO think or decide differently"?
// Pure rule-based — zero API cost. Catches the obvious failures.
// If score ≤ 4, the entry is flagged for REVIEW regardless of total score.

const FORBIDDEN_PHRASES = [
  'this signals', 'this suggests', 'wealth managers should consider',
  'underscores the importance', 'highlights the growing', 'it is clear that',
  'this demonstrates', 'the growing importance', 'increasingly important',
  'this shows that', 'this indicates', 'this highlights',
];

const COMPARATIVE_TERMS = [
  'ahead', 'behind', 'leads', 'lags', 'outpaces', 'overtaken',
  'first to', 'only firm', 'no peer', 'ahead of', 'behind competitors',
  'market leader', 'catching up', 'gap between',
];

const DECISION_TERMS = [
  'cannot afford', 'must now', 'no longer', 'already losing', 'at risk of',
  'has crossed', 'default', 'benchmark', 'cannot ignore', 'inflection point',
  'window is closing', 'competitive disadvantage', 'losing the',
];

function scoreCXORelevance(entry) {
  const soWhat = (entry.the_so_what || '').toLowerCase().trim();
  const signals = [];
  let points = 5; // Start at midpoint, adjust up/down

  if (!soWhat || soWhat.length < 20) {
    return { points: 0, label: 'No the_so_what or too short', weak: true };
  }

  // Penalise forbidden generic phrases
  const forbidden = FORBIDDEN_PHRASES.filter(p => soWhat.includes(p));
  if (forbidden.length > 0) {
    points -= 3;
    signals.push(`generic phrases: ${forbidden.join(', ')} (-3)`);
  }

  // Penalise if company name absent (generic statement not about a specific company)
  const companyName = (entry.company_name || '').toLowerCase();
  if (companyName.length > 2 && !soWhat.includes(companyName)) {
    points -= 2;
    signals.push('company name absent (-2)');
  }

  // Penalise if too long (rambling, not a tight strategic insight)
  const wordCount = soWhat.split(/\s+/).length;
  if (wordCount > 60) {
    points -= 1;
    signals.push(`too long (${wordCount} words) (-1)`);
  }

  // Reward: contains a specific number or metric
  if (/\d/.test(soWhat)) {
    points += 2;
    signals.push('contains specific metric (+2)');
  }

  // Reward: comparative language (positions against competitors)
  const comparative = COMPARATIVE_TERMS.filter(t => soWhat.includes(t));
  if (comparative.length > 0) {
    points += 2;
    signals.push('comparative positioning (+2)');
  }

  // Reward: decision/action language (tells CXO what it means for them)
  const decision = DECISION_TERMS.filter(t => soWhat.includes(t));
  if (decision.length > 0) {
    points += 2;
    signals.push('decision language (+2)');
  }

  const finalPoints = Math.max(0, Math.min(10, points));
  const weak = finalPoints <= 4;

  return {
    points: finalPoints,
    label: signals.length > 0 ? signals.join(', ') : 'Adequate the_so_what',
    weak,
  };
}

// ── Main scorer ───────────────────────────────────────────────────────────────

export async function scoreEntry({ entry, governance, sourceUrl }) {
  // Hard date gate — nothing older than 90 days, ever
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
          impact:    { points: 0, label: 'n/a' },
        },
        reason: `Article is ${Math.round(ageDays)} days old — exceeds 90-day freshness limit`,
      };
    }
  }

  const [dimA, dimB, dimC, dimD] = await Promise.all([
    scoreSourceQuality(sourceUrl || entry.source_url || ''),
    Promise.resolve(scoreClaimVerification(governance)),
    Promise.resolve(scoreFreshness(entry.date)),
    Promise.resolve(scoreCapabilityImpact(entry)),
  ]);

  const dimE = scoreCXORelevance(entry);

  // Fabricated claims: block unless paywalled (can't verify ≠ fabricated)
  if (dimB.fabricated) {
    if (governance.paywall_caveat) {
      return {
        action: 'REVIEW',
        score: 40,
        breakdown: { source: dimA, claims: { ...dimB, points: 0, label: 'Unverifiable — paywalled source' }, freshness: dimC, impact: dimD, cxo: dimE },
        reason: 'Paywalled source — claims unverifiable, not fabricated. Human review required.',
      };
    }
    return {
      action: 'BLOCK',
      score: 0,
      breakdown: { source: dimA, claims: dimB, freshness: dimC, impact: dimD, cxo: dimE },
      reason: `Fabricated claims: ${(governance.fabricated_claims || []).join('; ')}`,
    };
  }

  let score = Math.max(0, Math.min(100, dimA.points + dimB.points + dimC.points + dimD.points));

  // Multi-source bonus: stories with multiple sources are higher quality
  const sourceCount = entry.source_count || entry.sources?.length || 1;
  const hasPrimarySource = (entry.sources || []).some(s => s.type === 'primary');
  if (sourceCount >= 3) score = Math.min(100, score + 5);
  else if (sourceCount >= 2) score = Math.min(100, score + 3);
  if (hasPrimarySource) score = Math.min(100, score + 3);

  // Tracked company floor: never silently block a fresh story about a company we monitor
  const ageDaysNow = entry.date
    ? (Date.now() - new Date(entry.date).getTime()) / (1000 * 60 * 60 * 24) : 999;
  if (dimD.tracked && ageDaysNow <= 30 && score < 60) {
    score = 60;
  }

  let action = score >= 75 ? 'PUBLISH' : score >= 60 ? 'REVIEW' : 'BLOCK';

  // Paywall caveat: can't fully verify → downgrade PUBLISH to REVIEW
  if (action === 'PUBLISH' && governance.paywall_caveat) action = 'REVIEW';

  // Dimension E gate: weak the_so_what → downgrade PUBLISH to REVIEW (never BLOCK)
  // The editorial team can fix the_so_what before publishing — it's not a hard failure
  if (action === 'PUBLISH' && dimE.weak) action = 'REVIEW';

  return {
    action,
    score,
    breakdown: { source: dimA, claims: dimB, freshness: dimC, impact: dimD, cxo: dimE },
    reason: dimE.weak ? `the_so_what flagged as weak CXO relevance (${dimE.points}/10) — review before publishing` : null,
  };
}

export function formatScoreBreakdown(scorerResult) {
  const { score, breakdown: { source, claims, freshness, impact, cxo } } = scorerResult;
  const parts = [
    `Score: ${score}/100`,
    `Source: ${source.label} (${source.points})`,
    `Claims: ${claims.label} (${claims.points > 0 ? '+' : ''}${claims.points})`,
    `Fresh: ${freshness.label} (${freshness.points})`,
    `Impact: ${impact?.label || 'n/a'} (${impact?.points || 0})`,
  ];
  if (cxo) {
    parts.push(`CXO: ${cxo.label} (${cxo.points}/10)${cxo.weak ? ' ⚠' : ''}`);
  }
  return parts.join(' · ');
}

// ── Utility: classify source tier (used externally for display/filtering) ─────
export function classifySource(sourceUrl) {
  let hostname = '';
  let fullUrl = '';
  try {
    const u = new URL(sourceUrl);
    hostname = u.hostname.replace(/^www\./, '');
    fullUrl = sourceUrl.toLowerCase();
  } catch (_) {
    return { tier: 'unknown', label: 'Unrecognised source' };
  }
  const result = fallbackSourceScore(hostname, fullUrl);
  return { tier: result.tier, label: result.label };
}
