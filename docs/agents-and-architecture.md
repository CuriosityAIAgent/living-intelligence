# Agents & Technical Architecture

## System Overview

Two deployed services, one GitHub repository, Supabase KB (PostgreSQL + pgvector).

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

15 agents in `intake-server/agents/`, each with a single responsibility:

```
V1 PIPELINE (automated daily at 5am, Sonnet):
auto-discover.js     ──┐
                       ├──► scored candidates (DFS News + DFS Content Analysis + Jina + NewsAPI.ai)
intake.js  ────────────┤
                       ├──► structured entry (paywall → DataForSEO News + Organic in parallel)
                       │    Stores raw markdown to KB before Claude structuring (Principle 1)
context-enricher.js ───┤
                       ├──► enriched the_so_what (landscape + peer context)
format-validator.js ───┤
                       ├──► schema validation (pure rules, no API cost)
governance.js  ────────┤
                       ├──► claim verification (12k source window)
fabrication-strict.js ─┤
                       ├──► CLEAN / SUSPECT / FAIL (full source text, no truncation for Opus)
scorer.js  ────────────┤
                       ├──► PUBLISH / REVIEW / BLOCK + score breakdown
gov-store.js  ─────────┤
                       ├──► pending queue / blocked list
publisher.js  ─────────┤
                       ├──► JSON file + git commit + push
notifier.js  ──────────┤
                       └──► Telegram digest (score + unverified claims per item)
scheduler.js  ─────────── orchestrates daily pipeline + stores briefs to KB
auditor.js  ───────────── standalone audit engine (fast + deep modes)
kb-client.js  ─────────── Supabase singleton + KB helpers (store/query/embed/search)

V2 PIPELINE (on-demand, Opus 4.6 via Claude Code Max):
research-agent.js  ────── Deep multi-source research + entity extraction + KB context
writer-agent.js  ──────── Consulting-quality writer (Opus 4.6, McKinsey voice)
evaluator-agent.js  ───── McKinsey 6-check quality test (Opus 4.6)
content-producer.js  ──── V2 orchestrator: Research → Write → Fabrication → Evaluate → Refine

PROMPTS (versioned, in intake-server/prompts/):
intake-v1.js  ─────────── Structuring prompt (imported by intake.js)
governance-v1.js  ─────── Verification prompt (imported by governance.js)
fabrication-v1.js  ────── Single-source fabrication (imported by fabrication-strict.js)
fabrication-v2.js  ────── Multi-source fabrication + drift detection
entity-extraction-v1.js ─ Entity extraction (imported by research-agent.js)
writer-v1.js  ─────────── Consulting writer prompt (imported by writer-agent.js)
evaluator-v1.js  ──────── McKinsey 6-check test prompt (imported by evaluator-agent.js)
```

### `auto-discover.js` — Content Discovery

Runs **four sources in parallel** via `Promise.allSettled`:

1. **RSS (11 feeds):** FT, Bloomberg, Reuters, WSJ, Fintech Nexus, WealthManagement.com, ThinkAdvisor, InvestmentNews, RIABiz, Advisor Perspectives, Wealthtechtoday
2. **Jina Search (7 queries):** `s.jina.ai` — general AI wealth management queries
3. **DataForSEO Google News (5 queries):** Recent news results via DataForSEO SERP API
4. **DataForSEO Content Analysis (7 queries):** Company-specific queries (Goldman, Morgan Stanley, JPMorgan, Altruist, LPL, UBS, wealthtech 2026) — filtered to `content_quality_score > 2`, news pages only, last 90 days

Deduplicates against all existing `source_url` fields in `data/intelligence/`.

Scores each candidate (rule-based, top 40):
- +10 recency (last 72h), +5 (last week), +2 (older)
- +4–6 source quality (primary outlet vs tier-1 outlet)
- +2 per tracked company mention (Goldman, JPM, UBS, etc.)
- +1 per AI keyword
- +4–6 Content Analysis (base +4, up to +2 for quality score) / +3 DataForSEO News / +2 Jina

**Stage 2b — Semantic dedup (Jina Embeddings `jina-embeddings-v3`):** Embeds all top-40 candidates and all published intelligence entries (`headline + summary`). Drops any candidate with cosine similarity ≥ 0.90 to a published entry — catches same-story re-runs that URL dedup misses.

**Stage 3 — Jina Reranker (`jina-reranker-v3`):** Reranks surviving candidates by cross-attention relevance to "significant AI product launch or milestone in wealth management financial services". Returns top 20 in relevance order with `rerank_score` attached.

