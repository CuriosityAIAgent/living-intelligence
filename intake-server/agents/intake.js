import fetch from 'node-fetch';
import Anthropic from '@anthropic-ai/sdk';
import slugify from 'slugify';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Company slug normalization ──────────────────────────────────────────────
// Claude generates company slugs during structuring but doesn't know our
// landscape IDs. This alias map corrects common variations to the canonical slug.
// Built dynamically from data/competitors/*.json + hardcoded overrides.

const __dirname_intake = dirname(fileURLToPath(import.meta.url));
// Content files (competitors) live in the repo clone — always resolve relative
// to this file, never from DATA_DIR (Railway persistent volume).
const DATA_ROOT = join(__dirname_intake, '..', '..');

const COMPANY_ALIAS_MAP = new Map();

// Hardcoded aliases for known variations
const MANUAL_ALIASES = {
  'arta-finance': 'arta-ai',
  'arta': 'arta-ai',
  'citigroup': 'citi-private-bank',
  'citi': 'citi-private-bank',
  'citi-wealth': 'citi-private-bank',
  'fidelity-investments': 'fidelity',
  'hsbc-private-bank': 'hsbc',
  'hsbc-wealth': 'hsbc',
  'public': 'public-com',
  'bofa': 'bofa-merrill',
  'bank-of-america': 'bofa-merrill',
  'merrill': 'bofa-merrill',
  'merrill-lynch': 'bofa-merrill',
  'jp-morgan': 'jpmorgan',
  'j-p-morgan': 'jpmorgan',
  'rbc': 'rbc-wealth-management',
  'standard-chartered-bank': 'standard-chartered',
  'julius-bar': 'julius-baer',
  'bnp-paribas': 'bnp-paribas-wealth',
  'jump': 'jump-ai',
  'societe-generale': 'societe-generale-private-banking',
  'st-james-place': 'st-jamess-place',
  'abn-amro': 'abn-amro-private-banking',
  'lloyds': 'lloyds-wealth',
  'wells-fargo-advisors': 'wells-fargo',
  'barclays': 'barclays-private-bank',
  'santander': 'santander-private-banking',
};

// Load canonical IDs from landscape
try {
  const compDir = join(DATA_ROOT, 'data', 'competitors');
  const files = readdirSync(compDir).filter(f => f.endsWith('.json'));
  const canonicalIds = new Set();
  for (const f of files) {
    const c = JSON.parse(readFileSync(join(compDir, f), 'utf8'));
    if (c.id) canonicalIds.add(c.id);
    // Also map name → id (e.g. "Goldman Sachs" → "goldman-sachs")
    if (c.name && c.id) {
      const nameSlug = slugify(c.name, { lower: true, strict: true });
      if (nameSlug !== c.id) COMPANY_ALIAS_MAP.set(nameSlug, c.id);
    }
  }
  // Add manual aliases (only if target exists in landscape)
  for (const [alias, canonical] of Object.entries(MANUAL_ALIASES)) {
    if (canonicalIds.has(canonical)) COMPANY_ALIAS_MAP.set(alias, canonical);
  }
} catch (_) {
  // Fallback: use manual aliases only
  for (const [alias, canonical] of Object.entries(MANUAL_ALIASES)) {
    COMPANY_ALIAS_MAP.set(alias, canonical);
  }
}

function normalizeCompanySlug(slug) {
  if (!slug) return slug;
  const normalized = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return COMPANY_ALIAS_MAP.get(normalized) || normalized;
}

