/**
 * research-agent.js — Deep multi-source research for the v2 content pipeline
 *
 * Takes a candidate URL and produces a Research Brief:
 *   1. Fetch primary source
 *   2. Extract entities (company, people, metrics, capability)
 *   3. Search for 5-10 additional sources using entities
 *   4. Fetch and read each source (FULL TEXT)
 *   5. Load landscape context (company file, past entries, peer competitors)
 *   6. Determine what's genuinely new vs what we already know
 *   7. Detect cross-source conflicts
 *   8. Abort gate: if confidence is low and sources < 2, park candidate
 *
 * Output: Research Brief JSON — the foundation for Writer, Evaluator, and Fabrication agents
 */

import fetch from 'node-fetch';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  INTEL_DIR, COMPETITORS_DIR, CAPABILITIES_DIR,
  PAYWALLED_DOMAINS, PRESS_RELEASE_DOMAINS, TIER1_MEDIA,
  MODEL,
} from './config.js';
import {
  loadPublishedEntriesForCompany, loadCompetitorFile,
  loadAllCompetitors, findTopCompetitorsByCapability,
  MATURITY_RANK,
} from './context-enricher.js';
import { normalizeCompanySlug } from './intake.js';
import {
  upsertSource, storeBrief, getCompanyContext,
} from './kb-client.js';

const client = new Anthropic();

// ── Source fetching (reuses Jina pattern from intake.js) ────────────────────

