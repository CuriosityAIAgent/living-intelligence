# V2 Content Pipeline — Definitive Reference
**April 17, 2026 | Verified against actual codebase**

---

## Architecture Overview

Two-phase split. Phase 1 runs on Railway (API tokens, ~$5/month). Phase 2 runs via Remote Trigger (Claude Opus, Max tokens, $0).

```
Phase 1 — Railway (5:00 AM UK daily)
  Discovery (DataForSEO + NewsAPI + Jina)
  → URL dedup (vs Supabase + published entries)
  → Semantic dedup (Jina embeddings, ≥0.90 cosine = duplicate)
  → Freshness filter (7d news, 30d strategic)
  → Research Agent (Sonnet, entity-based multi-source search)
  → Rich brief stored in Supabase KB (status: ready)

Phase 2 — Remote Trigger (5:27 AM UK daily, Claude Opus, $0)
  Fetch ready briefs from Supabase REST API
  → For each brief:
    → Write v1 (Opus, consulting persona)
    → Fabrication check v1 (Sonnet, multi-source)
    → Evaluate v1 (Opus, McKinsey 6-check test)
    → If PASS → use v1 as final (early exit)
    → If NEEDS_WORK → Write v2 (Opus, with feedback) → Fabrication v2
    → Final scoring (5 dimensions, rule-based)
    → Store result (PATCH Supabase brief → produced or held)

Phase 3 — Editorial Studio (Haresh reviews)
  → Approve → publisher.js → git push main → portal rebuilds
  → Reject → reason logged to editorial_decisions
  → Retry → sent back through Phase 2
```

---

## Brief Lifecycle

```
ready → processing → produced/held/duplicate/development → approved/rejected
```

| Status | Meaning | Where |
|--------|---------|-------|
| `ready` | Research complete, awaiting Phase 2 | Supabase `research_briefs` |
| `processing` | Phase 2 actively writing/evaluating | Supabase |
| `produced` | Score ≥75 + fabrication CLEAN | Editorial Studio inbox |
| `held` | Score <75 OR fabrication SUSPECT/FAIL | Editorial Studio held tab |
| `duplicate` | ≥0.85 cosine + same company + ≤14 days | Logged, not shown |
| `development` | ≥0.70 cosine + same company + new facts | Processed as update |
| `approved` | Haresh approved → published to portal | `data/intelligence/` |
| `rejected` | Haresh rejected with reason | `editorial_decisions` table |

---

## Agent Inventory (Active Only)

### Phase 1 Agents (Railway, API tokens)

| Agent | File | Model | Purpose |
|-------|------|-------|---------|
| Auto-Discover | `auto-discover.js` | None (APIs only) | Multi-layer discovery: L1 News (8 DFS) + L1 Caps (7 DFS) + L2 Companies (37 DFS) + L3 NewsAPI (4 queries) + L1 TL (5 Jina) |
| Research Agent | `research-agent.js` | Sonnet (entity extraction only) | Deep multi-source research: fetch primary, extract entities, search 5-10 sources, load landscape context, detect what's new |
| Scheduler | `scheduler.js` | None (orchestration) | Phase 1 orchestrator: discovery → dedup → freshness → research → Supabase |

### Phase 2 Agents (Remote Trigger or content-producer.js)

| Agent | File | Model | Purpose |
|-------|------|-------|---------|
| Writer Agent | `writer-agent.js` | **Opus** | Consulting-quality entry writer. Refinement mode (previous draft + feedback). 18 anti-AI rules. |
| Evaluator Agent | `evaluator-agent.js` | **Opus** | McKinsey 6-check test: specificity, so-what, source, substance, stat, competitor |
| Fabrication Agent | `fabrication-strict.js` | Sonnet | Multi-source verification. Drift detection (claims added during refinement). Full raw Jina markdown. |
| Scorer | `scorer.js` | None (rule-based) | 5-dimension scoring: Source (0-25), Claims (0-25), Freshness (0-10), Impact (0-40), CXO (0-10) + bonuses |
| Content Producer | `content-producer.js` | None (orchestration) | Phase 2 orchestrator: write → fabrication → evaluate → refine → score. 2 iterations max with early exit. |