// ── Jina Reranker — pick best paywall alternative ──────────────────────────
// Given a list of alternative URLs with title+snippet, reranks them by
// similarity to the original teaser and returns URLs in relevance order.
async function rerankAlternatives(teaser, alternatives) {
  if (!process.env.JINA_API_KEY || alternatives.length <= 1) {
    return alternatives.map(a => a.url);
  }
  try {
    const documents = alternatives.map(a => `${a.title || ''} ${a.snippet || ''}`.trim() || a.url);
    const res = await fetch('https://api.jina.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'jina-reranker-v3',
        query: teaser.slice(0, 500),
        documents,
        top_n: alternatives.length,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return alternatives.map(a => a.url);
    const data = await res.json();
    return (data.results || []).map(r => alternatives[r.index].url);
  } catch (_) {
    return alternatives.map(a => a.url);
  }
}

const client = new Anthropic();

const INTAKE_SCHEMA = `{
  "id": "url-slug-style-id",
  "type": "funding | acquisition | regulatory | partnership | product_launch | milestone | strategy_move | market_signal",
  "headline": "Concise, factual headline under 120 chars — lead with capability/impact, not the event trigger",
  "the_so_what": "One sentence of analytical insight. Choose the best angle: competitive benchmark (scale economics, compounding advantages), cross-landscape context (how this connects to what peers are doing), infrastructure parallel (comparison to historic technology shifts), or business model insight (why the model matters more than the technology). Never use CXO, board, firms should, or any directive language. Never say game-changing, landmark, or revolutionary.",
  "company": "company-slug",
  "company_name": "Full Company Name",
  "date": "YYYY-MM-DD",
  "source_name": "Publication Name",
  "source_url": "the actual URL",
  "source_verified": true,
  "image_url": null,
  "summary": "3-5 sentences. Lead with the capability being advanced and its evidence. Then explain the event (funding/launch/etc). Only facts from the source — no inference.",
  "key_stat": { "number": "X", "label": "what it measures — advisors reached, AUM affected, time saved, etc." },
  "capability_evidence": {
    "capability": "advisor_productivity | client_personalization | investment_portfolio | research_content | client_acquisition | operations_compliance | new_business_models",
    "stage": "deployed | piloting | announced",
    "evidence": "One sentence: the specific proof this capability is real/in-use, from the source",
    "metric": "Quantified impact if stated: '6 hours saved per week' or '15,000 advisors' or null"
  },
  "tags": {
    "capability": "advisor_productivity | client_personalization | investment_portfolio | research_content | client_acquisition | operations_compliance | new_business_models",
    "region": "us | emea | asia | latam | global",
    "segment": "wirehouse | global_private_bank | regional_champion | digital_disruptor | ai_native | ria_independent | advisor_tools",
    "theme": ["2-4 lowercase_underscore tags"]
  },
  "week": "YYYY-MM-DD (monday of current week)",
  "featured": false
}`;

// Domains known to be open (no paywall) — preferred for enrichment
const OPEN_DOMAINS = new Set([
  'businesswire.com', 'prnewswire.com', 'globenewswire.com', 'accesswire.com',
  'thinkadvisor.com', 'wealthmanagement.com', 'investmentnews.com',
  'financial-planning.com', 'riabiz.com', 'advisorhub.com',
  'citywire.com', 'wealthbriefing.com', 'wealthprofessional.ca',
  'fintech.global', 'pymnts.com', 'tearsheet.co', 'bankingdive.com',
  'techcrunch.com', 'axios.com', 'reuters.com', 'cnbc.com',
  'fortune.com', 'businessinsider.com', 'theblock.co', 'coindesk.com',
]);

// Domains known to be hard paywalled — skip in enrichment search
const PAYWALLED_DOMAINS = new Set([
  'ft.com', 'wsj.com', 'bloomberg.com', 'barrons.com',
  'economist.com', 'hbr.org', 'morningstar.com',
]);

// Content is "thin" if below this word count — always triggers enrichment
const THIN_CONTENT_THRESHOLD = 500;

async function fetchPageMarkdown(url) {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const headers = {
    'Accept': 'text/markdown',
    'X-Return-Format': 'markdown',
  };
  if (process.env.JINA_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
  }
  const response = await fetch(jinaUrl, {
    headers,
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Jina Reader failed: ${response.status} ${response.statusText}`);
  }

  const markdown = await response.text();

  if (markdown.length < 200) {
    throw new Error('Insufficient content extracted — page may be paywalled or JS-only');
  }

  const hasTruncationSignals =
    markdown.includes('Subscribe to continue') ||
    markdown.includes('Sign in to read') ||
    markdown.includes('Create a free account') ||
    markdown.includes('[Click here to read more]') ||
    markdown.toLowerCase().includes('paywall');

  const wordCount = markdown.split(/\s+/).length;

  return {
    markdown,
    word_count: wordCount,
    paywall_suspected: hasTruncationSignals,
    thin_content: wordCount < THIN_CONTENT_THRESHOLD,
  };
}

// Extract the most likely headline from Jina teaser markdown.
// Used as the DataForSEO search query when a paywall is hit.
function extractHeadlineFromTeaser(teaserMarkdown) {
  // Try to find an H1/H2 markdown heading first
  const headingMatch = teaserMarkdown.match(/^#{1,2}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim().slice(0, 120);

  // Fall back to first non-empty sentence (up to 120 chars)
  const firstSentence = teaserMarkdown
    .replace(/[#*`[\]()>]/g, '')
    .split(/[.\n]/)
    .map(s => s.trim())
    .find(s => s.length > 20);
  return firstSentence ? firstSentence.slice(0, 120) : '';
}

// Build keyword query from URL slug + teaser — used for non-paywalled enrichment.
function buildKeywordQuery(url, teaserMarkdown) {
  let slug = '';
  try { slug = new URL(url).pathname.replace(/[^a-z0-9\s-]/gi, ' ').replace(/-/g, ' ').trim(); } catch (_) {}

  const teaser = teaserMarkdown.slice(0, 300).replace(/[#*`[\]()]/g, '');
  const combined = `${slug} ${teaser}`.toLowerCase();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'in', 'of', 'to', 'for',
    'with', 'on', 'at', 'by', 'from', 'is', 'are', 'was', 'be', 'its', 'this', 'that',
    'as', 'it', 'has', 'have', 'how', 'what', 'why', 'when', 'html', 'www', 'com',
    'will', 'their', 'they', 'which', 'also', 'more', 'said', 'than', 'been']);
  return combined.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w)).slice(0, 10).join(' ');
}

