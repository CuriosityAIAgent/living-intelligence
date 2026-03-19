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
                    ├──► scored candidates
intake.js  ─────────┤
                    ├──► structured entry
governance.js  ─────┤
                    ├──► PASS / REVIEW / FAIL
gov-store.js  ──────┤
                    ├──► pending queue / blocked list
publisher.js  ──────┤
                    ├──► JSON file + git commit + push
notifier.js  ───────┤
                    └──► Telegram digest
scheduler.js  ──────── orchestrates daily pipeline
auditor.js  ────────── standalone audit engine (fast + deep modes)
```

### `auto-discover.js` — Content Discovery

Runs three sources **in parallel** via `Promise.allSettled`:

1. **RSS (11 feeds):** FT, Bloomberg, Reuters, WSJ, Fintech Nexus, WealthManagement.com, ThinkAdvisor, InvestmentNews, RIABiz, Advisor Perspectives, Wealthtechtoday
2. **Jina Search (7 queries):** `s.jina.ai` — searches for AI wealth management news
3. **DataForSEO News (5 queries):** Google News results via DataForSEO API

Deduplicates against all existing `source_url` fields in `data/intelligence/`.

Scores each candidate:
- +10 recency (last 72h), +5 (last week), +2 (older)
- +4–6 source quality (primary outlet vs tier-1)
- +2 per tracked company mention (Goldman, JPM, UBS, etc.)
- +1 per AI keyword
- +3 DataForSEO / +2 Jina source bonus

Returns top 20 candidates with `via` badge (RSS/Jina/DFS).

### `intake.js` — Article Fetch + Structuring

1. Fetches article via `r.jina.ai` (cleans HTML → markdown)
2. **Paywall fallback:** If paywall detected → search for open-source alternatives → fetch up to 2 alternatives → combine content
3. Calls **Claude `claude-sonnet-4-6`** (SSE streaming) with strict grounding prompt → structured `IntelligenceEntry` JSON
4. No inference allowed — Claude only extracts what is in the source

### `governance.js` — Claim Verification

Second Claude call (separate from structuring) verifies every claim in the generated entry against the source article.

Verdict rules:
- **PASS** → all claims verified, `source_verified: true`
- **REVIEW** → 1-2 unverified claims (implied, not fabricated) → held for human approval
- **FAIL** → any claim contradicts source or appears fabricated → URL permanently blocked

Returns: `{ verdict, confidence, verified_claims, unverified_claims, fabricated_claims, notes, paywall_caveat }`

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
├── intelligence/       ← ~35 IntelligenceEntry JSON files
├── thought-leadership/ ← 7 ThoughtLeadershipEntry JSON files (all URLs verified)
├── competitors/        ← 26 Competitor JSON files (7 segments)
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
| Jina AI `s.jina.ai` | Web search + extract | `JINA_API_KEY` |
| DataForSEO | Google News + Google Images | Login + password |
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
