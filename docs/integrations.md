# External Integrations

Most integrations live in the **Intake Server** (`../intake-server/`). The portal makes runtime calls to **Supabase** (auth) and **Stripe** (checkout/webhooks) — all other portal content is static JSON read at build time.

---

## Supabase Auth

**Used for:** User authentication (Google OAuth, magic link, email+password), user profiles, organization management, team invites, row-level security.

**Portal files:**
- `lib/supabase.ts` — browser client (`createBrowserClient` from `@supabase/ssr`)
- `lib/supabase-server.ts` — server client (cookie-based sessions) + admin client (service key, bypasses RLS)
- `middleware.ts` — auth gate on every request: logged in → has user_profiles row with org_id → org status active
- `app/api/auth/callback/route.ts` — exchanges OAuth/magic-link code for session

**Config:**
- Site URL: `https://livingintel.ai`
- Providers: Google OAuth, Email (magic link + password)
- Session duration: 30 days
- 14 tables deployed (2 auth + 8 KB + 4 engagement)

**Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`

---

## Stripe

**Used for:** Subscription billing (annual), checkout sessions, customer portal, friend access (100% off coupon).

**Portal files:**
- `app/api/checkout/route.ts` — creates Stripe Checkout session. Supports `coupon` param for FRIEND2026. Sets `payment_method_collection: 'if_required'` when coupon present (friends skip card form).
- `app/api/webhooks/stripe/route.ts` — handles `checkout.session.completed` (creates org + admin profile), `customer.subscription.deleted` (deactivates org), `customer.subscription.updated`.

**Products:**
- Founding Member: $4,500/yr
- Standard: $5,000/yr
- FRIEND2026 coupon: 100% off, 1 month duration, 20 max redemptions

**Env vars:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_FOUNDING`, `STRIPE_PRICE_STANDARD`

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

**Scoring map (Dim A, max 25):** `rank ≥ 70` → 23 pts · `≥ 50` → 18 pts · `≥ 30` → 12 pts · `< 30` → 5 pts · `spam_score ≥ 40` → 2 pts (flagged regardless of rank). Falls back to manual tier list if API unavailable: press release wire/strong newsroom = 25, Tier 1 media = 22, Tier 2 industry press = 17, weak newsroom (/news/, /blog/) = 20 (only after TIER1/TIER2 check), general = 9.
**Cache:** Results stored in `domainAuthorityCache` (Map) for duration of pipeline run — one API call per domain.

**Env vars:** `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`

---

### 3. Jina Embeddings (`jina-embeddings-v3`) — semantic deduplication

**Used in:** `auto-discover.js` Stage 2b — drops candidates that semantically duplicate a published entry.

```javascript
// POST https://api.jina.ai/v1/embeddings
{
  model: 'jina-embeddings-v3',
  task: 'text-matching',   // symmetric similarity (not retrieval)
  dimensions: 512,
  input: ['headline + summary', ...],
}
// Returns: data[].embedding (float32 arrays)
```

**Flow:** Embed all published entry texts + all top-40 candidates in parallel → cosine similarity matrix → filter candidates with similarity ≥ 0.90 to any published entry. Catches same-story re-runs that URL dedup misses (different article URL, same underlying story).

### 4. Jina Reranker (`jina-reranker-v3`) — two uses

**Use 1 — Discovery ranking** (`auto-discover.js` Stage 3): After semantic dedup, reranks the surviving candidates by relevance to a fixed query: _"significant AI product launch or milestone in wealth management financial services"_. Returns top 20 in relevance order.

**Use 2 — Paywall alternative selection** (`intake.js` Stage 4 paywall path): After DataForSEO News + Organic finds up to 8 open alternative URLs, reranks them by similarity to the original article's teaser. Picks the alternative that most closely covers the same story — not just any open-source article.

```javascript
// POST https://api.jina.ai/v1/rerank
{
  model: 'jina-reranker-v3',
  query: 'significant AI product launch ...',   // or: original teaser (paywall path)
  documents: ['title + snippet', ...],
  top_n: 20,
}
// Returns: results[].index (pointer to input doc), results[].relevance_score
```

**Why Jina for both:** Same API key, same service — no extra credentials. Embeddings give exact similarity scores for dedup thresholding; Reranker gives cross-attention quality for ranking.

---

## Auto-Discovery Pipeline — Two-Layer Architecture

RSS feeds were removed. All 11 feeds were paywalled publications already covered by DataForSEO at higher quality. The replacement is a two-layer architecture that self-expands as the landscape grows.

### Layer 1 — Broad thematic discovery (catches new entrants and unknown companies)

**Layer 1 News** — 8 broad DFS Google News queries, hardcoded:
```
'AI wealth management news 2026'
'wealthtech artificial intelligence platform launch 2026'
'financial advisor AI tool product announcement'
'private banking generative AI deployment 2026'
'robo-advisor AI fintech funding raises 2026'
'wealth management AI agent agentic 2026'
'Anthropic OpenAI wealth management financial services partnership'
'AI financial planning advisor technology news'
```

**Layer 1 Capabilities** — 7 DFS Google News queries, dynamically built from `data/capabilities/index.json` (`search_term` field). Year injected at runtime; Q1-aware (includes prior year since Dec–Feb content is < 90 days old).
```
// Built by buildCapabilityQueries(capabilities) — one query per capability dimension
'AI advisor productivity automation meeting notes CRM deployed 2026'
'AI client personalization hyper-personalization wealth 2026'
... (one per capability, self-updating each year)
```
This layer ensures capability-specific stories surface even when broad news queries miss them.

