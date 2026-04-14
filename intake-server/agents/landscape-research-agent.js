/**
 * landscape-research-agent.js — Deep research for landscape company profiles
 *
 * Gathers ALL available information about a company's AI strategy:
 *   1. Our own intelligence entries about this company
 *   2. Our thought leadership that mentions this company
 *   3. Current landscape profile (what we already have)
 *   4. WebSearch for latest AI strategy news
 *   5. Company newsroom / press releases
 *   6. Industry analyst coverage
 *
 * Output: Landscape Research Brief — the foundation for the Writer Agent
 */

import fetch from 'node-fetch';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  INTEL_DIR, COMPETITORS_DIR, TL_DIR,
  PRESS_RELEASE_DOMAINS, TIER1_MEDIA, PAYWALLED_DOMAINS,
} from './config.js';

// ── Load our own intelligence entries for a company ──────────────────────────

function loadIntelligenceForCompany(companySlug) {
  try {
    return readdirSync(INTEL_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(readFileSync(join(INTEL_DIR, f), 'utf8')); } catch { return null; }
      })
      .filter(Boolean)
      .filter(e => {
        // Match by company slug OR by company being mentioned in the_so_what
        return e.company === companySlug ||
          (e.the_so_what || '').toLowerCase().includes(companySlug.replace(/-/g, ' '));
      })
      .map(e => ({
        id: e.id,
        headline: e.headline,
        date: e.date,
        type: e.type,
        the_so_what: e.the_so_what,
        key_stat: e.key_stat,
        summary: e.summary?.slice(0, 300),
        source_count: e.source_count || e.sources?.length || 1,
      }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch { return []; }
}

// ── Load TL entries that mention this company ────────────────────────────────

function loadTLMentions(companyName) {
  try {
    return readdirSync(TL_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(readFileSync(join(TL_DIR, f), 'utf8')); } catch { return null; }
      })
      .filter(Boolean)
      .filter(e => {
        const text = JSON.stringify(e).toLowerCase();
        return text.includes(companyName.toLowerCase());
      })
      .map(e => ({
        id: e.id,
        title: e.title,
        author: e.author?.name,
        the_one_insight: e.the_one_insight,
      }));
  } catch { return []; }
}

// ── Load current landscape profile ───────────────────────────────────────────

function loadCurrentProfile(companySlug) {
  try {
    return JSON.parse(readFileSync(join(COMPETITORS_DIR, `${companySlug}.json`), 'utf8'));
  } catch { return null; }
}

// ── Load peer companies in same segment ──────────────────────────────────────

function loadPeers(companySlug, segment) {
  try {
    return readdirSync(COMPETITORS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(readFileSync(join(COMPETITORS_DIR, f), 'utf8')); } catch { return null; }
      })
      .filter(Boolean)
      .filter(c => c.segment === segment && c.id !== companySlug)
      .map(c => ({
        id: c.id,
        name: c.name,
        overall_maturity: c.overall_maturity,
        headline_metric: c.headline_metric?.slice(0, 100),
        capabilities: Object.fromEntries(
          Object.entries(c.capabilities || {}).map(([k, v]) => [k, v.maturity])
        ),
      }));
  } catch { return []; }
}

// ── Search for additional sources via Jina ───────────────────────────────────

async function searchSources(companyName) {
  if (!process.env.JINA_API_KEY) return [];

  const queries = [
    `${companyName} AI strategy wealth management 2025 2026`,
    `${companyName} AI deployment advisor technology`,
  ];

  const results = [];
  for (const query of queries) {
    try {
      const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of (data.data || [])) {
        if (!r.url) continue;
        let hostname = '';
        try { hostname = new URL(r.url).hostname.replace(/^www\./, ''); } catch { continue; }
        if (PAYWALLED_DOMAINS.has(hostname)) continue;
        results.push({
          url: r.url,
          title: r.title || '',
          snippet: r.description || '',
          hostname,
        });
      }
    } catch {}
  }

  // Deduplicate
  const seen = new Set();
  return results.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  }).slice(0, 10);
}

// ── Fetch article content via Jina ───────────────────────────────────────────

async function fetchArticle(url) {
  const headers = { 'Accept': 'text/markdown', 'X-Return-Format': 'markdown' };
  if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, { headers, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length < 200) return null;
    return text;
  } catch { return null; }
}

// ── Main: Landscape Research ─────────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {string} params.companySlug — company ID (e.g., 'morgan-stanley')
 * @param {function} params.send — SSE event emitter
 * @returns {Object} Landscape Research Brief
 */
export async function researchLandscape({ companySlug, send }) {
  send('landscape_research', { message: `Starting landscape research for ${companySlug}...` });

  // 1. Load current profile
  const currentProfile = loadCurrentProfile(companySlug);
  if (!currentProfile) {
    return { aborted: true, reason: `No landscape profile found for ${companySlug}` };
  }

  const companyName = currentProfile.name;
  const segment = currentProfile.segment;

  // 2. Load our intelligence entries
  send('landscape_research', { message: 'Loading our intelligence entries...' });
  const intelEntries = loadIntelligenceForCompany(companySlug);

  // 3. Load TL mentions
  const tlMentions = loadTLMentions(companyName);

  // 4. Load peer companies
  const peers = loadPeers(companySlug, segment);

  // 5. Search for additional sources
  send('landscape_research', { message: `Searching for ${companyName} AI coverage...` });
  const searchResults = await searchSources(companyName);

  // 6. Fetch top 3 search results
  send('landscape_research', { message: `Fetching ${Math.min(3, searchResults.length)} articles...` });
  const articles = [];
  for (const sr of searchResults.slice(0, 3)) {
    const content = await fetchArticle(sr.url);
    if (content) {
      articles.push({
        url: sr.url,
        title: sr.title,
        hostname: sr.hostname,
        content: content.slice(0, 4000), // First 4000 chars
      });
    }
  }

  // 7. Compile research brief
  const brief = {
    company: {
      id: companySlug,
      name: companyName,
      segment,
      current_profile: {
        ai_strategy_summary: currentProfile.ai_strategy_summary,
        headline_metric: currentProfile.headline_metric,
        headline_initiative: currentProfile.headline_initiative,
        overall_maturity: currentProfile.overall_maturity,
        capabilities: Object.fromEntries(
          Object.entries(currentProfile.capabilities || {}).map(([k, v]) => [k, {
            maturity: v.maturity,
            headline: v.headline,
          }])
        ),
        last_updated: currentProfile.last_updated,
      },
    },

    our_intelligence: intelEntries,
    our_tl_mentions: tlMentions,
    peers,
    search_results: searchResults.map(r => ({ url: r.url, title: r.title, hostname: r.hostname })),
    articles,

    research_confidence: articles.length >= 2 ? 'high' : articles.length >= 1 ? 'medium' : 'low',
    researched_at: new Date().toISOString(),
  };

  send('landscape_research_complete', {
    message: `Research complete: ${intelEntries.length} intel entries, ${tlMentions.length} TL mentions, ${articles.length} articles, ${peers.length} peers`,
    intel_count: intelEntries.length,
    article_count: articles.length,
    peer_count: peers.length,
    confidence: brief.research_confidence,
  });

  return brief;
}
