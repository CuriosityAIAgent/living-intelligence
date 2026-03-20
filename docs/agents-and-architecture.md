# Agents & Technical Architecture

## System Overview

Two deployed services, one GitHub repository, zero databases.

```
GitHub: CuriosityAIAgent/living-intelligence
│
├── Portal (Next.js 16)          → Railway service: "living-intelligence"
│   URL: wealth.tigerai.tech     → Static build, reads JSON at build time
│
└── Intake Server (Node.js)      → Railway service: "proud-reflection"
    Port: 3003                   → Content pipeline + API + cron jobs
```

---

## Services

### 1. Portal — `living-intelligence/` (Next.js 16)

**Purpose:** Public-facing intelligence dashboard for wealth management executives.

**Deploy:** Railway auto-deploys on every push to `main`. Static build — no runtime API calls, no database.

**Pages:**
| Route | Purpose |
|---|---|
| `/` | Latest intelligence + featured lead story |
| `/intelligence` | Full intelligence feed with region/topic filters |
| `/intelligence/[slug]` | Article detail with formatted summary |
| `/thought-leadership` | Curated essays and reports |
| `/thought-leadership/[slug]` | Piece detail with insight callout + quotes |
| `/landscape` | 26-company AI capabilities matrix |
| `/competitors/[slug]` | Company deep-dive with capability detail |

**Key components:**
- `lib/data.ts` — all data loading (reads `data/` at build time)
- `components/Header.tsx` — sticky two-tier nav
- `components/IntelligenceFeed.tsx` — lead story + grid cards
- `app/landscape/page.tsx` — capabilities matrix table

---

### 2. Intake Server — `intake-server/` (Node.js/Express)

**Purpose:** Content discovery, structuring, governance, and publishing pipeline.

**Deploy:** Railway `proud-reflection` service. Always-on — cron runs at 6am Europe/London daily.

**Cron:** `node-cron` → `0 6 * * *` → `runDailyPipeline()` → Telegram digest

**Environment variables (Railway):**
| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API for structuring + governance |
| `JINA_API_KEY` | Jina article extraction + web search |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | Google News + Images |
| `TELEGRAM_BOT_TOKEN` | Digest notifications (replaces SMTP) |
| `TELEGRAM_CHAT_ID` | Target chat for daily digest |
| `REVIEW_SECRET` | HMAC-SHA256 signing for review links |
| `INTAKE_BASE_URL` | Public URL for review link generation |
| `PORTAL_URL` | Portal link in digest messages |

---

## Agent Architecture

Eight agents in `intake-server/agents/`, each with a single responsibility:

```
auto-discover.js  ──┐
                    ├──► scored candidates (RSS + Jina + DFS News + DFS Content Analysis)
intake.js  ─────────┤
                    ├──► structured entry (paywall → DataForSEO News + Organic in parallel)
governance.js  ─────┤
                    ├──► verified claims
scorer.js  ─────────┤
                    ├──► PUBLISH / REVIEW / BLOCK + score breakdown
gov-store.js  ──────┤
                    ├──► pending queue / blocked list
publisher.js  ──────┤
                    ├──► JSON file + git commit + push
notifier.js  ───────┤
                    └──► Telegram digest (score + unverified claims per item)
scheduler.js  ──────── orchestrates daily pipeline
auditor.js  ────────── standalone audit engine (fast + deep modes)
```

### `auto-discover.js` — Content Discovery

Runs **four sources in parallel** via `Promise.allSettled`:

1. **RSS (11 feeds):** FT, Bloomberg, Reuters, WSJ, Fintech Nexus, WealthManagement.com, ThinkAdvisor, InvestmentNews, RIABiz, Advisor Perspectives, Wealthtechtoday
2. **Jina Search (7 queries):** `s.jina.ai` — general AI wealth management queries
3. **DataForSEO Google News (5 queries):** Recent news results via DataForSEO SERP API
4. **DataForSEO Content Analysis (7 queries):** Company-specific queries (Goldman, Morgan Stanley, JPMorgan, Altruist, LPL, UBS, wealthtech 2026) — filtered to `content_quality_score > 2`, news pages only, last 90 days

Deduplicates against all existing `source_url` fields in `data/intelligence/`.