Returns top 20 candidates with `via` badge (RSS / Jina / DFS / Content Analysis) + `rerank_score`.

### `intake.js` — Article Fetch + Structuring

1. Fetches article via `r.jina.ai` (cleans HTML → markdown)
2. **Paywall bypass:** If paywall/thin content detected → extracts headline from teaser → runs **DataForSEO Google News + Google Organic in parallel** (up to 8 candidates) → **Jina Reranker** picks the alternative closest to the original teaser → fetches top alternatives via Jina → combines content. Non-paywalled articles use Jina keyword search for supplementary context.
3. Calls **Claude `claude-sonnet-4-6`** with three-layer editorial prompt → structured `IntelligenceEntry` JSON
   - Layer 1: Which AI capability is advancing?
   - Layer 2: What is the triggering event?
   - Layer 3: `the_so_what` — why this matters strategically (CXO-facing, one sentence)
4. No inference allowed — Claude only extracts what is in the source

### `context-enricher.js` — Landscape-Aware the_so_what *(session 8)*

Runs after intake structuring, before validation. Regenerates `the_so_what` with full competitive context that intake.js cannot have.

Inputs to Claude:
- Last 3 published entries for the same company (from `data/intelligence/`)
- Company's current maturity in the relevant capability (from `data/competitors/`)
- Top 2 peer competitors in the same segment + same capability dimension, by maturity rank

Output: `{ the_so_what, what_changed, landscape_context: { current_maturity, maturity_direction, competitor_gap }, enrichment_confidence, enrichment_notes }`

**Non-fatal:** Falls back to original `the_so_what` on any error — enrichment failure never blocks a good story.

### `format-validator.js` — Schema Validation *(session 8)*

Pure rules engine — zero Claude API cost. Runs after context enrichment.

9 checks:
1. Headline ≤ 120 characters
2. Summary ≥ 2 sentences (regex: skips digit.digit to avoid splitting "$14.00")
3. `the_so_what` present and non-empty
4. Date is valid and not in the future
5. `week` matches ISO Monday of the date (UTC noon to avoid DST edge cases)
6. `type` is one of valid enum values
7. `tags.capability`, `tags.region`, `tags.segment` are valid enum values
8. `key_stat.number` non-empty if key_stat present
9. `source_url` starts with `http`; `image_url` is not an unavatar.io URL

**Non-fatal:** Format errors annotate `_format_errors` on the entry and route it to REVIEW, but do not block the pipeline.

### `fabrication-strict.js` — Dedicated Fabrication Check *(session 8)*

Third Claude call (after governance) dedicated entirely to fabrication detection. Uses 12k source window (double the original governance.js 6k limit).

Five explicit checks:
1. Numbers in headline appear verbatim in source
2. Company name spelled correctly as used in source
3. Date in the entry appears in the article body
4. `key_stat.number` is literally present in source text
5. Any quoted phrases appear verbatim in source

Verdicts: **CLEAN** / **SUSPECT** / **FAIL**
- **CLEAN** → no issues found
- **SUSPECT** → "not found" may be truncation, not fabrication (source window limit hit)
- **FAIL** → claim directly contradicts source → **HARD BLOCK** regardless of governance verdict

Returns: `{ verdict, issues, check_details, checked_at }`

### `governance.js` — Claim Verification

Second Claude call (separate from structuring) verifies every claim in the generated entry against the source article. Source window: **12,000 characters** (increased from 6,000 in session 8).

Verdict rules:
- **PASS** → all claims verified, `source_verified: true`
- **REVIEW** → 1-2 unverified claims (implied, not fabricated) → held for human approval
- **FAIL** → any claim contradicts source or appears fabricated → URL permanently blocked

Returns: `{ verdict, confidence, verified_claims, unverified_claims, fabricated_claims, notes, paywall_caveat }`

### `scorer.js` — Auto-Judgment Layer

Sits between governance output and publish/review/block routing. Scores each entry across 4 dimensions (total 0–100):

