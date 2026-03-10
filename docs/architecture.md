# System Architecture

## Two-System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTAKE SERVER (port 3003)                     │
│                   ../intake-server/server.js                     │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌────────────┐   ┌──────────┐  │
│  │   RSS    │   │   Jina   │   │ DataForSEO │   │ Anthropic│  │
│  │ 11 feeds │   │ Search + │   │ Google News│   │ Claude   │  │
│  │          │   │  Extract │   │ + Images   │   │ Sonnet   │  │
│  └────┬─────┘   └────┬─────┘   └─────┬──────┘   └────┬─────┘  │
│       └──────────────┴───────────────┘                │        │
│                      ↓ auto-discover                  │        │
│              scored + deduplicated candidates         │        │
│                      ↓ human review                   │        │
│              structured JSON entry                    │        │
│                      ↓ saved to                       │        │
└──────────────────────────────────────────────────────────────── ┘
                        │
                        ↓
┌──────────────────────────────────────────────────────────────────┐
│                       DATA DIRECTORY                             │
│              ../data/  (NOT inside the portal repo)              │
│                                                                  │
│  intelligence/    → IntelligenceEntry JSON files                 │
│  thought-leadership/ → ThoughtLeadershipEntry JSON files         │
│  competitors/     → Competitor JSON files (25 companies)         │
│  capabilities/    → index.json (7 capability dimensions)         │
│  logos/           → downloaded SVG/PNG logos                     │
└───────────────────────────────┬──────────────────────────────────┘
                                │ read at build time
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│                  PORTAL (Next.js 16, this repo)                  │
│                       localhost:3002                             │
│                  Railway deploy on push to main                  │
│                                                                  │
│  /                  → Latest (IntelligenceFeed)                  │
│  /intelligence      → All intelligence entries                   │
│  /intelligence/[slug] → Entry detail page                        │
│  /thought-leadership  → All thought leadership                   │
│  /thought-leadership/[slug] → Piece detail page                  │
│  /landscape         → AI capabilities matrix (25 companies)      │
│  /competitors/[slug] → Company deep-dive page                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Portal — Key Files

| Path | Purpose |
|------|---------|
| `lib/data.ts` | All data-loading functions — reads from `../data/` |
| `lib/constants.ts` | SEGMENT_LABELS, FORMAT_LABELS, TYPE_LABELS, brand constants |
| `components/Header.tsx` | Sticky nav — `'use client'`, uses `usePathname()` |
| `components/AuthorAvatar.tsx` | Deterministic letter-initial avatar (no external URLs) |
| `components/IntelligenceFeed.tsx` | Main feed on `/` — lead story + grid cards |
| `components/SectionLabel.tsx` | Consistent section heading style |
| `app/landscape/page.tsx` | AI capabilities matrix — reads all competitors |
| `app/page.tsx` | Homepage — date bar + full intelligence feed |

---

## Intake Server — Key Files

| Path | Purpose |
|------|---------|
| `server.js` | Express server, all API routes |
| `agents/auto-discover.js` | Parallel RSS + Jina + DataForSEO pipeline |
| `agents/` | One file per intake function |
| `scripts/fetch-logos.js` | Downloads company logos via DataForSEO Google Images |
| `rss-feeds.json` | 11 RSS feeds for auto-discovery |
| `public/index.html` | Intake UI (single-file vanilla JS) |

### Intake Server API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auto-discover` | POST | Full parallel pipeline: RSS + Jina + DataForSEO |
| `/api/search` | POST | Jina s.jina.ai search (body: `{query}`) |
| `/api/extract` | POST | Jina r.jina.ai extract from URL |
| `/api/logos` | POST | DataForSEO Google Images logo fetch |
| `/api/entry` | POST | Save new intelligence entry to `../data/intelligence/` |

---

## Data Flow: New Intelligence Entry

```
1. Auto-Discover runs (RSS + Jina + DataForSEO)
2. Stories scored by: recency + source quality + tracked company mentions + AI keyword density
3. Top 20 candidates surfaced in intake UI with via badges (RSS/Jina/DFS)
4. Human reviews and selects a story
5. Jina extracts full article text from URL
6. Anthropic Claude structures it into IntelligenceEntry JSON
7. Saved to ../data/intelligence/{slug}.json
8. Portal picks it up on next build (Railway re-deploys automatically)
```

---

## Landscape Data Model

Every company file in `../data/competitors/{id}.json` has this shape:

```json
{
  "id": "jump-ai",
  "name": "Jump",
  "segment": "advisor_tools",
  "regions": ["us"],
  "color": "#FF5C00",
  "ai_strategy_summary": "...",
  "headline_metric": "...",
  "headline_initiative": "...",
  "overall_maturity": "scaled | deployed | piloting | announced",
  "capabilities": {
    "advisor_productivity": {
      "maturity": "scaled",
      "headline": "...",
      "detail": "...",
      "evidence": ["..."],
      "jpm_implication": "...",
      "jpm_segments_affected": ["JPMWM"],
      "date_assessed": "2026-03-10"
    }
  },
  "last_updated": "2026-03-10"
}
```

Capability IDs: `advisor_productivity` · `client_personalization` · `investment_portfolio` · `research_content` · `client_acquisition` · `operations_compliance` · `new_business_models`

Maturity levels: `scaled` (production at scale) → `deployed` (live, limited) → `piloting` (testing) → `announced` (not yet live)

---

## Landscape Coverage (as of March 2026)

**25 companies across 7 segments:**

| Segment | Companies |
|---------|-----------|
| Global Bank (6) | BofA/Merrill, Citi, Goldman Sachs, HSBC, Morgan Stanley, UBS |
| Global Private Bank (2) | Julius Baer, BNP Paribas Wealth |
| Regional Champion (4) | DBS, BBVA, Standard Chartered, RBC Wealth Management |
| Digital Disruptor (4) | Robinhood, Wealthfront, eToro, Public.com |
| AI-Native Wealth (2) | Arta.ai, Savvy Wealth |
| RIA / Independent (2) | Altruist, LPL Financial |
| Advisor Tools (5) | Jump, Nevis, Zocks, Holistiplan, Conquest Planning |