// Search DataForSEO (Google News + Google Organic in parallel) for the story headline.
// Used when paywall detected — finds the same story on open sources.
// Returns URLs reranked by Jina Reranker using the original teaser as query.
async function findEnrichmentViaDataForSEO(headline, originalUrl, teaser) {
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) return [];

  const originalHostname = (() => {
    try { return new URL(originalUrl).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
  })();

  const AUTH = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64');

  const dfsCall = (endpoint, body) =>
    fetch(`https://api.dataforseo.com/v3/serp/google/${endpoint}/live/advanced`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keyword: headline, language_code: 'en', location_code: 2840, depth: 10, ...body }]),
      signal: AbortSignal.timeout(20000),
    }).then(r => r.ok ? r.json() : null).catch(() => null);

  // Run Google News + Google Organic in parallel — News finds recent coverage,
  // Organic finds authoritative pages (press releases, company blogs) that may rank higher
  const [newsData, organicData] = await Promise.all([
    dfsCall('news', {}),
    dfsCall('organic', {}),
  ]);

  const extractItems = (data) => data?.tasks?.[0]?.result?.[0]?.items || [];
  const allItems = [...extractItems(newsData), ...extractItems(organicData)];

  const PRESS_RELEASE_DOMAINS = ['businesswire.com', 'prnewswire.com', 'globenewswire.com', 'accesswire.com'];
  const seen = new Set();

  // Collect alternatives with title + snippet for reranking
  const alternatives = allItems
    .filter(i => {
      const url = i.url || i.relative_url;
      if (!url) return false;
      let hostname = '';
      try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return false; }
      if (hostname === originalHostname) return false;
      if (PAYWALLED_DOMAINS.has(hostname)) return false;
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .map(i => {
      const url = i.url || i.relative_url;
      let hostname = '';
      try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch (_) {}
      const isPressRelease = PRESS_RELEASE_DOMAINS.includes(hostname);
      const isOpenTrade = OPEN_DOMAINS.has(hostname);
      return {
        url,
        hostname,
        title: i.title || '',
        snippet: i.snippet || i.description || '',
        domain_score: isPressRelease ? 3 : isOpenTrade ? 2 : 1,
      };
    })
    // Pre-sort by domain quality to give reranker a clean input pool
    .sort((a, b) => b.domain_score - a.domain_score)
    .slice(0, 8);

  if (alternatives.length === 0) return [];

  // Rerank by semantic similarity to original teaser — picks the alternative
  // that most closely covers the same story, not just any open-source article
  return rerankAlternatives(teaser || headline, alternatives);
}