| Dimension | Max | Method |
|---|---|---|
| **A: Source Quality** | 25 | DataForSEO Backlinks API — live `domain_rank` (0–100). `spam_score ≥ 40` → 2pts regardless. Falls back to manual tier list if API unavailable. Press releases / strong newsrooms = 25. Tier 1 media = 22. Tier 2 industry press = 17. Weak newsroom (`/news/`, `/blog/`) = 20 — only applied AFTER checking TIER1/TIER2 to prevent false positives. General = 9. |
| **B: Claim Verification** | 25 | From governance output: 0 unverified = 25, 1 = 15, 2 = 6, 3+ = 0, any fabricated = −100 (auto-block) |
| **C: Freshness** | 10 | ≤1d = 10, ≤3d = 8, ≤7d = 6, ≤14d = 4, ≤30d = 2, ≤90d = 1, older = hard BLOCK |
| **D: Capability Impact** | 40 | Which of 7 capability dimensions is advancing, what evidence, at what scale. `capability_evidence` populated → 15–40pts. Tracked company without capability_evidence → floor at 20pts. |

**Routing thresholds (Universal Inbox — nothing auto-publishes):**
- Score ≥ 75 → **INBOX** (high-confidence story, queued for editorial sign-off)
- Score 45–74 → **INBOX** (REVIEW verdict, requires closer look)
- Score < 45 or any fabricated claim → **BLOCK** (URL permanently blocked)
- Paywall caveat → PUBLISH downgraded to REVIEW in inbox

All scored entries go to `addPending()` in gov-store. Haresh reviews and approves in the Editorial Studio before anything publishes.

Domain authority results cached in-process — one Backlinks API call per domain per pipeline run.

### `gov-store.js` — Governance State

File-backed stores (in `data/`):
- `.governance-pending.json` — all inbox entries awaiting human sign-off (both PASS and REVIEW)
- `.governance-blocked.json` — permanently blocked URLs (cannot be resubmitted)
- `.rejection-log.json` — editorial rejection records with reason + notes (for algorithm tuning)
- `.pipeline-status.json` — last pipeline run summary (started_at, candidates_found, queued, blocked, errors)

Operations:
- `getPending`, `addPending(entry, governance, metadata={})`, `approvePending`, `rejectPending`
- `getBlocked`, `addBlocked`, `isBlocked`
- `addRejectionLog(entry)`, `getRejectionLog()`
- `writePipelineStatus(status)`, `readPipelineStatus()`

`addPending` stores optional `metadata.score` and `metadata.score_breakdown` alongside each entry.

### `publisher.js` — Write + Commit

1. Writes entry JSON to `data/intelligence/{slug}.json` with `_governance` block inline
2. `git add` + `git commit` + `git push origin main`
3. Railway detects push → auto-redeploys portal

### `notifier.js` — Telegram Digest

Sends daily digest via **Telegram Bot API** (HTTPS — no SMTP needed, Railway-compatible).

Message sections: Published (✅) / Needs Review (⚠️) / Blocked (🚫) / New companies — not in landscape (🆕) / Thought Leadership candidates (📚) / Errors (❌)

Review links use HMAC-SHA256 token signing (`REVIEW_SECRET`) — one-tap approve/reject from Telegram.

### `scheduler.js` — Daily Pipeline Orchestration

Runs at 5am Europe/London:
1. `autoDiscover()` → find new candidates (intelCandidates + tlCandidates + knownCompanyIds)
2. Build entity+event dedup map (same company + same type within 14 days → REVIEW with note)
3. For each of top 15 candidates:
   - **Step 1:** `processUrl()` → structured entry
   - **Step 1b:** `enrichContext()` → regenerate the_so_what with landscape context (non-fatal)
   - **Step 2:** `validateFormat()` → 9 schema rules (non-fatal, annotates `_format_errors`)
   - **Step 2b:** `verify()` → governance claim check (12k window)
   - **Step 2c:** `checkFabrication()` → dedicated fabrication pass (12k window)
     - Fabrication FAIL → **HARD BLOCK** regardless of governance verdict
4. `scoreEntry()` → 4-dimension scoring
5. **ROUTING (Universal Inbox — nothing auto-publishes):**
   - Score ≥ 75 → `addPending(entry, govAudit, { score, score_breakdown, fabrication_verdict, format_errors, enrichment })` → INBOX (high confidence)
   - Score 45–74 → `addPending(...)` → INBOX (REVIEW)
   - Score < 45 or fabricated → `addBlocked()` → permanently blocked
6. New company detection: entry.company not in knownCompanyIds → flagged in digest
7. `writePipelineStatus()` → `.pipeline-status.json`
8. `sendDigest()` → Telegram (trigger-only: "N stories need review → [link to studio]")

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

### `scripts/run-tests.js` — Unit Test Agent

Scenario-based test suite for all pipeline logic. No live API calls — all external dependencies mocked.

