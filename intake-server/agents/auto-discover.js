/**
 * auto-discover.js
 * Runs all discovery sources in parallel:
 *   - 11 RSS feeds (wealth management publications)
 *   - 7 Jina s.jina.ai web searches (pre-built queries)
 *   - 5 DataForSEO Google News searches (pre-built queries)
 * Deduplicates against existing portal entries.
 * Scores and returns ranked top 20 candidates.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import Parser from 'rss-parser';

// ── Jina Embeddings + Reranker ─────────────────────────────────────────────

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
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

// Load headline + summary text from each published intelligence entry
function getPublishedEntryTexts() {
  try {
    const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const e = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
      return `${e.headline || ''} ${e.summary || ''}`.trim();
    }).filter(Boolean);
  } catch (_) {
    return [];
  }
}

// Semantic deduplication: drop candidates whose story is already covered in a published entry
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

  const SIMILARITY_THRESHOLD = 0.90;

  return candidates.filter((_, i) => {
    const candEmb = candEmbeddings[i];
    return !pubEmbeddings.some(pubEmb => cosineSimilarity(candEmb, pubEmb) >= SIMILARITY_THRESHOLD);
  });
}

// Rerank discovery candidates by semantic relevance to AI developments in wealth management
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
        query: 'significant AI product launch or milestone in wealth management financial services',
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(process.env.DATA_DIR || join(__dirname, '..', '..'), 'data', 'intelligence');
const FEEDS_PATH = join(__dirname, '..', 'rss-feeds.json');
const rssParser = new Parser({ timeout: 12000 });

// ── Existing portal URLs for deduplication ────────────────────────────────────
function getExistingUrls() {
  const urls = new Set();
  try {
    const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const entry = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
      if (entry.source_url) urls.add(normalizeUrl(entry.source_url));
    }
  } catch (_) {}
  return urls;
}

function normalizeUrl(url) {
  try { return new URL(url).href.toLowerCase().replace(/\/$/, ''); } catch (_) { return url.toLowerCase(); }
}

// ── Two-gate relevance filter ─────────────────────────────────────────────────
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

// ── Scoring ───────────────────────────────────────────────────────────────────
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
const TRACKED_COMPANIES = [
  'morgan stanley', 'goldman sachs', 'ubs', 'merrill', 'schwab', 'fidelity',
  'blackrock', 'vanguard', 'lpl', 'jpmorgan', 'citi', 'hsbc', 'dbs',
  'altruist', 'wealthfront', 'betterment', 'robinhood', 'arta',
  'envestnet', 'orion', 'addepar', 'broadridge', 'fnz', 'farther',
  'public.com', 'etoro', 'webull', 'savvy wealth', 'betterment',
];

function scoreCandidate(c) {
  let score = 0;
  const text = `${c.title} ${c.snippet}`.toLowerCase();

  // Recency
  if (c.pub_date) {
    const ageDays = (Date.now() - new Date(c.pub_date).getTime()) / 86400000;
    if (ageDays < 2)  score += 10;
    else if (ageDays < 5)  score += 6;
    else if (ageDays < 14) score += 3;
  }

  // Source quality
  let hostname = '';
  try { hostname = new URL(c.url).hostname.replace(/^www\./, ''); } catch (_) {}
  if (PRIMARY_OUTLETS.has(hostname)) score += 6;
  else if (TIER1_OUTLETS.has(hostname)) score += 4;

  // Tracked company mention (+2 each, max 6)
  let coScore = 0;
  for (const co of TRACKED_COMPANIES) {
    if (text.includes(co)) { coScore += 2; if (coScore >= 6) break; }
  }
  score += coScore;

  // AI keyword density (max 4)
  let aiScore = 0;
  for (const k of AI_KWS) {
    if (text.includes(k)) { aiScore += 1; if (aiScore >= 4) break; }
  }
  score += aiScore;

  // Source type bonus
  if (c.via === 'content_analysis') score += 4 + Math.min(Math.floor((c.quality_score || 0)), 2); // quality score bonus up to +6 total
  else if (c.via === 'dataforseo') score += 3;
  else if (c.via === 'jina_search') score += 2;

  return score;
}

// ── RSS Discovery ─────────────────────────────────────────────────────────────
async function discoverFromRSS(existingUrls) {
  const feeds = JSON.parse(readFileSync(FEEDS_PATH, 'utf8'));
  const candidates = [];

  await Promise.allSettled(feeds.map(async (feed) => {
    try {
      const parsed = await rssParser.parseURL(feed.url);
      const relevant = parsed.items
        .filter(item => {
          if (!item.link) return false;
          if (existingUrls.has(normalizeUrl(item.link))) return false;
          const ageDays = item.pubDate
            ? (Date.now() - new Date(item.pubDate).getTime()) / 86400000 : 999;
          if (ageDays > 14) return false;
          return isRelevant(`${item.title || ''} ${item.contentSnippet || ''}`);
        })
        .slice(0, 3)
        .map(item => ({
          id: Buffer.from(item.link).toString('base64').slice(0, 12),
          title: item.title || 'Untitled',
          url: item.link,
          source_name: feed.name,
          pub_date: item.pubDate || null,
          snippet: (item.contentSnippet || '').slice(0, 300),
          selected: true,
          via: 'rss',
        }));
      candidates.push(...relevant);
    } catch (_) {}
  }));

  return candidates;
}

// ── Jina Search Discovery ─────────────────────────────────────────────────────
const JINA_QUERIES = [
  'AI wealth management product launch 2025',
  'financial advisor AI tool announcement 2025',
  'Goldman Sachs Morgan Stanley UBS AI 2025',
  'Anthropic Claude OpenAI financial services partnership 2025',
  'robo-advisor wealthtech AI platform launch 2025',
  'private banking generative AI wealth platform 2025',
  'RIA custodian AI fintech funding announcement 2025',
];

async function discoverFromJina(existingUrls) {
  if (!process.env.JINA_API_KEY) return [];
  const candidates = [];

  const results = await Promise.allSettled(
    JINA_QUERIES.map(async (query) => {
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
            const ageDays = (Date.now() - new Date(r.date).getTime()) / (1000 * 60 * 60 * 24);
            if (ageDays > 90) return false;
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
            selected: true,
            via: 'jina_search',
          };
        })
        .filter(c => isRelevant(`${c.title} ${c.snippet}`));
    })
  );

  results.forEach(r => { if (r.status === 'fulfilled') candidates.push(...r.value); });
  return candidates;
}

// ── DataForSEO Content Analysis Search — 4th discovery source ────────────────
// Finds web mentions of company + AI keywords with quality score + date filtering.
// Complements Google News (which only returns recent news) by surfacing high-quality
// articles from blogs, reports, and trade press that Google News may miss.

const CONTENT_ANALYSIS_QUERIES = [
  'Goldman Sachs artificial intelligence wealth',
  'Morgan Stanley AI advisor platform',
  'JPMorgan wealth management AI',
  'Altruist Hazel AI advisor',
  'LPL Financial AI tools advisors',
  'UBS AI private banking',
  'wealthtech AI platform launch 2026',
];

async function discoverFromContentAnalysis(existingUrls) {
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) return [];
  const AUTH = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64');
  const candidates = [];

  const results = await Promise.allSettled(
    CONTENT_ANALYSIS_QUERIES.map(async (keyword) => {
      const res = await fetch(
        'https://api.dataforseo.com/v3/content_analysis/search/live',
        {
          method: 'POST',
          headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            keyword,
            filters: [
              ['content_quality_score', '>', 2],
              'and',
              ['page_types', 'has', 'news'],
            ],
            order_by: ['date_published,desc'],
            limit: 8,
          }]),
          signal: AbortSignal.timeout(25000),
        }
      );
      if (!res.ok) return [];
      const data = await res.json();
      const items = data?.tasks?.[0]?.result?.[0]?.items || [];

      return items
        .filter(i => {
          if (!i.url) return false;
          // Only include articles from last 90 days
          if (i.date_published) {
            const age = (Date.now() - new Date(i.date_published).getTime()) / (1000 * 60 * 60 * 24);
            if (age > 90) return false;
          }
          return !existingUrls.has(normalizeUrl(i.url));
        })
        .map(i => {
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
            via: 'content_analysis',
            quality_score: i.content_quality_score || 0,
          };
        })
        .filter(c => isRelevant(`${c.title} ${c.snippet}`));
    })
  );

  results.forEach(r => { if (r.status === 'fulfilled') candidates.push(...r.value); });
  return candidates;
}

// ── DataForSEO Google News Discovery ─────────────────────────────────────────
const DFS_QUERIES = [
  'AI wealth management news',
  'financial advisor AI product launch',
  'wealthtech artificial intelligence platform 2026',
  'Goldman Sachs UBS Morgan Stanley AI advisor',
  'Anthropic OpenAI wealth management financial services',
];

async function discoverFromDataForSEO(existingUrls) {
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) return [];
  const AUTH = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64');
  const candidates = [];

  const results = await Promise.allSettled(
    DFS_QUERIES.map(async (keyword) => {
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
      const items = (data?.tasks?.[0]?.result?.[0]?.items || [])
        .filter(i => {
          if (!i.url || existingUrls.has(normalizeUrl(i.url))) return false;
          if (i.date_published) {
            const ageDays = (Date.now() - new Date(i.date_published).getTime()) / (1000 * 60 * 60 * 24);
            if (ageDays > 90) return false;
          }
          return true;
        })
        .slice(0, 8);

      return items.map(i => {
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
          via: 'dataforseo',
        };
      }).filter(c => isRelevant(`${c.title} ${c.snippet}`));
    })
  );

  results.forEach(r => { if (r.status === 'fulfilled') candidates.push(...r.value); });
  return candidates;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function autoDiscover({ send }) {
  send('status', { message: 'Loading existing portal entries...' });
  const existingUrls = getExistingUrls();

  send('status', { message: `Running discovery — RSS feeds, Jina searches, DataForSEO News + Content Analysis...` });
  send('progress', { rss: 'scanning', jina: 'searching', dfs: 'querying', ca: 'querying' });

  const [rssResult, jinaResult, dfsResult, caResult] = await Promise.allSettled([
    discoverFromRSS(existingUrls),
    discoverFromJina(existingUrls),
    discoverFromDataForSEO(existingUrls),
    discoverFromContentAnalysis(existingUrls),
  ]);

  const rss  = rssResult.status  === 'fulfilled' ? rssResult.value  : [];
  const jina = jinaResult.status === 'fulfilled' ? jinaResult.value : [];
  const dfs  = dfsResult.status  === 'fulfilled' ? dfsResult.value  : [];
  const ca   = caResult.status   === 'fulfilled' ? caResult.value   : [];

  send('progress', {
    rss:  `${rss.length} found`,
    jina: `${jina.length} found`,
    dfs:  `${dfs.length} found`,
    ca:   `${ca.length} found`,
  });

  // Merge + deduplicate by URL
  const seenUrls = new Set();
  const all = [...rss, ...jina, ...dfs, ...ca].filter(c => {
    const norm = normalizeUrl(c.url || '');
    if (!norm || seenUrls.has(norm)) return false;
    seenUrls.add(norm);
    return true;
  });

  // Rule-based scoring → top 40 (business rules: recency, tracked company, source quality)
  const top40 = all
    .map(c => ({ ...c, score: scoreCandidate(c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  // Stage 2b: Semantic dedup — drop candidates whose story is already in the portal
  send('status', { message: `Semantic dedup — checking ${top40.length} candidates against published entries...` });
  const deduplicated = await semanticDedup(top40);
  send('status', { message: `Semantic dedup: ${top40.length - deduplicated.length} near-duplicate(s) removed, ${deduplicated.length} remain` });

  // Stage 3: Jina Reranker — refine by semantic relevance within deduplicated pool
  send('status', { message: `Reranking ${deduplicated.length} candidates by semantic relevance...` });
  const ranked = await rerankCandidates(deduplicated);

  send('done', {
    candidates: ranked,
    total: ranked.length,
    sources: {
      rss: rss.length,
      jina: jina.length,
      dataforseo: dfs.length,
      content_analysis: ca.length,
      raw_total: all.length,
    },
  });
}
