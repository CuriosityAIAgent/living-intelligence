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
│  intelligence/    → IntelligenceEntry JSON files (44 entries)   │
│  thought-leadership/ → ThoughtLeadershipEntry JSON files (8)    │
│  competitors/     → Competitor JSON files (37 companies)         │
│  capabilities/    → index.json (7 capability dimensions)         │
│  logos/           → SVG/PNG logos (44 companies, local only)     │
│  .governance-pending.json  → Universal inbox (ALL stories pre-publish) │
│  .governance-blocked.json  → FAIL URLs permanently blocked      │
│  .rejection-log.json       → Editorial rejections (reason+notes)│
│  .pipeline-status.json     → Last pipeline run summary          │
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
│  /landscape              → AI capabilities matrix (37 companies) │
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
| `server.js` | Express server, all API routes. Uses CONTENT_DIR/INTEL_DIR/TL_DIR from config.js. |
| `agents/config.js` | Single source of truth for all paths, thresholds, constants. All agents import from here. |
| `agents/auto-discover.js` | Multi-layer discovery: L1 News (8 DFS) + L1 Caps (7 DFS) + L2 Companies (37 DFS Content Analysis) + L3 NewsAPI.ai (4 queries, 80K+ sources) + TL via Jina |
| `agents/intake.js` | Fetch article (with paywall fallback) + Claude structuring + post-structuring enrichment |
| `agents/governance.js` | Verify all claims against source → PASS/REVIEW/FAIL |
| `agents/scorer.js` | 5-dimension scoring (Source 0-25, Claims 0-25, Freshness 0-10, Impact 0-40, CXO 0-10) + multi-source bonus |
| `agents/fabrication-strict.js` | Exact-text verification. v2: multi-source, drift detection, the_so_what handling |
| `agents/context-enricher.js` | Landscape-aware the_so_what regeneration with peer comparison |
| `agents/publisher.js` | Write entry JSON, auto-correct week, auto-resolve logo, git commit + push |
| `agents/tl-publisher.js` | Publish TL entries. Railway clone-and-push mode. Quality gate (named author + insight). |
| `agents/landscape-trigger.js` | Post-publish: check if entry warrants landscape update (maturity upgrade or evidence update) |
| **v2 Pipeline Agents** | |
| `agents/research-agent.js` | Deep multi-source research: entity extraction, 5-10 source search (Jina + NewsAPI), landscape context, peer comparison |
| `agents/writer-agent.js` | Consulting-quality writer (Opus 4.6). Intelligence + TL modes. Refinement support. |
| `agents/evaluator-agent.js` | McKinsey 6-check test (Opus 4.6): specificity, so-what, source, substance, stat, competitor |
| `agents/content-producer.js` | v2 orchestrator: Research → Write → Fabrication → Evaluate → Refine → Score. 2 iterations + early exit. |
| `agents/gov-store.js` | File-backed pending queue + blocked URL list |
| `agents/scheduler.js` | Daily pipeline orchestrator. Discovery → triage → intake → governance → scoring → inbox. |
| `client/` | Editorial Studio UI — React (Vite + TS + Tailwind v4), builds to `intake-server/public/` |

### Intake Server API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auto-discover` | POST | Three-layer discovery: L1 News + L1 Caps + L2 Companies |
| `/api/search` | POST | Jina s.jina.ai search (body: `{query}`) |
| `/api/process-url` | POST | Fetch + structure + governance for one URL → queues to inbox |
| `/api/publish` | POST | Write JSON + git commit + push (called by approve-and-publish) |
| `/api/inbox` | GET | All queued stories, REVIEW-first then score desc |
| `/api/inbox/:id/approve-and-publish` | POST | SSE: approve → publish → git push (rollback on failure) |
| `/api/inbox/:id/reject-with-reason` | POST | Rejection with reason → .rejection-log.json |
| `/api/pipeline-status` | GET | Last pipeline run summary |
| `/api/recent-published` | GET | Last 7 days of published entries for audit |
| `/api/pending` | GET | Legacy pending list |
| `/api/pending/:id/approve` | POST | Legacy approve |
| `/api/pending/:id/reject` | POST | Legacy reject |
| `/api/blocked` | GET | View all permanently blocked URLs |
| `/api/health` | GET | Server health + queue counts |