**39 tests across 5 suites:**
1. **scorer.js** (27 tests) — source quality tiers (including newsroom STRONG vs WEAK), claim verification, freshness buckets (including hard 90-day gate), capability impact scoring, routing thresholds
2. **notifier.js** (5 tests) — HMAC token signing for review links
3. **publisher.js** (6 tests) — file writing with unique run-ID prefixed IDs + cleanup
4. **auto-discover.js pure functions** (15 tests) — `isRelevant`, `normalizeUrl`, `buildCompanyQueries`, `buildAuthorQueries`
5. **scheduler routing** (9 tests) — threshold boundary testing inline

Run: `node --env-file=.env scripts/run-tests.js`

---

## API Endpoints (Intake Server)

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auto-discover` | Parallel L1 News + L1 Caps + L2 Companies discovery |
| POST | `/api/search` | Jina web search |
| POST | `/api/process-url` | Fetch + structure + governance for one URL → queues to inbox |
| POST | `/api/publish` | Write entry JSON + git commit + push (called by approve-and-publish) |
| GET | `/api/pending` | Legacy: list pending entries (use `/api/inbox` instead) |
| POST | `/api/pending/:id/approve` | Legacy approve (use `/api/inbox/:id/approve-and-publish` instead) |
| POST | `/api/pending/:id/reject` | Legacy reject (use `/api/inbox/:id/reject-with-reason` instead) |
| **GET** | **`/api/inbox`** | **All queued items, REVIEW-first then score desc — Universal Inbox** |
| **POST** | **`/api/inbox/:id/approve-and-publish`** | **SSE stream: approve → publish → git push (rollback on failure)** |
| **POST** | **`/api/inbox/:id/reject-with-reason`** | **Log reason + notes → .rejection-log.json → rejectPending** |
| **GET** | **`/api/pipeline-status`** | **Last pipeline run summary from .pipeline-status.json** |
| **GET** | **`/api/recent-published`** | **Last 7 days of published entries for editorial audit** |
| GET | `/api/blocked` | View all permanently blocked URLs |
| POST | `/api/blocked/unblock` | Remove URL from blocked list and reprocess through full pipeline (fetch → governance → score → inbox). Re-blocks if governance fails again. |
| GET | `/api/health` | Server health + queue counts |
| GET | `/api/audit` | Run fast audit (SSE stream) |
| GET | `/api/audit/deep` | Run deep audit with Claude (SSE stream) |
| GET | `/api/audit/report` | Fetch last saved audit report |
| POST | `/api/run-pipeline` | Manually trigger daily pipeline |
| POST | `/api/test-digest` | Send sample Telegram digest |
| GET | `/review/:token` | Mobile review page (approve/reject via HMAC token) |
| **POST** | **`/api/v2/produce`** | **SSE stream: full v2 pipeline for a URL (research → write → evaluate → refine)** |
| **GET** | **`/api/v2/briefs`** | **List ready research briefs from KB (status, count, scores)** |
| **GET** | **`/api/v2/kb/stats`** | **KB health: source/brief/decision/event counts** |

---

## Data Model

```
data/
├── intelligence/             ← 43 IntelligenceEntry JSON files (all v2 quality, 2026-04-06)
├── thought-leadership/       ← 8 ThoughtLeadershipEntry JSON files (all URLs verified)
├── competitors/              ← 37 Competitor JSON files (8 segments)
├── capabilities/             ← index.json (7 capability dimensions)
├── logos/                    ← Local SVG/PNG logos (never use external URLs)
├── audit-report.json         ← Latest audit output (auto-generated)
├── .governance-pending.json  ← Universal inbox (ALL stories pre-publish)
├── .governance-blocked.json  ← Permanently blocked URLs
├── .rejection-log.json       ← Editorial rejection records (reason + notes)
└── .pipeline-status.json     ← Last pipeline run summary
```

### Intelligence Entry Schema (key fields)
```json
{
  "id": "slug",
  "type": "market_signal | product_launch | milestone | research",
  "headline": "...",
  "the_so_what": "One sentence — why this matters to a CXO. Business-decision oriented.",
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
8. **Universal Inbox (2026-03-23, updated 2026-03-29)** — Nothing auto-publishes. ALL stories (PASS ≥75 and REVIEW 45–74) queue for human sign-off. Editorial Studio (localhost:3003) is the primary review interface. Pipeline v3 lowered REVIEW threshold from 60→45 so more stories reach the editor.

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
