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

**Paywall fallback** (implemented in `agents/intake.js`): When Jina detects paywall signals (`"Subscribe to continue"` etc.), the system automatically:
1. Extracts keywords from the URL slug + teaser content
2. Searches `s.jina.ai` for alternative coverage of the same story
3. Filters results to open-source domains (businesswire, prnewswire, thinkadvisor, etc.) — skips bloomberg/ft/wsj
4. Fetches up to 2 usable alternatives and combines with original teaser
5. Claude summarises from the combined open content — fully grounded, no fabrication

If no alternatives are found, proceeds with partial paywall content and sets `paywall_caveat: true` in the governance audit.

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
- `"AI wealth management product launch 2026"`
- `"financial advisor AI tool announcement 2026"`
- `"Goldman Sachs Morgan Stanley UBS AI 2026"`
- `"Anthropic Claude OpenAI financial services partnership 2026"`
- `"robo-advisor wealthtech AI platform launch 2026"`
- `"private banking generative AI wealth platform 2026"`
- `"RIA custodian AI fintech funding announcement 2026"`

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
- `"wealthtech artificial intelligence platform 2026"`
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

### 3. Google Organic SERP (paywall bypass — runs in parallel with Google News)

When a paywall is detected, the intake pipeline runs Google News + Google Organic simultaneously. Organic search finds press releases and company blog posts that rank permanently (not just in the news tab), catching open sources that News misses.

```javascript
// agents/intake.js — called when paywall_suspected or thin_content
const [newsData, organicData] = await Promise.all([
  dfsCall('news', {}),
  dfsCall('organic', {}),
]);
// Results merged, deduped, ranked: press release wires first, then open trade press
```

### 4. Content Analysis Search (4th discovery source — runs in auto-discover.js)

Searches for company-specific keyword mentions across the web with quality scoring. Finds high-quality articles from blogs, reports, and trade press that Google News may miss.

```javascript
// agents/auto-discover.js — 7 company-specific queries
body: JSON.stringify([{
  keyword: 'Goldman Sachs artificial intelligence wealth',
  filters: [['content_quality_score', '>', 2], 'and', ['page_types', 'has', 'news']],
  order_by: ['date_published,desc'],
  limit: 8,
}])
// Returns: url, title, date_published, content_quality_score, snippet, sentiment
```

**Queries:** Goldman Sachs AI, Morgan Stanley AI advisor, JPMorgan wealth AI, Altruist Hazel AI, LPL Financial AI, UBS AI private banking, wealthtech AI platform 2026.
**Score bonus:** Content Analysis results get +4–6 in candidate scoring (base +4, +up to 2 for quality score).

### 5. Backlinks Summary (source authority — used in scorer.js)

Called once per unique source domain per pipeline run to get real domain authority. Replaces the static manual tier list with live data.

```javascript
// agents/scorer.js — Dimension A: Source Quality
const res = await fetch('https://api.dataforseo.com/v3/backlinks/summary/live', {
  body: JSON.stringify([{ target: hostname, limit: 1 }]),
});
// Returns: rank (0-100), spam_score (0-100), referring_domains
```

**Scoring map:** `rank ≥ 70` → 28 pts · `≥ 50` → 22 pts · `≥ 30` → 14 pts · `< 30` → 7 pts · `spam_score ≥ 40` → 3 pts (flagged regardless of rank).
**Cache:** Results stored in `domainAuthorityCache` (Map) for duration of pipeline run — one API call per domain.

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

All **four sources** run in parallel via `Promise.allSettled`:

```
RSS (11 feeds)    Jina Search (7q)    DFS News (5q)    DFS Content Analysis (7q)
     │                  │                  │                       │
     └──────────────────┴──────────────────┴───────────────────────┘
                               ↓
                    Deduplicate against existing
                    source_url fields in ../data/intelligence/
                               ↓
                    Score each candidate:
                      +10 max  recency (last 72h = 10, week = 5, older = 2)
                      +4–6     source quality (primary vs tier-1 outlet)
                      +2 each  tracked company mentions (Goldman, JPMorgan, etc.)
                      +1 each  AI keyword density
                      +4–6     Content Analysis bonus (base +4, +quality score up to +2)
                      +3/2     DFS News = +3, Jina = +2
                               ↓
                    Return top 20 candidates with `via` badge
                    (RSS=blue, Jina=purple, DFS=green, Content Analysis=orange)
```

**Tracked companies (for scoring boost):**
Goldman Sachs, Morgan Stanley, JPMorgan, UBS, Merrill Lynch, Citi, HSBC, Vanguard, Fidelity, Schwab, BlackRock, LPL Financial, Raymond James, Edward Jones, Betterment, Wealthfront, Robinhood, Altruist, Orion, Envestnet

---

## Anthropic Claude — Governance Verification

A second Claude call runs after structuring to verify every claim in the generated entry against the source article. This is separate from the structuring call.

```javascript
// agents/governance.js
const prompt = `Verify that every factual claim in the GENERATED ENTRY
is supported by the SOURCE ARTICLE.
...
Return JSON: { verdict, confidence, verified_claims, unverified_claims,
               fabricated_claims, notes, paywall_caveat }`;
```

Verdict rules:
- **PASS**: All claims verifiable. Minor paraphrasing fine.
- **REVIEW**: 1-2 claims unverified (implied not explicit). No fabrications.
- **FAIL**: Any claim contradicts source, or any stat/name appears fabricated.

This two-call pattern (structure → verify) is the primary anti-hallucination mechanism.

---

## What Each Integration Solves

| Problem | Solution |
|---------|----------|
| Finding new stories automatically | RSS + Jina + DFS News + DFS Content Analysis — 4 sources in parallel |
| Finding company-specific high-quality articles | DataForSEO Content Analysis (7 targeted company queries, quality-filtered) |
| Extracting clean article content | Jina r.jina.ai (handles paywalls, strips noise) |
| Paywalled articles | DataForSEO Google News + Organic in parallel → finds open alternative sources |
| Structuring articles into typed JSON | Anthropic Claude — strict grounding rules, no inference |
| Verifying claims aren't fabricated | Anthropic Claude governance check (second call) |
| Auto-publishing vs human review | scorer.js — 4-dimension scoring, PUBLISH ≥75 / REVIEW 50–74 / BLOCK <50 |
| Source authority verification | DataForSEO Backlinks API — live domain_rank per source domain |
| Detecting spam/low-quality sources | Backlinks API spam_score ≥ 40 → auto-flag regardless of domain rank |
| Reliable company logos | DataForSEO Google Images → downloaded to disk as local files |
| Deduplication against existing entries | URL normalization against all `source_url` fields |
| Broken URLs and missing assets | `scripts/test-portal.js` health checker — auto-fixes on detect |