// Search Jina for enrichment sources — used for non-paywalled articles to get
// supplementary press releases and open trade coverage.
async function findEnrichmentViaJina(url, teaserMarkdown) {
  if (!process.env.JINA_API_KEY) return [];

  const query = buildKeywordQuery(url, teaserMarkdown);
  if (!query) return [];

  const originalHostname = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
  })();

  let searchResults = [];
  try {
    const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${process.env.JINA_API_KEY}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    searchResults = data.data || [];
  } catch (_) {
    return [];
  }

  const PRESS_RELEASE_DOMAINS = ['businesswire.com', 'prnewswire.com', 'globenewswire.com', 'accesswire.com'];

  return searchResults
    .filter(r => {
      if (!r.url) return false;
      let hostname = '';
      try { hostname = new URL(r.url).hostname.replace(/^www\./, ''); } catch (_) { return false; }
      if (hostname === originalHostname) return false;
      if (PAYWALLED_DOMAINS.has(hostname)) return false;
      return true;
    })
    .map(r => {
      let hostname = '';
      try { hostname = new URL(r.url).hostname.replace(/^www\./, ''); } catch (_) {}
      const isPressRelease = PRESS_RELEASE_DOMAINS.includes(hostname);
      const isOpenTrade = OPEN_DOMAINS.has(hostname);
      return { url: r.url, hostname, score: isPressRelease ? 3 : isOpenTrade ? 2 : 1 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(r => r.url);
}

// Route to the right enrichment strategy:
// - Paywall/thin content → DataForSEO headline search → Jina Reranker picks best match
// - Full content → Jina keyword search (fast, good for supplementary context)
async function findEnrichmentSources(url, teaserMarkdown, isPaywalled) {
  if (isPaywalled) {
    const headline = extractHeadlineFromTeaser(teaserMarkdown);
    if (headline) return findEnrichmentViaDataForSEO(headline, url, teaserMarkdown);
    // Fallback to Jina if headline extraction failed
    return findEnrichmentViaJina(url, teaserMarkdown);
  }
  return findEnrichmentViaJina(url, teaserMarkdown);
}

// Fetch markdown from an enrichment URL, silently skip on failure
async function fetchEnrichmentMarkdown(altUrl) {
  try {
    const jinaUrl = `https://r.jina.ai/${altUrl}`;
    const headers = { 'Accept': 'text/markdown', 'X-Return-Format': 'markdown' };
    if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;

    const res = await fetch(jinaUrl, { headers, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;

    const md = await res.text();
    if (md.length < 200) return null;

    // Skip if the enrichment source is also paywalled
    const alsoPaywalled =
      md.includes('Subscribe to continue') ||
      md.includes('Sign in to read') ||
      md.includes('Create a free account');
    if (alsoPaywalled) return null;

    let hostname = '';
    try { hostname = new URL(altUrl).hostname.replace(/^www\./, ''); } catch (_) {}
    return { url: altUrl, hostname, markdown: md };
  } catch (_) {
    return null;
  }
}

async function structureEntry(url, markdown, sourceInfo) {
  const hasEnrichment = sourceInfo.enrichment_sources && sourceInfo.enrichment_sources.length > 0;

  const prompt = `You are an editorial analyst for a premium wealth management intelligence publication.

Your job is NOT to summarise what happened. Every entry must answer three questions:
1. Which AI capability is advancing and what is the concrete evidence? (the intelligence)
2. What does this mean across the wealth management landscape? (the_so_what — analytical insight)
3. What was the triggering event? (context only — funding, launch, partnership)

The event is never the story. The story is always the capability advancing and the strategic insight.

SOURCE ARTICLE URL: ${url}
SOURCE NAME: ${sourceInfo.source_name}
${sourceInfo.needs_enrichment ? '⚠ Original article had limited content (paywall or thin). Enrichment sources have been added below.' : ''}
${hasEnrichment ? `\nENRICHMENT SOURCES USED:\n${sourceInfo.enrichment_sources.map(s => `- ${s}`).join('\n')}\n` : ''}

ARTICLE CONTENT (markdown):
---
${markdown.slice(0, 10000)}
---

Structure this into the following JSON schema.

CRITICAL RULES:
1. the_so_what: One sentence of analytical insight. Choose the best angle for this story:
   - Competitive benchmark: scale economics, compounding data advantages, cost-to-serve gaps
   - Cross-landscape context: connect to what peers/competitors are doing, show the pattern
   - Infrastructure parallel: compare to historic technology shifts (electronic trading, Salesforce CRM, Bloomberg terminals)
   - Business model insight: why the model matters more than the technology
   NEVER use: CXO, board, "firms should", "must now decide", "game-changing", "landmark", "revolutionary", "paradigm shift", "It remains to be seen"
   BAD: "Jump raised $80M to expand its AI meeting assistant platform." (just a summary)
   BAD: "Any wealth CXO still treating meeting workflow as a roadmap item is falling behind." (directive)
   GOOD: "Advisor productivity tools are now a funded, scaling category — 15,000 advisors already have an AI meeting workflow, establishing a per-advisor cost advantage that compounds with every client interaction."
   GOOD: "The independent channel adopting AI faster than the institutional channel is a structural reversal of the historic adoption curve, following the same pattern as discount brokerage adoption in the 1990s."

2. summary: Lead with the CAPABILITY and its EVIDENCE. Then explain the event trigger. Only facts from the source.
   BAD: "Jump raises $80M Series B to expand its AI platform."
   GOOD: "Jump's AI assistant automates meeting notes and CRM updates, saving advisors 6 hours per week. Currently used by 3,000 advisors, the company raised $80M to scale to 15,000. Lead investor Insight Partners cited advisor time savings as primary investment thesis."

3. headline: Lead with the capability impact or scale, not the dollar amount or event type.
   BAD: "Jump Raises $80M Series B"
   GOOD: "Jump Scales AI Meeting Assistant to 15,000 Advisors After $80M Series B"

4. key_stat: The single most significant number for a CXO — advisors reached, AUM affected, time saved, cost reduced. Must be explicitly stated in the source. If no meaningful number, set to null.

5. capability_evidence: Populate ALL fields if evidence exists. stage = "deployed" only if live with real users. "piloting" = being tested. "announced" = committed but not live. metric = null if no quantified impact stated.

6. If the article has no identifiable AI capability dimension for wealth management, set type to "market_signal".
7. If the article is not about AI in wealth management or financial services at all, set type to null.
8. All summary content must come ONLY from the source article above. No inference from training data.
9. For image_url: always set to null — logos are managed separately via local files
10. If multiple sources cover the same story, synthesize the most complete version. Prefer primary sources.

Event type definitions:
- funding: capital raise (seed, Series A/B/C, debt, IPO)
- acquisition: M&A — company acquiring or being acquired
- regulatory: regulatory guidance, compliance requirements, enforcement, government AI policy for financial services
- partnership: strategic partnership, integration, or distribution agreement between named institutions
- product_launch: new AI product, feature, or platform going live or announced
- milestone: user count, AUM, deployment scale achievement
- strategy_move: strategic direction, firm-wide AI policy, executive statement of intent
- market_signal: survey data, industry report, analyst opinion, general trend — no specific company action

Today's date: ${new Date().toISOString().split('T')[0]}

OUTPUT: Return only valid JSON matching this schema exactly:
${INTAKE_SCHEMA}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Claude response');

  const entry = JSON.parse(jsonMatch[0]);

  entry.source_url = url;
  entry.source_verified = true;

  // Normalize company slug to match landscape IDs
  if (entry.company) {
    entry.company = normalizeCompanySlug(entry.company);
  }

  if (!entry.id || entry.id === 'url-slug-style-id') {
    entry.id = slugify(entry.headline || 'untitled', {
      lower: true, strict: true, trim: true,
    }).slice(0, 60);
  }

  return entry;
}

export async function processUrl({ url, source_name, send }) {
  send('status', { message: `Fetching page content from ${url}...` });

  // ── Fetch original page + kick off enrichment search in parallel ─────────────
  let pageData;
  try {
    // Run page fetch first so we have a teaser for the enrichment query
    pageData = await fetchPageMarkdown(url);
    send('status', {
      message: `Extracted ${pageData.word_count} words${pageData.paywall_suspected ? ' ⚠ Paywall detected' : pageData.thin_content ? ' ⚠ Thin content — enriching' : ' — enriching with additional sources'}`,
      paywall_suspected: pageData.paywall_suspected,
      thin_content: pageData.thin_content,
      word_count: pageData.word_count,
    });
  } catch (err) {
    send('error', { message: `Page extraction failed: ${err.message}` });
    return null;
  }

  // ── Always search for enrichment sources ─────────────────────────────────────
  // Paywall/thin → DataForSEO headline search (finds same story on open sources)
  // Full content → Jina keyword search (supplementary press releases + context)
  const needsEnrichment = pageData.paywall_suspected || pageData.thin_content;

  send('status', {
    message: needsEnrichment
      ? 'Paywall/thin content — searching DataForSEO for same story on open sources...'
      : 'Searching for supplementary sources (press releases, open coverage)...',
  });

  const enrichmentUrls = await findEnrichmentSources(url, pageData.markdown, needsEnrichment);
  const fetched = await Promise.all(enrichmentUrls.map(u => fetchEnrichmentMarkdown(u)));
  const usable = fetched.filter(Boolean).slice(0, 3);

  let enrichmentSources = [];
  let contentMarkdown = pageData.markdown;

  if (usable.length > 0) {
    enrichmentSources = usable.map(s => s.url);
    send('status', {
      message: `Found ${usable.length} enrichment source(s): ${usable.map(s => s.hostname).join(', ')}`,
      enrichment_sources: enrichmentSources,
    });

    if (needsEnrichment) {
      // Thin/paywalled: lead with enrichment content, keep original teaser for URL/date context
      contentMarkdown = [
        `<!-- Original source (limited content): ${url} -->\n${pageData.markdown.slice(0, 800)}`,
        ...usable.map(s => `<!-- Enrichment source: ${s.url} -->\n${s.markdown.slice(0, 3000)}`),
      ].join('\n\n---\n\n');
    } else {
      // Full content: original leads, enrichment appended as supplementary context
      contentMarkdown = [
        `<!-- Primary source: ${url} -->\n${pageData.markdown.slice(0, 5000)}`,
        ...usable.map(s => `<!-- Supplementary source: ${s.url} -->\n${s.markdown.slice(0, 1500)}`),
      ].join('\n\n---\n\n');
    }
  } else {
    if (needsEnrichment) {
      send('status', {
        message: 'No enrichment sources found — proceeding with partial content',
        enrichment_failed: true,
      });
    } else {
      send('status', { message: 'No additional sources found — proceeding with original content' });
    }
  }

  // ── Structure with Claude ─────────────────────────────────────────────────────
  send('status', { message: 'Structuring entry with Claude...' });

  let entry;
  try {
    entry = await structureEntry(url, contentMarkdown, {
      source_name,
      needs_enrichment: needsEnrichment,
      enrichment_sources: enrichmentSources.length > 0 ? enrichmentSources : null,
    });
  } catch (err) {
    send('error', { message: `Structuring failed: ${err.message}` });
    return null;
  }

  if (!entry.type) {
    send('skipped', { message: 'Article is not relevant to AI in wealth management', entry });
    return null;
  }

  send('structured', {
    entry,
    source_markdown_preview: contentMarkdown.slice(0, 1500),
    word_count: contentMarkdown.split(/\s+/).length,
    paywall_suspected: pageData.paywall_suspected,
    thin_content: pageData.thin_content,
    enrichment_sources: enrichmentSources,
  });

  return { entry, markdown: contentMarkdown };
}
