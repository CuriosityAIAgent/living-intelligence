# System Architecture

## Two-System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTAKE SERVER (port 3003)                     │
│                   ../intake-server/server.js                     │
│                                                                  │
│  ┌───────────────┐   ┌──────────┐   ┌────────────────────┐  │
│  │  DataForSEO   │   │   Jina   │   │ Anthropic Claude   │  │
│  │ L1: 8 broad   │   │ Search + │   │ Sonnet             │  │
│  │ L2: N per-co  │   │  Extract │   │ (structure+verify) │  │
│  └───────┬───────┘   └────┬─────┘   └─────────┬──────────┘  │
│          └────────────────┴──────────────────  │             │
│                      ↓ auto-discover            │             │
│              scored + deduplicated candidates         │        │
│                      ↓ human selects                  │        │
│              Jina fetches full article                │        │
│              (paywall fallback: search alternatives)  │        │
│                      ↓ Claude structures              │        │
│              Claude verifies all claims               │        │
│                      ↓ governance gate                │        │
│         PASS → ready to publish                       │        │
│         REVIEW → pending queue (human sign-off)       │        │
│         FAIL → permanently blocked URL                │        │
│                      ↓ published                      │        │
└──────────────────────────────────────────────────────────────── ┘
                        │
                        ↓
┌──────────────────────────────────────────────────────────────────┐
│                  DATA DIRECTORY (inside this repo)               │
│                    ./data/  — tracked in git                     │
│                                                                  │
│  intelligence/    → IntelligenceEntry JSON files (32 entries)   │
│  thought-leadership/ → ThoughtLeadershipEntry JSON files (6)    │
│  competitors/     → Competitor JSON files (27 companies)         │
│  capabilities/    → index.json (7 capability dimensions)         │
│  logos/           → SVG/PNG logos (24 companies, local only)     │
│  .governance-pending.json  → REVIEW entries awaiting approval   │
│  .governance-blocked.json  → FAIL URLs permanently blocked      │
└───────────────────────────────┬──────────────────────────────────┘
                                │ read at build time
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│                  PORTAL (Next.js 16, this repo)                  │
│                       localhost:3002                             │
│                  Railway deploy on push to main                  │
│                                                                  │
│  /                       → Latest (IntelligenceFeed)             │
│  /intelligence           → All intelligence entries              │
│  /intelligence/[slug]    → Article detail page                   │
│  /thought-leadership     → All thought leadership                │
│  /thought-leadership/[slug] → Piece detail page                  │
│  /landscape              → AI capabilities matrix (27 companies) │
│  /competitors/[slug]     → Company detail page                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Portal — Key Files

| Path | Purpose |
|------|---------|
| `lib/data.ts` | All data-loading functions — reads from `data/` |
| `lib/constants.ts` | SEGMENT_LABELS, FORMAT_LABELS, TYPE_LABELS, brand constants |
| `components/Header.tsx` | Sticky two-tier nav — `'use client'`, uses `usePathname()` |
| `components/AuthorAvatar.tsx` | Deterministic letter-initial avatar (no external URLs) |
| `components/IntelligenceFeed.tsx` | Main feed on `/` — lead story + grid cards |
| `components/SectionLabel.tsx` | Consistent section heading style |
| `app/landscape/page.tsx` | AI capabilities matrix — reads all competitors |
| `app/page.tsx` | Homepage — date bar + full intelligence feed |
| `app/intelligence/[slug]/page.tsx` | Article detail — FormattedSummary with lede + keyword bolding |
| `app/thought-leadership/[slug]/page.tsx` | Piece detail — insight callout, summary bullets, quotes |

---

## Intake Server — Key Files

| Path | Purpose |
|------|---------|
| `server.js` | Express server, all API routes |
| `agents/auto-discover.js` | Three-layer discovery: L1 News (8 broad DFS News) + L1 Caps (7 capability-dimension DFS News, dynamic from index.json) + L2 per-company DFS Content Analysis + TL via Jina |
| `agents/intake.js` | Fetch article (with paywall fallback) + Claude structuring |
| `agents/governance.js` | Verify all claims against source → PASS/REVIEW/FAIL |
| `agents/gov-store.js` | File-backed pending queue + blocked URL list |
| `agents/publisher.js` | Write entry JSON + `_governance` audit, git commit + push |
| `scripts/backfill-governance.js` | One-time: add `_governance` to all existing entries |
| `scripts/reprocess-failed.js` | Re-run FAIL entries through corrected pipeline |
| `scripts/test-portal.js` | Health check all URLs + portal pages, auto-fix broken links |
| `rss-feeds.json` | Archived — RSS removed; DataForSEO two-layer replaces it |
| `public/index.html` | Intake UI (single-file vanilla JS, includes Review tab) |

