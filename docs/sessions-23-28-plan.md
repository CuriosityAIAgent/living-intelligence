# Sessions 23-28 Plan — KB Phases 3-5 + Platform Engineering Principles

**Created:** 2026-04-06 (session 22)
**Status:** PLANNED — not yet started

## Overview

KB Phases 1-2 are complete (265 sources, 51 entries, 37 landscape profiles in Supabase). Sessions 23-28 wire the KB into the live pipeline and enforce the 10 platform engineering principles IN CODE — not in memory or skills, which are only 40-80% followed.

**Enforcement hierarchy (from session 22 analysis):**
- Blocking hooks + code architecture = 100% followed
- CLAUDE.md = ~80%
- Memory files = ~60%
- Skills = ~50%
- Advisory hooks = ~40%

Therefore: every principle gets implemented as code architecture or blocking hooks. Not memory.

---

## Session 23: KB Phase 3 — Wire Research Agent + Principle 1 (Store Raw)

**Goal:** Every source fetched by the pipeline is stored in the KB *before* processing.

**Files to modify:**

1. **`intake-server/agents/intake.js`** — After Jina fetch, before Claude structuring:
   ```js
   const sourceId = await storeSource({ url, content_md: rawMarkdown, ... });
   // THEN process with Claude
   ```

2. **`intake-server/agents/research-agent.js`** — Build full research agent:
   - Fetch primary source → `storeSource()` → get UUID
   - Entity extraction (Sonnet, lightweight)
   - Search for 3-5 additional sources → `storeSource()` each
   - Query KB for prior company sources (`getCompanySources()`)
   - Build landscape context from KB (`getLandscapeProfile()`)
   - Persist research brief → `storeBrief()`
   - Return brief with KB IDs (no inline content)

3. **`intake-server/agents/kb-client.js`** — Add:
   - `hydrateBrief(briefId)` — loads source text from KB into brief object
   - `getCompanyContext(companyId)` — returns prior entries + landscape + sources

**Tests:** 3 URLs (wirehouse article, fintech funding, regulatory). Verify sources in Supabase BEFORE entries created.

**Principles enforced:** 1 (store raw, transform later), 2 (start simple)

---

## Session 24: KB Phase 4 — Pipeline Integration + Principle 8 (Observe Everything)

**Goal:** Daily 5am pipeline stores everything to KB. Every agent logs events.

**Files to modify:**

1. **`intake-server/agents/scheduler.js`** — For ENRICH candidates:
   - Call `research()` instead of raw `processUrl()`
   - Log pipeline run via `logPipelineRun()`
   - Fallback: if KB unavailable, use v1 path

2. **`intake-server/agents/kb-client.js`** — Add:
   ```js
   export async function logPipelineEvent({
     run_id, agent, entry_id, prompt_version, model,
     tokens_in, tokens_out, latency_ms, score, error
   })
   ```

3. **Every agent** (writer, evaluator, fabrication, scorer, intake):
   ```js
   const start = Date.now();
   // ... agent work ...
   await logPipelineEvent({ run_id, agent: 'writer', latency_ms: Date.now() - start, tokens_in, tokens_out });
   ```

4. **New DDL** (run in Supabase SQL Editor):
   ```sql
   CREATE TABLE pipeline_events (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     run_id UUID REFERENCES pipeline_runs(id),
     agent TEXT NOT NULL,
     entry_id TEXT,
     prompt_version TEXT,
     model TEXT,
     tokens_in INTEGER,
     tokens_out INTEGER,
     latency_ms INTEGER,
     score JSONB,
     error TEXT,
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```

**Principles enforced:** 8 (observe everything, alert on what matters)

---

## Session 25: KB Phase 5 — Editorial Capture + Principle 9 (Overrides = Training Data)

**Goal:** Every approve/reject in Editorial Studio logs full context to KB.

**Files to modify:**

1. **`intake-server/server.js`** — `approve-and-publish` route:
   ```js
   await logDecision({
     entry_id,
     decision: 'approve',
     draft_snapshot: { headline, summary, the_so_what, key_stat },
     evaluator_score: item.evaluator_result,
     pipeline_score: item.score,
     company_id: item.company_slug,
     editor_notes: req.body.notes || null
   });
   ```

2. **`intake-server/server.js`** — `reject-with-reason` route:
   ```js
   await logDecision({
     entry_id,
     decision: 'reject',
     reason: req.body.reason,
     draft_snapshot: { headline, summary, the_so_what, key_stat },
     pipeline_score: item.score,
     company_id: item.company_slug
   });
   ```

