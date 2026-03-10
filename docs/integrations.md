# External Integrations

All integrations live in the **Intake Server** (`../intake-server/`), not in the portal. The portal is purely static — it reads JSON files, no external API calls at runtime.

---

## Anthropic Claude (claude-sonnet-4-6)

**Used for:** Structuring raw article text into typed IntelligenceEntry JSON, generating summaries, writing descriptions.

**Pattern — all Anthropic calls use SSE streaming:**
```javascript
// agents/_shared.js
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-sonnet-4-6';
export const client = new Anthropic();

export async function streamAgent(systemPrompt, userPrompt, onChunk) {
  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta') onChunk(chunk.delta.text);
  }
}
```

**Env var:** `ANTHROPIC_API_KEY`

---

## Jina AI

**Two modes — both return clean markdown:**

### 1. Article Extraction (`r.jina.ai`)
Converts any URL to clean markdown — strips navigation, ads, boilerplate.
```javascript
const response = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
  headers: { 'Authorization': `Bearer ${process.env.JINA_API_KEY}` }
});
const markdown = await response.text();
```

### 2. Web Search + Extract (`s.jina.ai`)
One call returns web search results + extracted article content simultaneously.
```javascript
const response = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
  headers: { 'Authorization': `Bearer ${process.env.JINA_API_KEY}` }
});
const results = await response.text(); // markdown with multiple sources
```

**Why Jina over raw fetch:** Handles paywalls better, cleans content for LLM consumption, no need to parse HTML.

**Standing auto-discovery queries (7):**
- `"AI wealth management product launch 2025"`
- `"financial advisor AI tool announcement 2025"`
- `"Goldman Sachs Morgan Stanley UBS AI 2025"`
- `"Anthropic Claude OpenAI financial services partnership 2025"`
- `"robo-advisor wealthtech AI platform launch 2025"`
- `"private banking generative AI wealth platform 2025"`
- `"RIA custodian AI fintech funding announcement 2025"`

**Env var:** `JINA_API_KEY`

---

## DataForSEO

**Two use cases — Google at scale without scraping:**

### 1. Google News (content discovery)
```javascript
const response = await fetch('https://api.dataforseo.com/v3/serp/google/news/live/advanced', {
  method: 'POST',
  headers: {
    'Authorization': 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64'),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify([{
    keyword: 'AI wealth management news',
    location_code: 2840, // United States
    language_code: 'en',
    depth: 10,
  }]),
});
```

**Standing auto-discovery queries (5):**
- `"AI wealth management news"`
- `"financial advisor AI product launch"`
- `"wealthtech artificial intelligence platform 2025"`
- `"Goldman Sachs UBS Morgan Stanley AI advisor"`
- `"Anthropic OpenAI wealth management financial services"`

### 2. Google Images (logo fetching)
```javascript
const response = await fetch('https://api.dataforseo.com/v3/serp/google/images/live/advanced', {
  method: 'POST',
  headers: { /* same auth */ },
  body: JSON.stringify([{
    keyword: `${companyName} logo transparent PNG`,
    location_code: 2840,
    language_code: 'en',
    depth: 5,
  }]),
});
// Downloads first SVG/PNG result to ../data/logos/{slug}.svg
```

**Why DataForSEO over Clearbit/unavatar:** Clearbit shut down free tier; unavatar returns HTTP 200 with placeholder images that look correct but aren't. DataForSEO returns real Google Image Search results — actual logos downloadable to disk permanently.

**Env vars:** `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`

---

## RSS Feeds (11 feeds, no API key needed)

Monitored continuously in auto-discovery. Configured in `rss-feeds.json`:

```
Financial Times — ft.com/rss/home/technology
Bloomberg Technology — feeds.bloomberg.com/technology/news.rss
Reuters Financial Services — feeds.reuters.com/reuters/businessNews
WSJ Markets — feeds.content.dowjones.io/public/rss/2_DJ_ARTICLETYPE_FinancialServices
Fintech Nexus — fintechnexus.com/feed
WealthManagement.com — wealthmanagement.com/rss.xml
ThinkAdvisor — thinkadvisor.com/rss
InvestmentNews — investmentnews.com/feed
RIABiz — riabiz.com/feed
Advisor Perspectives — advisorperspectives.com/feed
Wealthtechtoday — wealthtechtoday.com/feed
```

---

## Auto-Discovery Pipeline (the full flow)

All three sources run in **parallel** via `Promise.allSettled`:

```
RSS (11 feeds)          Jina Search (7 queries)     DataForSEO News (5 queries)
     │                         │                              │
     └─────────────────────────┴──────────────────────────────┘
                               ↓
                    Deduplicate against existing
                    source_url fields in ../data/intelligence/
                               ↓
                    Score each candidate:
                      +10 max  recency (last 72h = 10, week = 5, older = 2)
                      +4–6     source quality (primary vs tier-1 outlet)
                      +2 each  tracked company mentions (Goldman, JPMorgan, etc.)
                      +1 each  AI keyword density
                      +3/2     source bonus (DataForSEO = +3, Jina = +2)
                               ↓
                    Return top 20 candidates with `via` badge
                    (RSS=blue, Jina=purple, DFS=green)
```

**Tracked companies (for scoring boost):**
Goldman Sachs, Morgan Stanley, JPMorgan, UBS, Merrill Lynch, Citi, HSBC, Vanguard, Fidelity, Schwab, BlackRock, LPL Financial, Raymond James, Edward Jones, Betterment, Wealthfront, Robinhood, Altruist, Orion, Envestnet

---

## What Each Integration Solves

| Problem | Solution |
|---------|----------|
| Finding new stories automatically | RSS + Jina Search + DataForSEO News in parallel |
| Extracting clean article content | Jina r.jina.ai (handles paywalls, strips noise) |
| Reliable company logos | DataForSEO Google Images → downloaded to disk |
| Structuring articles into typed JSON | Anthropic Claude (claude-sonnet-4-6) |
| Deduplication across 33+ existing entries | URL normalization against all `source_url` fields |