### Intake Server API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auto-discover` | POST | Full parallel pipeline: RSS + Jina + DataForSEO |
| `/api/search` | POST | Jina s.jina.ai search (body: `{query}`) |
| `/api/discover` | POST | RSS-only discovery |
| `/api/process-url` | POST | Fetch + structure + governance for one URL |
| `/api/publish` | POST | Publish entries (enforces governance gate server-side) |
| `/api/pending` | GET | List REVIEW entries awaiting human approval |
| `/api/pending/:id/approve` | POST | Approve a REVIEW entry → moves to publishable |
| `/api/pending/:id/reject` | POST | Reject a REVIEW entry → permanently blocks URL |
| `/api/blocked` | GET | View all permanently blocked URLs |
| `/api/health` | GET | Server health + governance queue counts |

---

## Data Flow: New Intelligence Entry

```
1. Auto-Discover runs (two-layer: L1 broad DFS News + L2 per-company DFS Content Analysis)
2. Stories scored by: recency + source quality + tracked company mentions + AI keyword density
3. Top 20 candidates surfaced in intake UI with via badges (L1 News/L1 Caps/L2 Companies)
4. Human reviews and selects a story
5. Jina fetches full article from URL
   └── If paywall detected → searches for open-source alternatives automatically
       └── Fetches up to 2 open-source alternatives and combines content
6. Claude structures into IntelligenceEntry JSON (strict grounding rules — no inference)
7. Claude verifies every claim in the entry against the source (governance check)
   ├── PASS  → entry ready to publish
   ├── REVIEW → entry held in pending queue (localhost:3003 Review tab)
   │           Human approves/rejects before publish allowed
   └── FAIL  → URL permanently blocked, entry discarded
8. Human clicks Publish → entry written to data/intelligence/{slug}.json
   └── _governance audit block written inline to every JSON file
   └── source_verified = true only if PASS or human_approved
9. git add + commit + push origin dev → Railway auto-deploys on merge to main
```

---

## Governance Audit Block

Every published entry contains a `_governance` block:

```json
"_governance": {
  "verdict": "PASS | REVIEW | FAIL",
  "confidence": 0-100,
  "verified_claims": ["claims confirmed in source"],
  "unverified_claims": ["claims implied but not explicit"],
  "fabricated_claims": ["claims contradicting or absent from source"],
  "notes": "brief explanation",
  "paywall_caveat": false,
  "verified_at": "2026-03-11T00:00:00.000Z",
  "human_approved": false,
  "approved_at": null,
  "fallback_sources": ["alternative URLs used if original was paywalled"]
}
```

`source_verified` on the entry always reflects the actual governance outcome — never hardcoded.

---

## Landscape Data Model

Every company file in `data/competitors/{id}.json`:

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
  "overall_maturity": "scaled | deployed | piloting | announced | no_activity",
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

Maturity levels: `scaled` → `deployed` → `piloting` → `announced` → `no_activity`

Definitions shown on the landscape page below the matrix:
- **Scaled**: Live, widely deployed, measurably impacting business outcomes
- **Deployed**: Live in production but adoption partial, regional, or limited in scope
- **Piloting**: Tested with select users; not yet broadly available
- **Announced**: Publicly committed to building; not yet in production
- **No Activity**: No public evidence of any activity in this capability area

---

## Landscape Coverage (as of March 2026)

**27 companies across 7 segments:**

| Segment | Companies |
|---------|-----------|
| Wirehouse (4) | Morgan Stanley, BofA/Merrill, Wells Fargo, JPMorgan |
| Global Private Bank (6) | UBS, Goldman Sachs, Citi PB, HSBC PB, Julius Baer, BNP Paribas Wealth |
| Regional Champion (4) | DBS, BBVA, Standard Chartered, RBC Wealth Management |
| Digital Disruptor (4) | Robinhood, Wealthfront, eToro, Public.com |
| AI-Native Wealth (2) | Arta Finance, Savvy Wealth |
| RIA / Independent (2) | Altruist, LPL Financial |
| Advisor Tools (5) | Jump, Nevis, Zocks, Holistiplan, Conquest Planning |

---

## Article Summary Formatting

The intelligence article detail page (`app/intelligence/[slug]/page.tsx`) uses pure regex formatting — no AI, no fabrication risk:

1. **Split into sentences** using punctuation regex
2. **Bold the lede** — opening clause (text before first comma/semicolon/colon at chars 15–85)
3. **Bold key figures** — `$X billion/million`, `X%`, `X advisors/clients/firms`
4. **Bold proper nouns** — multi-word capitalized sequences (company/product names)
5. Rendered as bullet list with FT claret `→` markers

---

## Testing

Run after any batch data change:

```bash
cd intake-server
node scripts/test-portal.js --fast    # skip slow source_url checks
node scripts/test-portal.js           # full check including all source URLs
node scripts/test-portal.js --dry-run # report only, no auto-fixes
```

Checks: `document_url` (thought-leadership PDFs), `image_url`, `author.photo_url`, `source_verified` consistency, all portal pages at localhost:3002.
Auto-fixes: clears broken remote URLs, corrects `source_verified` mismatches.
