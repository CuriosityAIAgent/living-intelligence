import fetch from 'node-fetch';
import Anthropic from '@anthropic-ai/sdk';
import slugify from 'slugify';

const client = new Anthropic();

const INTAKE_SCHEMA = `{
  "id": "url-slug-style-id",
  "type": "partnership | product_launch | milestone | strategy_move | market_signal",
  "headline": "Concise, factual headline under 120 chars",
  "company": "company-slug",
  "company_name": "Full Company Name",
  "date": "YYYY-MM-DD",
  "source_name": "Publication Name",
  "source_url": "the actual URL",
  "source_verified": true,
  "image_url": "https://unavatar.io/[company-domain]",
  "summary": "3-5 sentence summary. Only what is in the source article. No inference.",
  "key_stat": { "number": "X", "label": "what it measures" },
  "tags": {
    "capability": "advisor_productivity | client_experience | investment_analytics | operations_compliance | new_business_models | client_acquisition",
    "region": "us | emea | asia | latam | global",
    "segment": "global_bank | regional_champion | retail_digital | ria_independent | uhnw_digital | ai_native",
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

// Build a targeted search query from URL + teaser content
function buildEnrichmentQuery(url, teaserMarkdown) {
  // Extract company hint from hostname
  let companyHint = '';
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    // e.g. "investmentnews.com" → not useful; but slug might have company names
    const slug = new URL(url).pathname.replace(/[^a-z0-9\s-]/gi, ' ').replace(/-/g, ' ').trim();
    companyHint = slug;
  } catch (_) {}

  // Grab first 400 chars of teaser
  const teaser = teaserMarkdown.slice(0, 400).replace(/[#*`[\]()]/g, '');

  const combined = `${companyHint} ${teaser}`.toLowerCase();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'in', 'of', 'to', 'for',
    'with', 'on', 'at', 'by', 'from', 'is', 'are', 'was', 'be', 'its', 'this', 'that',
    'as', 'it', 'has', 'have', 'how', 'what', 'why', 'when', 'html', 'www', 'com',
    'will', 'its', 'their', 'they', 'which', 'also', 'more', 'said', 'than', 'been']);

  const words = combined
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 12);

  return words.join(' ');
}

// Always search for enrichment sources — press releases, company blogs, open trade press.
// Runs in parallel with the initial page fetch so it doesn't add latency.
async function findEnrichmentSources(url, teaserMarkdown) {
  if (!process.env.JINA_API_KEY) return [];

  const query = buildEnrichmentQuery(url, teaserMarkdown);
  if (!query) return [];

  let searchResults = [];
  try {
    const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    searchResults = data.data || [];
  } catch (_) {
    return [];
  }

  const originalHostname = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
  })();

  // Score each result: prefer press releases and open domains
  const scored = searchResults
    .filter(r => {
      if (!r.url) return false;
      let hostname = '';
      try { hostname = new URL(r.url).hostname.replace(/^www\./, ''); } catch (_) { return false; }
      if (hostname === originalHostname) return false;  // don't re-fetch original
      if (PAYWALLED_DOMAINS.has(hostname)) return false; // skip known paywalls
      return true;
    })
    .map(r => {
      let hostname = '';
      try { hostname = new URL(r.url).hostname.replace(/^www\./, ''); } catch (_) {}
      // Highest priority: official press release wires
      const isPressRelease = ['businesswire.com', 'prnewswire.com', 'globenewswire.com', 'accesswire.com'].includes(hostname);
      // Second priority: known open trade press
      const isOpenTrade = OPEN_DOMAINS.has(hostname);
      const score = isPressRelease ? 3 : isOpenTrade ? 2 : 1;
      return { ...r, hostname, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // fetch up to 5, use best 3

  return scored.map(r => r.url);
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

  const prompt = `You are a structured content extractor for an AI in wealth management intelligence publication.

A journalist has found this article and wants to add it to the publication. Your job is to extract and structure it.

SOURCE ARTICLE URL: ${url}
SOURCE NAME: ${sourceInfo.source_name}
${sourceInfo.needs_enrichment ? '⚠ Original article had limited content (paywall or thin). Enrichment sources have been added below.' : ''}
${hasEnrichment ? `\nENRICHMENT SOURCES USED:\n${sourceInfo.enrichment_sources.map(s => `- ${s}`).join('\n')}\n` : ''}

ARTICLE CONTENT (markdown):
---
${markdown.slice(0, 10000)}
---

Extract and structure this into the following JSON schema.
CRITICAL RULES:
1. The summary must ONLY contain information present in the content above. Do not infer or add context from your training data.
2. key_stat must be a specific number actually mentioned in the content. If no specific number exists, set to null.
3. The headline must be factual and specific — not generic.
4. If the article is not about AI in wealth management or financial services, set type to null.
5. For image_url, use: https://unavatar.io/[company-main-domain] — pick the primary company's website domain.
6. If multiple sources cover the same story, synthesize the most complete and accurate version. Prefer primary sources (press releases, company announcements) over secondary coverage.

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
  // Runs regardless of paywall — ensures we always have press releases,
  // company blog posts, and open trade coverage to supplement the original.
  const needsEnrichment = pageData.paywall_suspected || pageData.thin_content;

  send('status', { message: 'Searching for enrichment sources (press releases, company pages, open coverage)...' });

  const enrichmentUrls = await findEnrichmentSources(url, pageData.markdown);
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