### Post-Publish Agents

| Agent | File | Model | Purpose |
|-------|------|-------|---------|
| Publisher | `publisher.js` | None | Write JSON, auto-correct week, auto-resolve logo, git commit + push |
| Landscape Trigger | `landscape-trigger.js` | Sonnet | Check if entry warrants landscape maturity upgrade |
| Notifier | `notifier.js` | None | Telegram digest + email review tokens |

### Tool Agents (On-Demand)

| Agent | File | Model | Purpose |
|-------|------|-------|---------|
| Auditor | `auditor.js` | Sonnet (deep only) | Fast (rule-based) + deep (Claude verification) data quality audit |
| Landscape Sweep | `landscape-sweep.js` | Sonnet | Find stale capabilities (>45 days), search for updates |
| TL Discover | `tl-discover.js` | None | Jina search for thought leadership content |
| TL Publisher | `tl-publisher.js` | Sonnet | Validate + publish TL entries |
| Context Enricher | `context-enricher.js` | Sonnet | Regenerate the_so_what with landscape context |

### Legacy Agents (Files Exist, NOT Imported)

| File | Status | Replaced By |
|------|--------|-------------|
| `intake.js` | Dead (session 41) | `research-agent.js` |
| `governance.js` | Dead (session 41) | `evaluator-agent.js` + `fabrication-strict.js` |
| `discovery.js` | Dead (session 39) | `auto-discover.js` |
| `format-validator.js` | Never wired | — |
| `landscape-producer.js` | Dead | `landscape-trigger.js` |
| `landscape-writer-agent.js` | Dead | Inline in `landscape-trigger.js` |
| `landscape-research-agent.js` | Dead | `landscape-sweep.js` |
| `landscape-evaluator-agent.js` | Dead | Inline in `landscape-trigger.js` |

---

## Prompt Architecture

Prompts are versioned files in `intake-server/prompts/`:

| File | Version | Used By | Purpose |
|------|---------|---------|---------|
| `writer-v1.js` | writer-v1 | writer-agent.js | Consulting persona + 18 anti-AI rules + entry schema |
| `evaluator-v1.js` | evaluator-v1 | evaluator-agent.js | McKinsey 6-check test definition |
| `fabrication-v1.js` | fabrication-v1 | fabrication-strict.js (v1 path) | Single-source verification |
| `fabrication-v2.js` | fabrication-v2 | fabrication-strict.js (v2 path) | Multi-source + drift detection |
| `entity-extraction-v1.js` | entity-v1 | research-agent.js | Company/people/metrics extraction |

**Pattern:** `{name}-v1.js` exports `build()` (returns system prompt string) and `VERSION` (string). Agent imports `build`, calls it, passes result to Claude API.

---

## McKinsey 6-Check Test (Evaluator)

Every entry is rated against these 6 checks:

| # | Check | Pass Criteria |
|---|-------|---------------|
| 1 | Specificity | Headline has specific capability/metric, not generic "AI launch" |
| 2 | So-What | Falsifiable claim that survives removing company name |
| 3 | Source | All key numbers traceable to named source |
| 4 | Substance | Summary adds value beyond headline (not restatement) |
| 5 | Stat | key_stat is decision-grade (specific, sourced, actionable) |
| 6 | Competitor | Connects to at least one peer in landscape |

**Verdict:** PASS (all pass or ≤1 minor fail) / NEEDS_WORK (2+ fail or any critical fail)

---

## Scoring Dimensions (Final Score)

| Dim | Range | What It Measures | Source |
|-----|-------|-----------------|--------|
| A | 0-25 | Source Quality | DataForSEO Backlinks API (live domain authority) or manual tier list |
| B | 0-25 | Claims Verified | From fabrication report. Fabricated = -100 (instant FAIL) |
| C | 0-10 | Freshness | Age in days (newer = higher) |
| D | 0-40 | Capability Impact | Capability present + stage (deployed +12, piloting +7) + key_stat |
| E | 0-10 | CXO Relevance | From evaluator quality score |