Scores each candidate:
- +10 recency (last 72h), +5 (last week), +2 (older)
- +4–6 source quality (primary outlet vs tier-1 outlet)
- +2 per tracked company mention (Goldman, JPM, UBS, etc.)
- +1 per AI keyword
- +4–6 Content Analysis (base +4, up to +2 for quality score) / +3 DataForSEO News / +2 Jina

Returns top 20 candidates with `via` badge (RSS / Jina / DFS / Content Analysis).

### `intake.js` — Article Fetch + Structuring

1. Fetches article via `r.jina.ai` (cleans HTML → markdown)
2. **Paywall bypass:** If paywall/thin content detected → extracts headline from teaser → runs **DataForSEO Google News + Google Organic in parallel** → filters for open sources (press release wires first, then trade press) → fetches best alternative via Jina → combines content. Non-paywalled articles use Jina keyword search for supplementary context.
3. Calls **Claude `claude-sonnet-4-6`** with strict grounding prompt → structured `IntelligenceEntry` JSON
4. No inference allowed — Claude only extracts what is in the source

### `governance.js` — Claim Verification

Second Claude call (separate from structuring) verifies every claim in the generated entry against the source article.

Verdict rules:
- **PASS** → all claims verified, `source_verified: true`
- **REVIEW** → 1-2 unverified claims (implied, not fabricated) → held for human approval
- **FAIL** → any claim contradicts source or appears fabricated → URL permanently blocked

Returns: `{ verdict, confidence, verified_claims, unverified_claims, fabricated_claims, notes, paywall_caveat }`

### `scorer.js` — Auto-Judgment Layer

Sits between governance output and publish/review/block routing. Scores each entry across 4 dimensions (total 0–100):

| Dimension | Max | Method |
|---|---|---|
| **Source Quality** | 30 | DataForSEO Backlinks API — live `domain_rank` (0–100). `spam_score ≥ 40` → 3pts regardless. Falls back to manual tier list if API unavailable. Press releases / newsrooms always = 30. |
| **Claim Verification** | 30 | From governance output: 0 unverified = 30, 1 = 18, 2 = 8, any fabricated = −100 (auto-block) |
| **Content Freshness** | 20 | ≤7 days = 20, ≤30 days = 14, ≤90 days = 6, older = 0 |
| **Relevance Signal** | 20 | Tracked company + specific AI product/metric = 20, tracked + general = 13, untracked + specific = 8, tangential = 3 |

**Routing thresholds:**
- Score ≥ 75 → **PUBLISH** (auto-publish, no Telegram)
- Score 50–74 → **REVIEW** (Telegram with score breakdown + each unverified claim)
- Score < 50 or any fabricated claim → **BLOCK** (URL permanently blocked)
- Paywall caveat → PUBLISH downgraded to REVIEW

Domain authority results cached in-process — one Backlinks API call per domain per pipeline run.

### `gov-store.js` — Governance State

File-backed stores (in `data/`):
- `.governance-pending.json` — REVIEW entries awaiting human approval
- `.governance-blocked.json` — permanently blocked URLs (cannot be resubmitted)

Operations: `getPending`, `addPending`, `approvePending`, `rejectPending`, `getBlocked`, `addBlocked`, `isBlocked`

### `publisher.js` — Write + Commit

1. Writes entry JSON to `data/intelligence/{slug}.json` with `_governance` block inline
2. `git add` + `git commit` + `git push origin main`
3. Railway detects push → auto-redeploys portal

### `notifier.js` — Telegram Digest

Sends daily digest via **Telegram Bot API** (HTTPS — no SMTP needed, Railway-compatible).

Message format: Published (✅) / Needs Review (⚠️) / Blocked (🚫) / Errors (❌)

Review links use HMAC-SHA256 token signing (`REVIEW_SECRET`) — one-tap approve/reject from Telegram.

### `scheduler.js` — Daily Pipeline Orchestration

Runs at 6am Europe/London:
1. `autoDiscover()` → find new candidates
2. Score + filter → top candidates
3. `processUrl()` + `verify()` for each → governance gate
4. `publish()` for PASSed entries
5. `sendDigest()` → Telegram summary

### `auditor.js` — Data Quality Audit Engine *(new)*

Two modes:

**Fast mode** (rule-based, no API cost, runs in seconds):
- Intelligence checks: date vs URL date, week field accuracy, future dates, missing governance, source_verified consistency, multiple featured entries, key_stat in summary, governance confidence, fabricated claims
- Landscape checks: segment classification validity, maturity level validity, overall vs capability consistency, sources per capability, evidence arrays, stale date_assessed, missing headline metrics

**Deep mode** (fast + Claude AI verification):
- Intelligence: fetches source via Jina, Claude verifies key_stat + date + first verified claim
- Landscape: Claude checks segment classification, maturity consistency, metric plausibility

Output: `data/audit-report.json` with per-file PASS/WARN/FAIL and overall score (0–100).

Accessible via:
- CLI: `node --env-file=.env scripts/audit-all.js [--deep]`
- API: `GET /api/audit` (fast) / `GET /api/audit/deep` (deep)
- UI: Intake server Audit tab

---

## API Endpoints (Intake Server)

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auto-discover` | Parallel RSS + Jina + DataForSEO discovery |
| POST | `/api/search` | Jina web search |
| POST | `/api/discover` | RSS-only discovery |
| POST | `/api/process-url` | Fetch + structure + governance for one URL |
| POST | `/api/publish` | Publish (enforces governance gate) |
| GET | `/api/pending` | List REVIEW entries awaiting approval |
| POST | `/api/pending/:id/approve` | Approve REVIEW entry |
| POST | `/api/pending/:id/reject` | Reject + permanently block |
| GET | `/api/blocked` | View all blocked URLs |
| GET | `/api/health` | Server health + queue counts |
| GET | `/api/audit` | Run fast audit (SSE stream) |
| GET | `/api/audit/deep` | Run deep audit with Claude (SSE stream) |
| GET | `/api/audit/report` | Fetch last saved audit report |
| POST | `/api/run-pipeline` | Manually trigger daily pipeline |
| POST | `/api/test-digest` | Send sample Telegram digest |
| GET | `/review/:token` | Mobile review page (approve/reject) |

---

## Data Model

```
data/
├── intelligence/       ← ~32 IntelligenceEntry JSON files
├── thought-leadership/ ← 6 ThoughtLeadershipEntry JSON files (all URLs verified)
├── competitors/        ← 27 Competitor JSON files (7 segments)
├── capabilities/       ← index.json (7 capability dimensions)
├── logos/              ← Local SVG/PNG logos (never use external URLs)
├── audit-report.json   ← Latest audit output (auto-generated)
├── .governance-pending.json
└── .governance-blocked.json
```

### Intelligence Entry Schema (key fields)
```json
{
  "id": "slug",
  "type": "market_signal | product_launch | milestone | research",
  "headline": "...",
  "company": "slug",
  "date": "YYYY-MM-DD",
  "week": "YYYY-MM-DD (Monday of week)",
  "source_url": "verified working URL",
  "source_verified": true,
  "featured": false,
  "key_stat": { "number": "...", "label": "..." },
  "_governance": {
    "verdict": "PASS | REVIEW | FAIL",
    "confidence": 0-100,
    "verified_claims": [...],
    "fabricated_claims": [],
    "human_approved": true,
    "approved_at": "ISO timestamp"
  }
}
```

### Competitor / Landscape Schema (key fields)
```json
{
  "id": "slug",
  "segment": "wirehouse | global_private_bank | regional_champion | digital_disruptor | ai_native | ria_independent | advisor_tools",
  "overall_maturity": "scaled | deployed | piloting | announced | no_activity",
  "capabilities": {
    "advisor_productivity": {
      "maturity": "scaled | deployed | piloting | announced | no_activity",
      "headline": "...",
      "detail": "...",
      "evidence": ["..."],
      "sources": [{ "name": "...", "url": "..." }],
      "date_assessed": "YYYY-MM-DD"
    }
  }
}
```

---

## External Services

| Service | Usage | Auth |
|---|---|---|
| Anthropic Claude (`claude-sonnet-4-6`) | Structuring + governance verification | `ANTHROPIC_API_KEY` |
| Jina AI `r.jina.ai` | Article extraction (HTML → markdown) | `JINA_API_KEY` |
| Jina AI `s.jina.ai` | Web search — non-paywalled enrichment | `JINA_API_KEY` |
| DataForSEO — Google News SERP | Discovery (5 queries) + paywall bypass | `DATAFORSEO_LOGIN/PASSWORD` |
| DataForSEO — Google Organic SERP | Paywall bypass in parallel with News | `DATAFORSEO_LOGIN/PASSWORD` |
| DataForSEO — Google Images SERP | Logo fetching for landscape companies | `DATAFORSEO_LOGIN/PASSWORD` |
| DataForSEO — Content Analysis Search | 4th discovery source (7 company queries) | `DATAFORSEO_LOGIN/PASSWORD` |
| DataForSEO — Backlinks Summary | Live domain authority for scorer Dim A | `DATAFORSEO_LOGIN/PASSWORD` |
| Telegram Bot API | Daily digest (no SMTP needed) | `TELEGRAM_BOT_TOKEN` |
| Railway | Hosting (portal + intake server) | Dashboard |
| GitHub | Git remote, auto-deploy trigger | SSH / HTTPS |

---

## Key Design Decisions

1. **No database** — all data is flat JSON in git. Portal is static. Zero runtime dependencies.
2. **Two-call AI pattern** — structure first (intake.js), verify second (governance.js). Separate calls prevent self-serving verification.
3. **Telegram over SMTP** — Railway blocks all SMTP ports (25, 465, 587). Telegram Bot API uses HTTPS only.
4. **HMAC-signed review links** — one-tap approve/reject from Telegram without login. Signed with `REVIEW_SECRET`.
5. **Git as publish mechanism** — publisher.js commits and pushes directly. Railway redeploys on push. No separate deploy step.
6. **Audit as a script** — audit-all.js runs before any CEO presentation. Exit code 1 if critical issues found. Can be wired to CI/CD.
7. **Search, don't guess** — when finding source URLs, use Jina search or WebFetch with a query term. Never guess URL patterns more than twice.

---

## Content Standards & Governance Rules

These rules are enforced by the audit pipeline and must be followed manually when creating entries.

### Intelligence Entries
| Rule | Standard |
|---|---|
| Date | 2025 or later. Nothing older unless no newer equivalent exists. |
| Source URL | Must be fetched and confirmed working before entry is written. |
| Key stat | Must appear verbatim in `verified_claims`. Must be the most current available figure — check for newer press releases. |
| Duplicates | One entry per story. If same headline and source URL appear twice, delete the REVIEW one. |
| Featured | Exactly one entry with `featured: true` — the most recent significant story. |
| `source_verified` | Must match governance: `true` only if `verdict === 'PASS'` or `human_approved === true`. |

### Thought Leadership
| Rule | Standard |
|---|---|
| Date | 2025 preferred. 2024 acceptable for canonical foundational essays only (Altman, Amodei, Mollick). Nothing from 2022–2023. |
| Source URL | Must be verified working before entry is written. |
| `key_quotes` | Verbatim only. If WebFetch does not return the exact text, do not include it. |
| `the_one_insight` | Editorial synthesis — not a direct quote. Must not render in quotation marks in the UI. |

### Landscape / Competitor Entries
| Rule | Standard |
|---|---|
| Segment | Must be one of 7 valid values (see CLAUDE.md). |
| Maturity | `overall_maturity` cannot exceed the highest capability maturity by more than one level. |
| Evidence | Every capability must have at least one named source with a working URL. |
| Numbers | All metrics (interaction counts, AUM, user numbers) must cite the most recent available press release. Never extrapolate from growth rates. |
| `date_assessed` | Flag as stale if > 90 days old. Re-verify before CEO presentations. |

### Verified Data Points (as of 2026-03-19)
| Company | Metric | Source | Date |
|---|---|---|---|
| BofA / Merrill | 3.2B Erica interactions total; 20.6M users; 700M interactions in 2025; 30B total digital | BofA Newsroom press release | 2026-03-10 |
| Altruist / Hazel | 1,600 new RIA firms in first month; 1,500/month projected | RIABiz | 2026-03-18 |
| Altruist / Hazel | $130B market cap wiped from Schwab/LPL/Raymond James/Ameriprise | Nick Beim/Venrock; CNBC | 2026-02-10 |
| Holistiplan | 38.92% market share; 50,000+ users | Verified source | 2026-03 |
| RBC WM | 2,000+ US advisors on AI platform | Verified source | 2026-03 |
