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

// Domains known to be open (no paywall) — preferred for fallback
const OPEN_DOMAINS = new Set([
  'businesswire.com', 'prnewswire.com', 'globenewswire.com', 'accesswire.com',
  'thinkadvisor.com', 'wealthmanagement.com', 'investmentnews.com',
  'financial-planning.com', 'riabiz.com', 'advisorhub.com',
  'citywire.com', 'wealthbriefing.com', 'wealthprofessional.ca',
  'fintech.global', 'pymnts.com', 'tearsheet.co', 'bankingdive.com',
  'techcrunch.com', 'axios.com', 'reuters.com', 'cnbc.com',
  'fortune.com', 'businessinsider.com', 'theblock.co', 'coindesk.com',
]);

// Domains known to be hard paywalled — skip in fallback
const PAYWALLED_DOMAINS = new Set([
  'ft.com', 'wsj.com', 'bloomberg.com', 'barrons.com',
  'economist.com', 'hbr.org', 'morningstar.com',
]);

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

  return {
    markdown,
    word_count: markdown.split(/\s+/).length,
    paywall_suspected: hasTruncationSignals,
  };
}

// Extract a compact search query from a URL slug + whatever teaser content Jina returned
function buildSearchQuery(url, teaserMarkdown) {
  // Pull meaningful words from the URL path
  let slug = '';
  try {
    slug = new URL(url).pathname
      .replace(/[^a-z0-9\s-]/gi, ' ')
      .replace(/-/g, ' ')
      .trim();
  } catch (_) {}

  // Grab first 300 chars of teaser to extract any company/product names
  const teaser = teaserMarkdown.slice(0, 300).replace(/[#*`[\]]/g, '');

  // Combine and take the most informative ~10 words
  const combined = `${slug} ${teaser}`.toLowerCase();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'in', 'of', 'to', 'for',
    'with', 'on', 'at', 'by', 'from', 'is', 'are', 'was', 'be', 'its', 'this', 'that',
    'as', 'it', 'has', 'have', 'how', 'what', 'why', 'when', 'html', 'www', 'com']);
  const words = combined
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 10);

  return words.join(' ');
}

// Search Jina for alternative coverage of the same story, return open-source URLs
async function findAlternativeCoverage(url, teaserMarkdown, send) {
  if (!process.env.JINA_API_KEY) return [];

  const query = buildSearchQuery(url, teaserMarkdown);
  if (!query) return [];

  send('status', { message: `Paywall detected — searching for open-source coverage: "${query.slice(0, 60)}..."` });

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

  // Filter to open domains, exclude the original paywalled URL
  const originalHostname = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
  })();

  const alternatives = searchResults
    .filter(r => {
      if (!r.url) return false;
      let hostname = '';
      try { hostname = new URL(r.url).hostname.replace(/^www\./, ''); } catch (_) { return false; }
      if (hostname === originalHostname) return false;
      if (PAYWALLED_DOMAINS.has(hostname)) return false;
      // Prefer known open domains, but also allow unknown domains (press releases, company blogs)
      return true;
    })
    .slice(0, 4); // fetch up to 4, we'll stop once we have 2 good ones

  return alternatives.map(r => r.url);
}

// Fetch markdown from an alternative URL, silently skip on failure
async function fetchAlternativeMarkdown(altUrl) {
  try {
    const jinaUrl = `https://r.jina.ai/${altUrl}`;
    const headers = { 'Accept': 'text/markdown', 'X-Return-Format': 'markdown' };
    if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;

    const res = await fetch(jinaUrl, { headers, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;

    const md = await res.text();
    if (md.length < 200) return null;

    // Skip if the alternative is also paywalled
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
  const prompt = `You are a structured content extractor for an AI in wealth management intelligence publication.

A journalist has found this article and wants to add it to the publication. Your job is to extract and structure it.

SOURCE ARTICLE URL: ${url}
SOURCE NAME: ${sourceInfo.source_name}
${sourceInfo.fallback_sources ? `\nADDITIONAL SOURCES USED (original was paywalled):\n${sourceInfo.fallback_sources.map(s => `- ${s}`).join('\n')}\n` : ''}
ARTICLE CONTENT (markdown):
---
${markdown.slice(0, 8000)}
---

Extract and structure this into the following JSON schema.
CRITICAL RULES:
1. The summary must ONLY contain information present in the article content above. Do not infer, expand, or add context from your training data.
2. key_stat must be a specific number actually mentioned in the article. If no specific number exists, set to null.
3. The headline must be factual and specific — not generic.
4. If the article is not about AI in wealth management or financial services, set type to null.
5. For image_url, use: https://unavatar.io/[company-main-domain] — pick the primary company's website domain.

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

  let pageData;
  try {
    pageData = await fetchPageMarkdown(url);
    send('status', {
      message: `Extracted ${pageData.word_count} words${pageData.paywall_suspected ? ' ⚠ Possible paywall detected' : ''}`,
      paywall_suspected: pageData.paywall_suspected,
      word_count: pageData.word_count,
    });
  } catch (err) {
    send('error', { message: `Page extraction failed: ${err.message}` });
    return null;
  }

  // Paywall fallback: search for open-source coverage of the same story
  let fallbackSources = [];
  let contentMarkdown = pageData.markdown;

  if (pageData.paywall_suspected) {
    const altUrls = await findAlternativeCoverage(url, pageData.markdown, send);

    // Fetch alternatives in parallel, collect up to 2 usable ones
    const fetched = await Promise.all(altUrls.map(u => fetchAlternativeMarkdown(u)));
    const usable = fetched.filter(Boolean).slice(0, 2);

    if (usable.length > 0) {
      fallbackSources = usable.map(s => s.url);
      send('status', {
        message: `Found ${usable.length} open-source alternative(s): ${usable.map(s => s.hostname).join(', ')}`,
        fallback_sources: fallbackSources,
      });

      // Combine: original teaser first (for URL/date context), then full alternative content
      contentMarkdown = [
        `<!-- Original source (paywalled): ${url} -->\n${pageData.markdown.slice(0, 1000)}`,
        ...usable.map(s => `<!-- Alternative source: ${s.url} -->\n${s.markdown.slice(0, 3500)}`),
      ].join('\n\n---\n\n');
    } else {
      send('status', {
        message: 'No open-source alternatives found — proceeding with partial paywall content',
        paywall_fallback_failed: true,
      });
    }
  }

  send('status', { message: 'Structuring entry with Claude...' });

  let entry;
  try {
    entry = await structureEntry(url, contentMarkdown, {
      source_name,
      fallback_sources: fallbackSources.length > 0 ? fallbackSources : null,
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
    fallback_sources: fallbackSources,
  });

  return { entry, markdown: contentMarkdown };
}
