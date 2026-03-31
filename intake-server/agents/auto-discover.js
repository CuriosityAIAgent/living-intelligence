/**
 * auto-discover.js — Multi-layer discovery pipeline
 *
 * Layer 1 News  : 8 broad thematic DFS Google News queries
 *                 (catches any new entrant / unknown company)
 * Layer 1 Caps  : 7 capability-dimension DFS Google News queries — dynamically
 *                 built from data/capabilities/index.json search_term field.
 *                 Year injected at runtime (Q1-aware: includes prior year too).
 * Layer 2 Cos   : Dynamic DFS Content Analysis queries, one per company in
 *                 data/competitors/*.json — auto-expands as landscape grows
 * Layer 3 NewsAPI: NewsAPI.ai (Event Registry) — 80K+ sources, catches industry
 *                 press (ThinkAdvisor, RIABiz, Financial Planning) that Google
 *                 News editorial selection misses.
 * Layer 1 TL    : 5 broad Jina Search queries for thought leadership
 * Layer 2 Authors: Dynamic Jina Search queries from data/thought-leadership/*.json
 *
 * Output: done event { intelCandidates, tlCandidates, knownCompanyIds }
 *   - intelCandidates : scored + reranked intelligence candidates
 *   - tlCandidates    : raw TL candidates (no intake pipeline — surfaced in Telegram)
 *   - knownCompanyIds : Set of company IDs loaded from data/competitors/ (for new-company detection)
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import fetch from 'node-fetch';
import { INTEL_DIR, COMPETITORS_DIR, TL_DIR, CAPABILITIES_DIR } from './config.js';

// ── Load landscape data (dynamic — grows as competitor files are added) ────────

function loadCompetitors() {
  try {
    return readdirSync(COMPETITORS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(readFileSync(join(COMPETITORS_DIR, f), 'utf8')); }
        catch (_) { return null; }
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function loadCapabilities() {
  try {
    const raw = readFileSync(join(CAPABILITIES_DIR, 'index.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return (parsed.capabilities || parsed).filter(c => c.search_term);
  } catch (_) {
    return [];
  }
}

function loadTLEntries() {
  try {
    return readdirSync(TL_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(readFileSync(join(TL_DIR, f), 'utf8')); }
        catch (_) { return null; }
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

// ── Dynamic query builders ─────────────────────────────────────────────────────

const SEGMENT_FOCUS = {
  wirehouse:           'wealth management AI advisor',
  global_private_bank: 'private banking AI platform',
  regional_champion:   'wealth management AI platform',
  digital_disruptor:   'AI investing platform launch',
  ai_native:           'AI wealth platform',
  ria_independent:     'RIA AI advisor platform',
  advisor_tools:       'AI advisor tools technology',
};

// One DFS Content Analysis query per company in the landscape.
// New company added to data/competitors/ → automatically included next run.
function buildCompanyQueries(competitors) {
  return competitors.map(c => {
    const focus = SEGMENT_FOCUS[c.segment] || 'AI wealth management';
    return { company_id: c.id, company_name: c.name, keyword: `${c.name} ${focus}` };
  });
}

// One DFS Google News query per capability dimension — dynamically loaded from index.json.
// Year is injected at runtime (self-updating). In Q1, includes prior year too since
// Dec–Feb content is < 90 days old and may not surface with current year alone.
function buildCapabilityQueries(capabilities) {
  const now = new Date();
  const currentYear = now.getFullYear();
  // Jan, Feb, Mar → include prior year too
  const yearTerms = now.getMonth() < 3
    ? `${currentYear - 1} ${currentYear}`
    : `${currentYear}`;

  return capabilities.map(c => ({
    capability_id:   c.id,
    capability_label: c.label,
    keyword: `${c.search_term} ${yearTerms}`,
  }));
}

// One Jina Search query per known author in thought-leadership entries.
function buildAuthorQueries(tlEntries) {
  const seen = new Set();
  return tlEntries
    .map(e => {
      const name = e.author?.name;
      const org  = e.author?.organization;
      if (!name || seen.has(name)) return null;
      seen.add(name);
      return { author: name, query: org ? `${name} ${org} AI essay 2026` : `${name} AI thought leadership 2026` };
    })
    .filter(Boolean);
}

// ── Jina Embeddings + Reranker ─────────────────────────────────────────────────

async function getEmbeddings(texts) {
  if (!process.env.JINA_API_KEY || texts.length === 0) return null;
  try {
    const res = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'jina-embeddings-v3',
        task: 'text-matching',
        dimensions: 512,
        input: texts,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.map(d => d.embedding) ?? null;
  } catch (_) {
    return null;
  }
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

function getPublishedEntryTexts() {
  try {
    return readdirSync(INTEL_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const e = JSON.parse(readFileSync(join(INTEL_DIR, f), 'utf8'));
        return `${e.headline || ''} ${e.summary || ''}`.trim();
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

async function semanticDedup(candidates) {
  if (!process.env.JINA_API_KEY || candidates.length === 0) return candidates;
  const publishedTexts = getPublishedEntryTexts();
  if (publishedTexts.length === 0) return candidates;

  const candidateTexts = candidates.map(c => `${c.title} ${c.snippet}`);
  const [pubEmbeddings, candEmbeddings] = await Promise.all([
    getEmbeddings(publishedTexts),
    getEmbeddings(candidateTexts),
  ]);
  if (!pubEmbeddings || !candEmbeddings) return candidates;

  return candidates.filter((_, i) => {
    const candEmb = candEmbeddings[i];
    return !pubEmbeddings.some(pubEmb => cosineSimilarity(candEmb, pubEmb) >= 0.90);
  });
}

async function rerankCandidates(candidates) {
  if (!process.env.JINA_API_KEY || candidates.length === 0) return candidates;
  try {
    const documents = candidates.map(c => `${c.title} ${c.snippet}`);
    const res = await fetch('https://api.jina.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'jina-reranker-v3',
        query: 'significant AI announcement, product launch, funding round, acquisition, regulatory development, or strategic partnership affecting wealth management advisors or private banking clients',
        documents,
        top_n: Math.min(candidates.length, 20),
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return candidates.slice(0, 20);
    const data = await res.json();
    return (data.results || []).map(r => ({
      ...candidates[r.index],
      rerank_score: r.relevance_score,
    }));
  } catch (_) {
    return candidates.slice(0, 20);
  }
}

// ── URL utilities ─────────────────────────────────────────────────────────────

function normalizeUrl(url) {
  try { return new URL(url).href.toLowerCase().replace(/\/$/, ''); } catch (_) { return url.toLowerCase(); }
}

function getExistingUrls() {
  const urls = new Set();
  try {
    for (const f of readdirSync(INTEL_DIR).filter(f => f.endsWith('.json'))) {
      const entry = JSON.parse(readFileSync(join(INTEL_DIR, f), 'utf8'));
      if (entry.source_url) urls.add(normalizeUrl(entry.source_url));
    }
  } catch (_) {}
  return urls;
}

// ── Company + date proximity dedup ────────────────────────────────────────────
// Catches same-story duplicates from different source URLs (e.g. Business Wire
// vs The SaaS News covering the same funding round). If a published entry exists
// for the same company within 7 days, the candidate is flagged as a likely dupe.

function getPublishedCompanyDates() {
  const map = new Map(); // company_slug → [{ date, headline }]
  try {
    for (const f of readdirSync(INTEL_DIR).filter(f => f.endsWith('.json'))) {
      const entry = JSON.parse(readFileSync(join(INTEL_DIR, f), 'utf8'));
      if (!entry.company || !entry.date) continue;
      const slug = entry.company.toLowerCase();
      if (!map.has(slug)) map.set(slug, []);
      map.get(slug).push({ date: entry.date, headline: (entry.headline || '').toLowerCase() });
    }
  } catch (_) {}
  return map;
}

export function isCompanyDateDuplicate(candidateTitle, companyNames, publishedCompanyDates) {
  if (!candidateTitle || !companyNames?.length) return false;
  const titleLower = candidateTitle.toLowerCase();
  const today = new Date();

  for (const name of companyNames) {
    // Try to match candidate title against known company names
    if (!titleLower.includes(name.toLowerCase())) continue;

    // Find the slug for this company
    for (const [slug, entries] of publishedCompanyDates) {
      if (!name.toLowerCase().includes(slug) && !slug.includes(name.toLowerCase().replace(/\s+/g, '-'))) continue;

      for (const pub of entries) {
        const pubDate = new Date(pub.date);
        const daysDiff = Math.abs((today - pubDate) / 86400000);
        if (daysDiff > 90) continue; // only check recent entries

        // Check if candidate title shares significant words with published headline
        const candidateWords = new Set(titleLower.split(/\s+/).filter(w => w.length > 3));
        const pubWords = new Set(pub.headline.split(/\s+/).filter(w => w.length > 3));
        const overlap = [...candidateWords].filter(w => pubWords.has(w)).length;
        const overlapRatio = overlap / Math.min(candidateWords.size, pubWords.size);

        if (overlapRatio >= 0.4) return true; // 40%+ word overlap = likely same story
      }
    }
  }
  return false;
}

// ── Relevance filter ──────────────────────────────────────────────────────────

const AI_KWS = [
  'ai', 'artificial intelligence', 'machine learning', 'generative ai', 'genai',
  'llm', 'large language model', 'chatbot', 'openai', 'anthropic', 'claude', 'gpt',
  'copilot', 'automation', 'agentic', 'autonomous', 'robo-advisor', 'wealthtech',
  'algorithm', 'predictive analytics', 'neural network',
];
const WEALTH_KWS = [
  'wealth management', 'financial advisor', 'financial adviser', 'ria', 'asset management',
  'private banking', 'family office', 'fintech', 'investment management', 'portfolio',
  'advisor', 'adviser', 'brokerage', 'retirement', 'financial planning',
  'morgan stanley', 'goldman sachs', 'ubs', 'merrill lynch', 'merrill',
  'charles schwab', 'schwab', 'fidelity', 'blackrock', 'vanguard', 'lpl financial', 'lpl',
  'jpmorgan', 'wells fargo', 'citigroup', 'citi', 'hsbc', 'dbs',
  'altruist', 'wealthfront', 'betterment', 'robinhood', 'arta finance', 'arta',
  'envestnet', 'orion', 'addepar', 'broadridge', 'fnz', 'raymond james', 'edward jones',
];

function isRelevant(text) {
  const t = text.toLowerCase();
  return AI_KWS.some(k => t.includes(k)) && WEALTH_KWS.some(k => t.includes(k));
}

// ── Candidate scoring ─────────────────────────────────────────────────────────

const PRIMARY_OUTLETS = new Set([
  'investmentnews.com', 'thinkadvisor.com', 'wealthmanagement.com',
  'financial-planning.com', 'riabiz.com', 'advisorhub.com', 'citywire.com',
  'fintech.global', 'wealthbriefing.com', 'wealthprofessional.ca',
]);
const TIER1_OUTLETS = new Set([
  'bloomberg.com', 'ft.com', 'wsj.com', 'cnbc.com', 'reuters.com',
  'axios.com', 'businesswire.com', 'prnewswire.com', 'globenewswire.com',
  'fortune.com', 'businessinsider.com', 'techcrunch.com',
]);

// Dynamic from loaded competitors — built once per run in autoDiscover()
let TRACKED_COMPANY_NAMES = [];

function scoreCandidate(c) {
  let baseScore = 0;
  const text = `${c.title} ${c.snippet}`.toLowerCase();

  // Source quality
  let hostname = '';
  try { hostname = new URL(c.url).hostname.replace(/^www\./, ''); } catch (_) {}
  if (PRIMARY_OUTLETS.has(hostname))   baseScore += 6;
  else if (TIER1_OUTLETS.has(hostname)) baseScore += 4;

  // Tracked company mention — increased from +2 to +4, max +10 (core discovery signal)
  let coScore = 0;
  for (const name of TRACKED_COMPANY_NAMES) {
    if (name.length >= 3 && text.includes(name.toLowerCase())) {
      coScore += 4;
      if (coScore >= 10) break;
    }
  }
  baseScore += coScore;

  // AI keyword density (max 4)
  let aiScore = 0;
  for (const k of AI_KWS) {
    if (text.includes(k)) { aiScore++; if (aiScore >= 4) break; }
  }
  baseScore += aiScore;

  // Source type bonus
  if (c.via === 'layer2_companies')       baseScore += 5 + Math.min(Math.floor(c.quality_score || 0), 2);
  else if (c.via === 'layer3_newsapi')    baseScore += 4;
  else if (c.via === 'layer1_capabilities') baseScore += 4;
  else if (c.via === 'layer1_news')         baseScore += 3;

  // HN gravity decay — breaks recency ties continuously.
  // Stories from 2 hours ago float above equally-scored stories from 2 days ago.
  // gravity=2.0 suits a daily B2B pipeline (punishes age faster than HN's 1.8).
  const hoursAgo = c.pub_date
    ? Math.max((Date.now() - new Date(c.pub_date).getTime()) / 3600000, 0.1)
    : 999;
  return Math.pow(Math.max(baseScore, 1), 0.8) / Math.pow(hoursAgo + 2, 2.0);
}

// ── Layer 1 News — broad thematic DFS Google News queries ─────────────────────
// These catch new entrants, unknown companies, and market-wide developments.
// They do NOT require knowing the company name in advance.

const LAYER1_NEWS_QUERIES = [
  'AI wealth management news 2026',
  'wealthtech artificial intelligence platform launch 2026',
  'financial advisor AI tool product announcement',
  'private banking generative AI deployment 2026',
  'robo-advisor AI fintech funding raises 2026',
  'wealth management AI agent agentic 2026',
  'Anthropic OpenAI wealth management financial services partnership',
  'AI financial planning advisor technology news',
];

async function discoverFromLayer1News(existingUrls) {
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) return [];
  const AUTH = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64');

  const results = await Promise.allSettled(
    LAYER1_NEWS_QUERIES.map(async (keyword) => {
      const res = await fetch(
        'https://api.dataforseo.com/v3/serp/google/news/live/advanced',
        {
          method: 'POST',
          headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([{ keyword, language_code: 'en', location_code: 2840, depth: 10 }]),
          signal: AbortSignal.timeout(25000),
        }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data?.tasks?.[0]?.result?.[0]?.items || [])
        .filter(i => {
          if (!i.url || existingUrls.has(normalizeUrl(i.url))) return false;
          if (i.date_published) {
            const age = (Date.now() - new Date(i.date_published).getTime()) / 86400000;
            if (age > 90) return false;
          }
          return true;
        })
        .slice(0, 8)
        .map(i => {
          let hostname = '';
          try { hostname = new URL(i.url).hostname.replace(/^www\./, ''); } catch (_) {}
          return {
            id: Buffer.from(i.url).toString('base64').slice(0, 12),
            title: i.title || i.url,
            url: i.url,
            source_name: i.source || hostname || 'News',
            pub_date: i.date_published || i.timestamp || null,
            snippet: (i.snippet || i.description || '').slice(0, 300),
            selected: true,
            via: 'layer1_news',
          };
        })
        .filter(c => isRelevant(`${c.title} ${c.snippet}`));
    })
  );

  const candidates = [];
  results.forEach(r => { if (r.status === 'fulfilled') candidates.push(...r.value); });
  return candidates;
}

// ── Layer 2 Companies — deep DFS Content Analysis per company ─────────────────
// Dynamically generated from data/competitors/*.json.
// New company file added → automatically queried on next run. No code changes.
// Content Analysis is higher quality than News: quality-filtered, includes blogs,
// reports, and trade press that don't appear in Google News.

async function discoverFromLayer2Companies(existingUrls, competitors) {
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) return [];
  const AUTH = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64');

  const queries = buildCompanyQueries(competitors);

  // Batch all company queries into a single API call (DFS supports array payloads)
  // Max 100 tasks per call — split if landscape grows past 100 companies
  const batchSize = 50;
  const allItems = [];

  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    try {
      const res = await fetch(
        'https://api.dataforseo.com/v3/content_analysis/search/live',
        {
          method: 'POST',
          headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(
            batch.map(q => ({
              keyword: q.keyword,
              filters: [
                ['content_quality_score', '>', 2],
                'and',
                ['page_types', 'has', 'news'],
              ],
              order_by: ['date_published,desc'],
              limit: 6,
            }))
          ),
          signal: AbortSignal.timeout(45000),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();

      (data?.tasks || []).forEach((task, taskIdx) => {
        const companyQuery = batch[taskIdx];
        const items = task?.result?.[0]?.items || [];
        items.forEach(item => {
          allItems.push({ item, companyQuery });
        });
      });
    } catch (_) {}
  }

  return allItems
    .filter(({ item: i }) => {
      if (!i.url || existingUrls.has(normalizeUrl(i.url))) return false;
      if (i.date_published) {
        const age = (Date.now() - new Date(i.date_published).getTime()) / 86400000;
        if (age > 90) return false;
      }
      return true;
    })
    .map(({ item: i }) => {
      let hostname = '';
      try { hostname = new URL(i.url).hostname.replace(/^www\./, ''); } catch (_) {}
      return {
        id: Buffer.from(i.url).toString('base64').slice(0, 12),
        title: i.title || i.url,
        url: i.url,
        source_name: hostname || 'Content Analysis',
        pub_date: i.date_published || null,
        snippet: (i.snippet || i.description || '').slice(0, 300),
        selected: true,
        via: 'layer2_companies',
        quality_score: i.content_quality_score || 0,
      };
    })
    .filter(c => isRelevant(`${c.title} ${c.snippet}`));
}

// ── Layer 1 Capabilities — DFS Google News, one query per capability ──────────
// Dynamically built from data/capabilities/index.json (search_term field).
// Year injected at runtime — self-updates across years, Q1-aware.
// This layer ensures capability-specific stories surface even when broad
// Layer 1 News queries miss them due to keyword competition.

async function discoverFromLayer1Capabilities(existingUrls, capabilities) {
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) return [];
  if (capabilities.length === 0) return [];

  const AUTH = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64');

  const queries = buildCapabilityQueries(capabilities);

  const results = await Promise.allSettled(
    queries.map(async ({ keyword, capability_id }) => {
      const res = await fetch(
        'https://api.dataforseo.com/v3/serp/google/news/live/advanced',
        {
          method: 'POST',
          headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([{ keyword, language_code: 'en', location_code: 2840, depth: 8 }]),
          signal: AbortSignal.timeout(25000),
        }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data?.tasks?.[0]?.result?.[0]?.items || [])
        .filter(i => {
          if (!i.url || existingUrls.has(normalizeUrl(i.url))) return false;
          if (i.date_published) {
            const age = (Date.now() - new Date(i.date_published).getTime()) / 86400000;
            if (age > 90) return false;
          }
          return true;
        })
        .slice(0, 6)
        .map(i => {
          let hostname = '';
          try { hostname = new URL(i.url).hostname.replace(/^www\./, ''); } catch (_) {}
          return {
            id: Buffer.from(i.url).toString('base64').slice(0, 12),
            title: i.title || i.url,
            url: i.url,
            source_name: i.source || hostname || 'News',
            pub_date: i.date_published || i.timestamp || null,
            snippet: (i.snippet || i.description || '').slice(0, 300),
            selected: true,
            via: 'layer1_capabilities',
            capability_hint: capability_id,
          };
        })
        .filter(c => isRelevant(`${c.title} ${c.snippet}`));
    })
  );

  const candidates = [];
  results.forEach(r => { if (r.status === 'fulfilled') candidates.push(...r.value); });
  return candidates;
}

// ── Layer 1 TL — broad Jina Search for thought leadership ─────────────────────
// Catches new voices, new essays, new research — not tied to known authors.

const LAYER1_TL_QUERIES = [
  'AI wealth management thought leadership essay 2026',
  'AI financial advisor future implications essay',
  'generative AI investment management strategy 2026',
  'AI fintech industry report white paper 2026',
  'artificial intelligence finance executive perspective 2026',
];

async function discoverFromLayer1TL(existingUrls) {
  if (!process.env.JINA_API_KEY) return [];

  const results = await Promise.allSettled(
    LAYER1_TL_QUERIES.map(async (query) => {
      const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
        },
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || [])
        .filter(r => {
          if (!r.url || existingUrls.has(normalizeUrl(r.url))) return false;
          if (r.date) {
            const age = (Date.now() - new Date(r.date).getTime()) / 86400000;
            if (age > 90) return false;
          }
          return true;
        })
        .map(r => {
          let hostname = '';
          try { hostname = new URL(r.url).hostname.replace(/^www\./, ''); } catch (_) {}
          return {
            id: Buffer.from(r.url).toString('base64').slice(0, 12),
            title: r.title || r.url,
            url: r.url,
            source_name: hostname || 'Web',
            pub_date: r.date || null,
            snippet: (r.description || r.content || '').slice(0, 300),
            via: 'layer1_tl',
          };
        });
    })
  );

  const candidates = [];
  results.forEach(r => { if (r.status === 'fulfilled') candidates.push(...r.value); });
  return candidates;
}

// ── Layer 2 Authors — Jina Search per known TL author ────────────────────────
// Dynamically generated from data/thought-leadership/*.json.
// New author entry → automatically queried. No code changes.

async function discoverFromLayer2Authors(existingUrls, tlEntries) {
  if (!process.env.JINA_API_KEY) return [];
  const authorQueries = buildAuthorQueries(tlEntries);
  if (authorQueries.length === 0) return [];

  const results = await Promise.allSettled(
    authorQueries.map(async ({ query }) => {
      const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
        },
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || [])
        .filter(r => {
          if (!r.url || existingUrls.has(normalizeUrl(r.url))) return false;
          if (r.date) {
            const age = (Date.now() - new Date(r.date).getTime()) / 86400000;
            if (age > 90) return false;
          }
          return true;
        })
        .map(r => {
          let hostname = '';
          try { hostname = new URL(r.url).hostname.replace(/^www\./, ''); } catch (_) {}
          return {
            id: Buffer.from(r.url).toString('base64').slice(0, 12),
            title: r.title || r.url,
            url: r.url,
            source_name: hostname || 'Web',
            pub_date: r.date || null,
            snippet: (r.description || r.content || '').slice(0, 300),
            via: 'layer2_authors',
          };
        });
    })
  );

  const candidates = [];
  results.forEach(r => { if (r.status === 'fulfilled') candidates.push(...r.value); });
  return candidates;
}

// ── Layer 3 NewsAPI — Event Registry (80K+ sources) ─────────────────────────
// Catches industry trade press that Google News misses (ThinkAdvisor, RIABiz,
// Financial Planning, WealthManagement.com, etc). Uses keyword search with
// date filtering (last 7 days) and dedup skip.
// API: https://eventregistry.org/api/v1/article/getArticles

const NEWSAPI_QUERIES = [
  'AI wealth management advisor',
  'financial advisor artificial intelligence platform',
  'wealthtech AI fintech',
  'private banking AI deployment',
];

async function discoverFromNewsAPI(existingUrls) {
  if (!process.env.NEWSAPI_KEY) return [];

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const dateStart = weekAgo.toISOString().slice(0, 10);
  const dateEnd = now.toISOString().slice(0, 10);

  const results = await Promise.allSettled(
    NEWSAPI_QUERIES.map(async (keyword) => {
      try {
        const res = await fetch('https://eventregistry.org/api/v1/article/getArticles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getArticles',
            keyword,
            keywordOper: 'and',
            lang: 'eng',
            dateStart,
            dateEnd,
            isDuplicateFilter: 'skipDuplicates',
            resultType: 'articles',
            articlesSortBy: 'date',
            articlesCount: 30,
            articlesPage: 1,
            apiKey: process.env.NEWSAPI_KEY,
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data?.articles?.results || [])
          .filter(a => {
            if (!a.url || existingUrls.has(normalizeUrl(a.url))) return false;
            return true;
          })
          .map(a => ({
            id: Buffer.from(a.url).toString('base64').slice(0, 12),
            title: a.title || a.url,
            url: a.url,
            source_name: a.source?.title || 'NewsAPI',
            pub_date: a.dateTime || a.date || null,
            snippet: (a.body || '').slice(0, 300),
            selected: true,
            via: 'layer3_newsapi',
          }));
      } catch (_) {
        return [];
      }
    })
  );

  const candidates = [];
  results.forEach(r => { if (r.status === 'fulfilled') candidates.push(...r.value); });
  return candidates.filter(c => isRelevant(`${c.title} ${c.snippet}`));
}

// ── Test exports — pure functions, no side effects ────────────────────────────
// Exported so run-tests.js can test them without calling external APIs.
export { isRelevant, normalizeUrl, buildCompanyQueries, buildCapabilityQueries, buildAuthorQueries };

// ── Main export ───────────────────────────────────────────────────────────────

export async function autoDiscover({ send }) {
  // Load landscape, capabilities, and TL data — this is what makes the system self-expanding
  const competitors    = loadCompetitors();
  const capabilities   = loadCapabilities();
  const tlEntries      = loadTLEntries();

  // Build the dynamic tracked company names list for scoring
  TRACKED_COMPANY_NAMES = competitors.map(c => c.name);

  // Known company sets — used by scheduler to detect new entrants
  const knownCompanyIds   = new Set(competitors.map(c => c.id));
  const knownCompanyNames = new Set(competitors.map(c => (c.name || '').toLowerCase()));

  send('status', { message: `Loaded ${competitors.length} companies, ${capabilities.length} capability dimensions + ${tlEntries.length} TL entries` });
  const hasNewsAPI = !!process.env.NEWSAPI_KEY;
  send('status', { message: `Running ${hasNewsAPI ? 'four' : 'three'}-layer discovery — L1 News: 8 queries; L1 Capabilities: ${capabilities.length} queries; L2 Companies: ${competitors.length} queries${hasNewsAPI ? '; L3 NewsAPI: 4 queries' : ''}...` });

  const existingUrls = getExistingUrls();
  const publishedCompanyDates = getPublishedCompanyDates();

  // Run all layers in parallel (NewsAPI added as L3 if key present)
  const [l1NewsResult, l1CapsResult, l2CosResult, l3NewsAPIResult, l1TlResult, l2AuthResult] = await Promise.allSettled([
    discoverFromLayer1News(existingUrls),
    discoverFromLayer1Capabilities(existingUrls, capabilities),
    discoverFromLayer2Companies(existingUrls, competitors),
    discoverFromNewsAPI(existingUrls),
    discoverFromLayer1TL(existingUrls),
    discoverFromLayer2Authors(existingUrls, tlEntries),
  ]);

  const l1News   = l1NewsResult.status   === 'fulfilled' ? l1NewsResult.value   : [];
  const l1Caps   = l1CapsResult.status   === 'fulfilled' ? l1CapsResult.value   : [];
  const l2Cos    = l2CosResult.status    === 'fulfilled' ? l2CosResult.value    : [];
  const l3News   = l3NewsAPIResult.status === 'fulfilled' ? l3NewsAPIResult.value : [];
  const l1TL     = l1TlResult.status     === 'fulfilled' ? l1TlResult.value     : [];
  const l2Auth   = l2AuthResult.status   === 'fulfilled' ? l2AuthResult.value   : [];

  send('progress', {
    layer1_news:          `${l1News.length} found`,
    layer1_capabilities:  `${l1Caps.length} found (${capabilities.length} capability dimensions queried)`,
    layer2_companies:     `${l2Cos.length} found (${competitors.length} companies queried)`,
    layer3_newsapi:       `${l3News.length} found (${NEWSAPI_QUERIES.length} queries)`,
    layer1_tl:            `${l1TL.length} found`,
    layer2_authors:       `${l2Auth.length} found (${buildAuthorQueries(tlEntries).length} authors queried)`,
  });

  // ── Intelligence candidates pipeline ─────────────────────────────────────────

  // Merge L1 News + L1 Capabilities + L2 Companies + L3 NewsAPI, URL-dedup + company-date proximity dedup
  const seenIntelUrls = new Set();
  let companyDateDupes = 0;
  const allIntel = [...l1News, ...l1Caps, ...l2Cos, ...l3News].filter(c => {
    const norm = normalizeUrl(c.url || '');
    if (!norm || seenIntelUrls.has(norm)) return false;
    seenIntelUrls.add(norm);
    // Company + headline proximity check — catches same story from different publications
    if (isCompanyDateDuplicate(c.title, TRACKED_COMPANY_NAMES, publishedCompanyDates)) {
      companyDateDupes++;
      return false;
    }
    return true;
  });
  if (companyDateDupes > 0) {
    send('status', { message: `Company-date proximity dedup: ${companyDateDupes} candidate(s) matched existing published stories` });
  }

  // Rule-based scoring → top 40
  const top40 = allIntel
    .map(c => ({ ...c, score: scoreCandidate(c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  // Semantic dedup vs published entries
  send('status', { message: `Semantic dedup — checking ${top40.length} intel candidates vs published entries...` });
  const deduplicated = await semanticDedup(top40);
  send('status', { message: `Semantic dedup: ${top40.length - deduplicated.length} near-duplicate(s) removed, ${deduplicated.length} remain` });

  // Rerank by semantic relevance
  send('status', { message: `Reranking ${deduplicated.length} candidates...` });
  const intelCandidates = await rerankCandidates(deduplicated);

  // ── Thought leadership candidates (raw — for Telegram surfacing only) ─────────

  const seenTLUrls = new Set();
  const tlCandidates = [...l1TL, ...l2Auth].filter(c => {
    const norm = normalizeUrl(c.url || '');
    if (!norm || seenTLUrls.has(norm)) return false;
    seenTLUrls.add(norm);
    return true;
  });

  send('done', {
    intelCandidates,
    tlCandidates,
    knownCompanyIds,
    knownCompanyNames,
    sources: {
      layer1_news:           l1News.length,
      layer1_capabilities:   l1Caps.length,
      layer2_companies:      l2Cos.length,
      layer3_newsapi:        l3News.length,
      layer1_tl:             l1TL.length,
      layer2_authors:        l2Auth.length,
      companies_queried:     competitors.length,
      capabilities_queried:  capabilities.length,
      raw_intel_total:       allIntel.length,
    },
  });
}