**Bonuses:** +5 for ≥3 sources, +3 for ≥2, +3 for primary source

**Thresholds:** PUBLISH ≥75 / REVIEW 45-74 / BLOCK <45

---

## Discovery Layers

| Layer | Source | Queries | Purpose |
|-------|--------|---------|---------|
| L1 News | DataForSEO News | 8 broad | Catch new entrants + unknown companies |
| L1 Caps | DataForSEO News | 7 (from capabilities/index.json) | Capability-specific stories |
| L2 Companies | DataForSEO Content Analysis | 37 (one per landscape company) | Deep per-company coverage |
| L3 NewsAPI | NewsAPI.ai Event Registry | 4 | Trade press (ThinkAdvisor, RIABiz) |
| L1 TL | Jina Search | 5 | Thought leadership discovery |
| L2 Authors | Jina Search | N (per known TL author) | Author-specific TL |

**Scoring:** HN gravity decay (`score^0.8 / (hoursAgo+2)^2.0`), outlet bonuses (+6 primary, +4 tier1), company mention bonuses (+4 each, max +10), semantic dedup (≥0.90 cosine), Jina reranker final ordering.

---

## API Routes (All v2)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v2/briefs-for-processing` | Bearer | List ready briefs (metadata) for Remote Trigger |
| GET | `/api/v2/briefs-for-processing/:id` | Bearer | Single hydrated brief with full source text |
| POST | `/api/v2/store-produced` | Bearer | Store finished entry on brief (from Remote Trigger) |
| POST | `/api/v2/research-enrich` | Bearer | On-demand research mid-writing |
| POST | `/api/v2/produce-batch` | — | SSE stream — run Phase 2 from Editorial Studio |
| GET | `/api/v2/inbox` | — | Produced briefs awaiting editorial |
| GET | `/api/v2/held` | — | Held briefs (low score or suspect) |
| POST | `/api/v2/decide/:briefId` | — | Approve/reject/hold/retry |
| GET | `/api/v2/history` | — | Decision audit trail |

---

## Remote Trigger Configuration

| Setting | Value |
|---------|-------|
| Schedule | 5:27 AM BST (4:27 UTC) daily |
| Model | Claude Opus 4.6 |
| Cost | $0 (Max tokens) |
| Environment | Custom network access (*.supabase.co allowlist) |
| Auth | Bearer token (TRIGGER_SECRET) |

### CRITICAL: Trigger Prompt Verification

The Remote Trigger prompt is stored in Anthropic's Managed Agents system, NOT in this repo. It MUST contain:

1. Fetch ready briefs via Supabase REST API
2. For each brief: hydrate with full source text
3. Write consulting-quality entry (McKinsey voice, peer context)
4. Check fabrication against ALL source texts
5. Evaluate against 6-point McKinsey test
6. **IF NEEDS_WORK → refine with feedback → re-check fabrication** (THE ITERATION LOOP)
7. Compute final score (5 dimensions)
8. Store result via Supabase REST API (status: produced or held)

**Session 38 incident:** The iteration loop (step 6) was MISSING from the trigger prompt because it was written from memory instead of being translated from `content-producer.js`. This was caught during review and fixed.

**Rule (from feedback_trigger_prompt.md):** Before ANY Remote Trigger prompt update, ALWAYS read `content-producer.js` first. Translate code into prompt step-by-step. NEVER write from memory.

---

## Config (Single Source of Truth)

File: `intake-server/agents/config.js`

| Constant | Value | Purpose |
|----------|-------|---------|
| PUBLISH | 75 | Score ≥75 → produced (editorial inbox) |
| REVIEW | 45 | Score 45-74 → held (human review) |
| BLOCK | 45 | Score <45 → blocked |
| FRESHNESS_LIMIT | 90 | Articles >90d old → auto-block |
| STALENESS_DAYS | 45 | Landscape entries >45d → flagged stale |
| MODEL | claude-sonnet-4-6 | Default for scoring/governance |
| CONTENT_DIR | data/ | Repo-relative content path |
| STATE_DIR | process.env.STATE_DIR or CONTENT_DIR | Railway volume or fallback |