---

## Data Flow: New Intelligence Entry

### v1 Pipeline (automated daily at 5am via scheduler.js)
```
1. Auto-Discover (4-layer: L1 News + L1 Caps + L2 Companies + L3 NewsAPI.ai)
2. Triage scoring: recency + source quality + tracked company + AI keywords
3. Semantic dedup (Jina Embeddings ≥0.90) + reranking (Jina Reranker) → top 15
4. Each candidate: fetch → structure → governance → fabrication → score → inbox
5. UNIVERSAL INBOX: nothing auto-publishes. Editorial review required.
```

### v2 Pipeline (consulting-quality, interactive or scheduled)
```
1. Research Agent: fetch primary + search 5-10 additional sources + landscape context
2. Writer Agent (Opus): consulting-quality entry (McKinsey voice, peer context)
3. Fabrication Agent: verify ALL claims against ALL sources, drift detection
4. Evaluator Agent (Opus): 6-point McKinsey test (specificity, so-what, source, substance, stat, competitor)
5. If NEEDS_WORK → Writer refines with evaluator feedback → Fabrication re-checks
6. Final scoring: 5 dimensions computed from finished entry
7. Entry stored with _research, _fabrication, _iterations, _final_score metadata
8. Editorial review → Approve → git push main → portal rebuilds
```

### Publish Flow
```
Approve → publisher.js: auto-correct week, auto-resolve logo, write JSON
       → commitAndPush: git add + commit + push origin main
       → landscape-trigger.js: check if entry warrants landscape update
       → Railway auto-deploys portal
```
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

## Landscape Coverage (as of April 2026)

**37 companies across 8 segments:**

| Segment | Companies |
|---------|-----------|
| Wirehouse (4) | Morgan Stanley, BofA/Merrill, Wells Fargo, JPMorgan |
| Global Private Bank (9) | UBS, Goldman Sachs, Citi PB, HSBC PB, Julius Baer, BNP Paribas Wealth, Barclays Private Bank, Santander Private Banking, Société Générale Private Banking |
| Regional Champion (7) | DBS, BBVA, Standard Chartered, RBC Wealth Management, Lloyds Wealth, ABN AMRO Private Banking, St. James's Place |
| Asset Manager (2) | Fidelity, Vanguard |
| Digital Disruptor (5) | Robinhood, Wealthfront, eToro, Public.com, Betterment |
| AI-Native Wealth (2) | Arta Finance, Savvy Wealth |
| RIA / Independent (2) | Altruist, LPL Financial |
| Advisor Tools (5) | Jump, Nevis, Zocks, Holistiplan, Conquest Planning |

---

## Railway Deployment Map

Three independent Railway services, each deploying from a different git branch:

| Railway Service | Git Branch | Domain | What It Deploys |
|----------------|------------|--------|-----------------|
| `living-intelligence` | `main` | `wealth.tigerai.tech` | **The Portal** — what users/executives see (Next.js) |
| `proud-reflection` | `intake` | (internal only) | **Editorial Studio / Intake Server** — content pipeline, agents, API (Express) |
| `profound-wonder` | `feature/landing-page` | `livingintel.ai` | **Landing page** — public marketing site |

### What goes where

- **Portal UI changes** (pages, components, styles, CTA buttons, data files) → commit and push to `main` → `living-intelligence` service rebuilds → live on `wealth.tigerai.tech`
- **Intake server changes** (agents, pipeline code, Editorial Studio UI) → commit and push to `intake` → `proud-reflection` service rebuilds
- **Content publishing** (approved stories via Editorial Studio) → publisher.js pushes directly to `main` → portal rebuilds with new content

### Common mistake

Pushing portal UI changes to `intake` will only redeploy the intake server — the portal at `wealth.tigerai.tech` won't update. Portal changes **must** go to `main`.

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