3. **Editorial Studio UI** (`intake-server/client/`):
   - Optional "editor notes" text field on approve
   - Required "reason" on reject

**Principles enforced:** 9 (editorial overrides = training data), 5 (human-in-the-loop is a feature)

---

## Session 26: Principle 3 (Version Prompts) + Principle 7 (Idempotent Pipelines)

**Goal:** Prompts are versioned files. Pipelines are safely re-runnable.

**Prompt versioning:**

1. **Create `intake-server/prompts/`** directory:
   - `writer-v1.md` — current writer persona prompt
   - `evaluator-v1.md` — current 6-check McKinsey test
   - `fabrication-v1.md` — current fabrication checker
   - `entity-extraction-v1.md` — new Sonnet entity prompt

2. **Modify each agent** to load from file:
   ```js
   import { readFileSync } from 'fs';
   const PROMPT_VERSION = 'writer-v1';
   const systemPrompt = readFileSync(`./prompts/${PROMPT_VERSION}.md`, 'utf8');
   ```
   Every pipeline event logs `prompt_version`.

**Idempotency:**

3. **sources table:** Add `content_hash` column (md5 of content_md) — detect if content changed on re-fetch
4. **publisher.js:** Check `published_entries` by id before inserting (prevent double-publish)
5. **Verification:** Run backfill-kb-v2.js again — should complete with 0 new inserts

**Principles enforced:** 3 (version prompts like code), 7 (build idempotent pipelines)

---

## Session 27: Vector Embeddings + Semantic Search

**Goal:** All ~350 content items have embeddings. Semantic search works.

1. **`intake-server/scripts/generate-embeddings.js`** — Batch script:
   - Query all rows where `embedding IS NULL`
   - Call Jina embeddings-v3 API (512 dims) for each
   - Rate limit: 100 RPM
   - ~350 items × $0.0001 = ~$0.04

2. **`intake-server/agents/kb-client.js`** — Add:
   ```js
   export async function searchSimilar(text, opts = {}) {
     const embedding = await getJinaEmbedding(text);
     return supabase.rpc('match_content', { query_embedding: embedding, ...opts });
   }
   ```

3. **Wire into research-agent.js** — Pull semantically similar sources from KB during research.

**Verification:** `searchSimilar("BofA AI meeting journey")` returns relevant BofA sources + entries.

**Principles enforced:** 6 (pgvector in Supabase is right), 10 (design for next vertical — embeddings work cross-vertical)

---

## Session 28: Content Producer CLI + End-to-End Test

**Goal:** Full pipeline from CLI, all 10 principles enforced in one run.

1. **Build `intake-server/agents/content-producer.js`:**
   - `research()` → brief with KB IDs
   - `hydrateBrief()` → loads source text
   - Write → Evaluate → Refine loop (max 2 iterations)
   - Fabrication check against raw KB sources
   - Score → editorial inbox
   - Log pipeline run + events + decision

2. **CLI interface:**
   ```
   node content-producer.js --url <url>       # full pipeline
   node content-producer.js --brief <uuid>    # resume from brief
   node content-producer.js --top 5           # produce top 5 ready briefs
   node content-producer.js --status          # show brief statuses
   ```

3. **`intake-server/server.js`** — Add API routes:
   - `POST /api/v2/produce` → calls `produceEntry()`
   - `GET /api/v2/briefs` → returns ready briefs
   - `GET /api/v2/kb/stats` → source/brief/decision counts

**Verification:** Run on 3 fresh URLs. Each produces entry in inbox with:
- Sources stored in KB before processing (Principle 1)
- Pipeline events logged for every agent (Principle 8)
- Prompt versions tracked (Principle 3)
- Idempotent on re-run (Principle 7)
- Editorial decision captured on approve/reject (Principle 9)

---

## Summary Table

| Session | What | Principles |
|---------|------|-----------|
| 23 | Research agent + store-before-process | 1, 2 |
| 24 | Pipeline integration + event logging | 8 |
| 25 | Editorial decision capture | 5, 9 |
| 26 | Prompt versioning + idempotency | 3, 7 |
| 27 | Vector embeddings + semantic search | 6, 10 |
| 28 | Content producer CLI + E2E test | All 10 |

Each session is independently valuable. The principles compound — by session 28, every fetch is stored, every agent is observed, every prompt is versioned, every editorial decision is captured, and the whole thing is idempotent and semantically searchable.