async function fetchArticle(url) {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const headers = { 'Accept': 'text/markdown', 'X-Return-Format': 'markdown' };
  if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;

  try {
    const res = await fetch(jinaUrl, { headers, signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    const markdown = await res.text();
    if (markdown.length < 200) return null;

    const paywall = markdown.includes('Subscribe to continue') ||
      markdown.includes('Sign in to read') ||
      markdown.includes('Create a free account') ||
      markdown.toLowerCase().includes('paywall');
    const wordCount = markdown.split(/\s+/).length;

    return { markdown, word_count: wordCount, paywall_suspected: paywall };
  } catch (_) {
    return null;
  }
}

async function fetchSourceSafe(url) {
  try {
    const result = await fetchArticle(url);
    if (!result || result.paywall_suspected) return null;
    return result;
  } catch (_) {
    return null;
  }
}

// ── Entity extraction (Claude call) ──────────────────────────────────────────

async function extractEntities(markdown, url) {
  const prompt = `Extract key entities from this article. Be thorough — every person quoted and every number mentioned matters.

ARTICLE URL: ${url}
ARTICLE TEXT (first 5000 chars):
${markdown.slice(0, 5000)}

Return JSON only. Do NOT leave arrays empty — if people are quoted or named, list them. If numbers appear, list them:
{
  "company_name": "Full company name mentioned most prominently",
  "company_slug": "lowercase-hyphenated (e.g. bank-of-america, morgan-stanley, bofa-merrill)",
  "people": ["Full Name — Title, Organization (e.g. 'Jed Finn — Head of Wealth Management, Morgan Stanley')"],
  "metrics": ["Every number: $80M, 15,000 advisors, 98% adoption, 4 hours saved, 30 billion interactions — list ALL numbers from the article"],
  "capability_area": "advisor_productivity | client_personalization | investment_portfolio | research_content | client_acquisition | operations_compliance | new_business_models | unknown",
  "key_topic": "2-5 word description of what happened (e.g. 'AI meeting automation rollout')",
  "event_type": "funding | acquisition | regulatory | partnership | product_launch | milestone | strategy_move | market_signal"
}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content[0].text.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
}

// ── Multi-source search ──────────────────────────────────────────────────────

async function searchJina(query) {
  if (!process.env.JINA_API_KEY) return [];
  try {
    const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${process.env.JINA_API_KEY}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map(r => ({ url: r.url, title: r.title || '', snippet: r.description || '' }));
  } catch (_) {
    return [];
  }
}

async function searchNewsAPI(query) {
  if (!process.env.NEWSAPI_KEY) return [];
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 14 * 86400000); // 14-day window for research
    const res = await fetch('https://eventregistry.org/api/v1/article/getArticles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getArticles',
        keyword: query,
        keywordOper: 'and',
        lang: 'eng',
        dateStart: weekAgo.toISOString().slice(0, 10),
        dateEnd: now.toISOString().slice(0, 10),
        isDuplicateFilter: 'skipDuplicates',
        resultType: 'articles',
        articlesSortBy: 'date',
        articlesCount: 10,
        apiKey: process.env.NEWSAPI_KEY,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.articles?.results || []).map(a => ({
      url: a.url, title: a.title || '', snippet: (a.body || '').slice(0, 200),
    }));
  } catch (_) {
    return [];
  }
}

async function findSources(entities, originalUrl) {
  const originalHostname = (() => {
    try { return new URL(originalUrl).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
  })();

  const seen = new Set([originalUrl]);
  const candidates = [];

  // Build entity-based queries (not generic keywords)
  const queries = [];
  if (entities.company_name && entities.key_topic) {
    queries.push(`${entities.company_name} ${entities.key_topic}`);
  }
  if (entities.company_name) {
    queries.push(`${entities.company_name} AI ${new Date().getFullYear()}`);
  }
  if (entities.people?.[0]) {
    const firstName = entities.people[0].split('—')[0].trim();
    queries.push(`${firstName} ${entities.company_name || ''}`);
  }

  // Search via Jina for each query
  for (const q of queries) {
    const results = await searchJina(q);
    for (const r of results) {
      if (!r.url || seen.has(r.url)) continue;
      let hostname = '';
      try { hostname = new URL(r.url).hostname.replace(/^www\./, ''); } catch (_) { continue; }
      if (hostname === originalHostname) continue;
      if (PAYWALLED_DOMAINS.has(hostname)) continue;
      seen.add(r.url);
      candidates.push({ ...r, hostname, via: 'jina' });
    }
  }

  // Search via NewsAPI
  if (entities.company_name) {
    const newsResults = await searchNewsAPI(`${entities.company_name} AI`);
    for (const r of newsResults) {
      if (!r.url || seen.has(r.url)) continue;
      let hostname = '';
      try { hostname = new URL(r.url).hostname.replace(/^www\./, ''); } catch (_) { continue; }
      if (hostname === originalHostname) continue;
      if (PAYWALLED_DOMAINS.has(hostname)) continue;
      seen.add(r.url);
      candidates.push({ ...r, hostname, via: 'newsapi' });
    }
  }

  // Score and sort: press releases first, then tier 1, then trade press
  const scored = candidates.map(c => ({
    ...c,
    score: PRESS_RELEASE_DOMAINS.has(c.hostname) ? 3
      : TIER1_MEDIA.has(c.hostname) ? 2
      : 1,
  }));
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 10);
}

// ── Source classification ─────────────────────────────────────────────────────

function classifySourceType(url) {
  let hostname = '';
  try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return 'coverage'; }

  if (PRESS_RELEASE_DOMAINS.has(hostname)) return 'primary';
  if (/newsroom\.|\/newsroom|\/press-releases|\/press-release|investor\.|press\./.test(url)) return 'primary';
  return 'coverage';
}

// ── Landscape context loading ─────────────────────────────────────────────────

function loadLandscapeContext(companySlug, capabilityId) {
  const companyData = loadCompetitorFile(companySlug);
  const pastEntries = loadPublishedEntriesForCompany(companySlug, 5);
  const allCompetitors = loadAllCompetitors();

  let peers = [];
  if (companyData && capabilityId && capabilityId !== 'unknown') {
    peers = findTopCompetitorsByCapability(companyData, capabilityId, allCompetitors, 3);
  }

  return {
    company: companyData ? {
      id: companyData.id,
      name: companyData.name,
      segment: companyData.segment,
      overall_maturity: companyData.overall_maturity,
      ai_strategy_summary: companyData.ai_strategy_summary,
      headline_metric: companyData.headline_metric,
      capabilities: companyData.capabilities ? Object.fromEntries(
        Object.entries(companyData.capabilities).map(([k, v]) => [k, {
          maturity: v.maturity,
          headline: v.headline,
        }])
      ) : {},
      last_updated: companyData.last_updated,
    } : null,
    past_entries: pastEntries.map(e => ({
      id: e.id,
      headline: e.headline,
      date: e.date,
      the_so_what: e.the_so_what,
      type: e.type,
      key_stat: e.key_stat,
    })),
    peers: peers.map(p => ({
      name: p.name,
      maturity: p.maturity,
      headline: p.headline,
    })),
    is_tracked: !!companyData,
  };
}

// ── What's new determination ──────────────────────────────────────────────────

function determineWhatsNew(entities, landscapeContext, primaryContent) {
  if (!landscapeContext.is_tracked) {
    return 'New company — not currently in our landscape. First coverage.';
  }

  const pastEntries = landscapeContext.past_entries;
  if (pastEntries.length === 0) {
    return 'Tracked company but no previous entries. First intelligence on this firm.';
  }

  const capId = entities.capability_area;
  const currentMaturity = landscapeContext.company?.capabilities?.[capId]?.maturity || 'no_activity';
  const currentHeadline = landscapeContext.company?.capabilities?.[capId]?.headline || '';

  const recentHeadlines = pastEntries.map(e => e.headline).join(' | ');

  return `Company has ${pastEntries.length} past entries. Most recent: "${pastEntries[0].headline}" (${pastEntries[0].date}). Current ${capId} maturity: ${currentMaturity}. Current headline: "${currentHeadline}". Compare against this story to identify what is genuinely new.`;
}

// ── Cross-source conflict detection ──────────────────────────────────────────

function detectConflicts(sources) {
  // Conflict detection is deferred to the Fabrication Agent (Session 16)
  // where it has the structured entry to compare against.
  // At research stage, we just flag if sources exist — the Fabrication Agent
  // does the detailed claim-by-claim cross-source verification.
  return [];
}

// ── Main: Research Agent ─────────────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {string} params.url - Candidate URL
 * @param {string} params.title - Candidate title from discovery
 * @param {string} params.source_name - Source publication name
 * @param {function} params.send - SSE event emitter (event, data) => void
 * @returns {Object} Research Brief or { aborted: true, reason: string }
 */
export async function research({ url, title, source_name, send }) {
  send('research_status', { message: 'Fetching primary source...' });

  // 1. Fetch primary source
  const primary = await fetchArticle(url);
  if (!primary) {
    return { aborted: true, reason: 'Could not fetch primary source' };
  }

  send('research_status', {
    message: `Primary source: ${primary.word_count} words${primary.paywall_suspected ? ' (paywall detected)' : ''}`,
  });

  // 1b. PRINCIPLE 1: Store primary source to KB BEFORE any processing
  const primarySourceId = await upsertSource({
    url,
    title: title || null,
    source_name: source_name || null,
    content_md: primary.markdown,
    word_count: primary.word_count,
    is_paywalled: primary.paywall_suspected,
    fetched_by: 'research-agent',
  });
  if (primarySourceId) {
    send('research_status', { message: `Primary stored in KB (${primarySourceId.toString().slice(0, 8)}...)` });
  }

  // 2. Extract entities
  send('research_status', { message: 'Extracting entities...' });
  const entities = await extractEntities(primary.markdown, url);
  if (!entities) {
    return { aborted: true, reason: 'Entity extraction failed — source may be too thin' };
  }

  send('research_status', {
    message: `Entities: ${entities.company_name} | ${entities.key_topic} | ${entities.capability_area}`,
  });

  // 3. Search for additional sources
  send('research_status', { message: 'Searching for additional sources...' });
  const sourceCandidates = await findSources(entities, url);

  send('research_status', { message: `Found ${sourceCandidates.length} candidate sources. Fetching...` });

  // 4. Fetch each source (FULL TEXT, not compressed) + store to KB
  const fetchedSources = [];
  const additionalSourceIds = [];
  for (const candidate of sourceCandidates.slice(0, 8)) {
    const fetched = await fetchSourceSafe(candidate.url);
    if (fetched) {
      // PRINCIPLE 1: Store to KB before any processing
      const srcId = await upsertSource({
        url: candidate.url,
        title: candidate.title || null,
        source_name: candidate.hostname,
        content_md: fetched.markdown,
        word_count: fetched.word_count,
        fetched_by: 'research-agent',
      });
      if (srcId) additionalSourceIds.push(srcId);

      fetchedSources.push({
        url: candidate.url,
        name: candidate.hostname,
        title: candidate.title,
        type: classifySourceType(candidate.url),
        content: fetched.markdown, // FULL TEXT
        word_count: fetched.word_count,
        via: candidate.via,
      });
    }
    if (fetchedSources.length >= 5) break; // cap at 5 successfully fetched
  }

  send('research_status', {
    message: `${fetchedSources.length} sources fetched successfully: ${fetchedSources.map(s => s.name).join(', ')}`,
  });

  // 5. Load landscape context (flat files + KB for institutional memory)
  send('research_status', { message: 'Loading landscape context...' });
  const normalizedSlug = normalizeCompanySlug(entities.company_slug || '');
  const landscapeContext = loadLandscapeContext(
    normalizedSlug,
    entities.capability_area || 'unknown'
  );

  // Query KB for additional company context (prior sources, published entries, landscape)
  const kbContext = await getCompanyContext(normalizedSlug);
  if (kbContext.sources.length > 0 || kbContext.entries.length > 0) {
    send('research_status', {
      message: `KB context: ${kbContext.sources.length} prior sources, ${kbContext.entries.length} published entries`,
    });
  }

  // 6. What's new
  const whats_new = determineWhatsNew(entities, landscapeContext, primary.markdown);

  // 7. Cross-source conflict detection
  const allSources = [
    { name: source_name || 'Primary', url, content: primary.markdown },
    ...fetchedSources,
  ];
  const conflicts = await detectConflicts(allSources);

  // 8. Build sources array for the entry
  const sources = [];
  // Add fetched enrichment sources
  for (const s of fetchedSources) {
    sources.push({ name: s.name, url: s.url, type: s.type });
  }
  // Add primary/discovery source
  const discoveryHostname = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
  })();
  sources.push({
    name: source_name || discoveryHostname,
    url,
    type: classifySourceType(url) === 'primary' ? 'primary' : 'discovery',
  });
  // Sort: primary first, then coverage, then discovery
  const typeOrder = { primary: 0, coverage: 1, discovery: 2 };
  sources.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));

  // 9. Confidence assessment
  const totalSources = 1 + fetchedSources.length;
  const hasPrimary = sources.some(s => s.type === 'primary');
  const confidence = totalSources >= 3 && hasPrimary ? 'high'
    : totalSources >= 2 ? 'medium'
    : 'low';

  // 10. Abort gate
  if (confidence === 'low' && totalSources < 2 && primary.word_count < 300) {
    send('research_status', { message: 'Abort gate: insufficient source material' });
    return {
      aborted: true,
      reason: `Insufficient source material: ${totalSources} source(s), ${primary.word_count} words, confidence ${confidence}`,
      entities,
    };
  }

  // 11. Assemble Research Brief
  const brief = {
    // Candidate info
    candidate_url: url,
    candidate_title: title,
    candidate_source: source_name,

    // Entities
    entities,

    // Primary source (FULL TEXT)
    primary_source: {
      url,
      name: source_name || discoveryHostname,
      content: primary.markdown,
      word_count: primary.word_count,
      paywall_suspected: primary.paywall_suspected,
    },

    // Additional sources (FULL TEXT each)
    additional_sources: fetchedSources.map(s => ({
      url: s.url,
      name: s.name,
      title: s.title,
      type: s.type,
      content: s.content, // FULL TEXT
      word_count: s.word_count,
      via: s.via,
    })),

    // Sources array for the entry (without full content)
    sources,
    source_count: sources.length,

    // Landscape context
    landscape: {
      company: landscapeContext.company,
      past_entries: landscapeContext.past_entries,
      peers: landscapeContext.peers,
      is_tracked: landscapeContext.is_tracked,
    },

    // Analysis
    whats_new,
    cross_source_conflicts: conflicts,

    // Quality
    research_confidence: confidence,
    total_source_word_count: primary.word_count + fetchedSources.reduce((sum, s) => sum + s.word_count, 0),

    // Timestamp
    researched_at: new Date().toISOString(),
  };

  // 12. Persist research brief to KB
  const briefId = await storeBrief({
    candidate_url: url,
    company_id: normalizedSlug || null,
    vertical_id: 'wealth',
    entities,
    primary_source_id: primarySourceId || null,
    additional_source_ids: additionalSourceIds,
    landscape_snapshot: {
      is_tracked: landscapeContext.is_tracked,
      company_summary: landscapeContext.company?.ai_strategy_summary || null,
      past_entries: landscapeContext.past_entries.map(e => e.headline),
      peers: landscapeContext.peers.map(p => p.name),
    },
    whats_new,
    source_count: totalSources,
    total_word_count: brief.total_source_word_count,
    triage_score: null, // set later by scorer
    status: 'ready',
  });
  if (briefId) {
    brief.brief_id = briefId;
    send('research_status', { message: `Brief persisted to KB (${briefId.toString().slice(0, 8)}...)` });
  }

  send('research_complete', {
    message: `Research complete: ${totalSources} sources, ${brief.total_source_word_count} words, confidence: ${confidence}`,
    source_count: totalSources,
    confidence,
    entities: entities,
    whats_new,
    conflicts: conflicts.length,
    brief_id: briefId || null,
  });

  return brief;
}