**Layer 1 TL** — 5 broad Jina Search queries for thought leadership:
```
'AI wealth management thought leadership essay 2026'
'AI financial advisor future implications essay'
'generative AI investment management strategy 2026'
'AI fintech industry report white paper 2026'
'artificial intelligence finance executive perspective 2026'
```

### Layer 2 — Deep per-company discovery (auto-expands with landscape)

**Layer 2 Companies** — one DFS Content Analysis query per company in `data/competitors/*.json`. Generated at runtime by `buildCompanyQueries()`. As you add companies to the landscape, they are automatically queried on the next pipeline run.

Each query: `{company.name} {SEGMENT_FOCUS[company.segment]}`

Segment focus strings: `wirehouse → 'wealth management AI advisor'`, `ai_native → 'AI wealth platform'`, etc.

All company queries are batched into a single API call (50 per batch) for efficiency.

**Layer 2 Authors** — one Jina Search query per known author in `data/thought-leadership/*.json`. Generated at runtime by `buildAuthorQueries()`.

### Full pipeline flow

```
Layer 1 News (8 DFS News)  Layer 1 Caps (7 DFS News)  Layer 2 Companies (N DFS Content Analysis)
         │                          │                             │
         └──────────────────────────┴──────────────────────────── ┘
                        ↓ URL dedup vs existing entries
               Deduplicate against source_url fields
                        ↓ Rule-based scoring + HN gravity decay → top 40
               HN gravity: score^0.8 / (hoursAgo+2)^2.0  (punishes age continuously)
               +6       primary outlet (investmentnews, thinkadvisor, wealthmanagement.com)
               +4       tier-1 outlet (bloomberg, reuters, ft, wsj)
               +4 each  tracked company mention (max +10, dynamic from landscape)
               +1 each  AI keyword density (max 4)
               +5–7     Layer 2 Companies bonus (base +5, +quality_score up to +2)
               +4       Layer 1 Capabilities bonus
               +3       Layer 1 News
                        ↓ Stage 2b: Semantic dedup (Jina Embeddings)
               Embed top-40 + published entries → drop cosine ≥ 0.90
                        ↓ Stage 3: Rerank (Jina Reranker)
               Rerank by "significant AI announcement affecting wealth management advisors"
                        ↓
               Return intelCandidates (top 20) + tlCandidates (raw, for Telegram)
               intelCandidates → intake pipeline (structure → verify → score)
               tlCandidates → surfaced in Telegram digest for manual review

Layer 1 TL (5 Jina Search)   Layer 2 Authors (M Jina Search)
         │                             │
         └──────────────┬──────────────┘
                        ↓ URL dedup
               tlCandidates → Telegram digest (not put through intake)
```

**Tracked companies:** dynamically loaded from `data/competitors/*.json` at runtime. Adding a new company file automatically adds it to both the discovery queries AND the relevance scoring.

**New company detection:** after structuring, `scheduler.js` checks `entry.company` against `knownCompanyIds`. If not found → flagged in Telegram with `🆕 New companies — not in landscape`.

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
| Finding new stories + new entrants | Layer 1: 8 broad DFS News queries — catches any company, not just tracked ones |
| Deep per-company coverage | Layer 2: DFS Content Analysis query per company in landscape — auto-expands as landscape grows |
| Extracting clean article content | Jina r.jina.ai (handles paywalls, strips noise) |
| Paywalled articles | DataForSEO Google News + Organic in parallel → finds open alternative sources |
| Structuring articles into typed JSON | Anthropic Claude — strict grounding rules, no inference |
| Verifying claims aren't fabricated | Anthropic Claude governance check (second call) |
| Auto-publishing vs human review | scorer.js — 4-dimension scoring (A: Source 0–25, B: Claims 0–25, C: Fresh 0–10, D: Impact 0–40). PUBLISH ≥75 / REVIEW 60–74 / BLOCK <60 |
| Source authority verification | DataForSEO Backlinks API — live domain_rank per source domain |
| Detecting spam/low-quality sources | Backlinks API spam_score ≥ 40 → auto-flag regardless of domain rank |
| Reliable company logos | DataForSEO Google Images → downloaded to disk as local files |
| Deduplication against existing entries | URL normalization against all `source_url` fields + Jina Embeddings semantic dedup (≥0.90 cosine = duplicate) |
| Same story, different URL (re-runs) | Jina Embeddings `jina-embeddings-v3` — catches semantic duplicates URL dedup misses |
| Ranking discovery candidates by relevance | Jina Reranker `jina-reranker-v3` — cross-attention quality ranking after rule scoring |
| Picking best paywall alternative | Jina Reranker — reranks DataForSEO alternatives by similarity to original teaser |
| Broken URLs and missing assets | `scripts/test-portal.js` health checker — auto-fixes on detect |
| User authentication (3 methods) | Supabase Auth — Google OAuth, magic link, email+password. Session cookies via `@supabase/ssr`. |
| Subscription billing + friend access | Stripe Checkout — annual plans ($4,500/$5,000), FRIEND2026 coupon (100% off, no card). Webhook creates org. |
| Auth gate (portal access control) | `middleware.ts` — checks Supabase session + org membership + org active status on every request |
| Team management | Supabase `invite_team_member` RPC + `handle_new_user` trigger — auto-links new signups to org via pending_invites |
