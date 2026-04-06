# Knowledge Base + V2 Pipeline Architecture — Living Intelligence

## Context

The platform has 43 intelligence entries, 37 landscape profiles, and 8 TL entries — all at consulting quality after the session 19 audit. But the intake pipeline still runs v1: single-source fetch, discard raw text after structuring, no institutional memory. Every research session starts from zero.

**The core problem:** When we fetch a 15KB article via Jina Reader, that raw text is used once for structuring, then lost forever. Only the summary and source URLs survive. This means:
1. Future sessions about the same company can't reference prior research
2. The writer-agent can't build on accumulated knowledge
3. Cross-company competitive context must be manually gathered each time
4. When AI in Banking launches, nothing carries over from wealth management

**What we're building:** A persistent knowledge base (Supabase/PostgreSQL + pgvector) that stores every raw source, enables semantic search across all research, and powers the v2 content pipeline end-to-end. This is what makes the intelligence "living."

**STATUS (Session 21, 2026-04-05):** Phase 1 COMPLETE — Supabase project created (Pro, Micro, Europe). Full 14-table DDL executed (auth + KB + engagement). Auth files built + Google OAuth tested. Pending: backfill KB tables, build kb-client.js, wire research-agent to KB, deploy to production.

---

## Architecture Overview

```
                    KNOWLEDGE BASE (Supabase — PostgreSQL + pgvector)
                    ┌─────────────────────────────────────────────┐
                    │  sources        — raw markdown + embeddings  │
                    │  research_briefs — structured research output │
                    │  editorial_decisions — approve/reject log     │
                    │  companies      — cross-vertical entities     │
                    │  pipeline_runs  — audit trail                 │
                    └──────────┬──────────────┬───────────────────┘
                               │              │
              Tier 1 writes ───┘              └─── Tier 2 reads + writes
              (5am, automated)                    (CLI, on-demand)
```

```
TIER 1 — Automated (5:00am, Railway Node.js server)
  scheduler.js triggers auto-discover.js (existing)
  → candidates scored + deduped (existing)
  → NEW: research-agent.js fetches primary + 3-5 additional sources
  → NEW: stores ALL raw markdown in KB (sources table)
  → NEW: entity extraction (Sonnet, lightweight)
  → NEW: saves structured research brief to KB (research_briefs table)
  → triage score determines: BLOCK / REVIEW / ENRICH

TIER 2 — On-Demand (CLI, Claude Code Max context)
  Haresh runs: node content-producer.js --top 5
  → loads research briefs from KB (status = 'ready')
  → hydrates briefs (pulls raw source text from KB)
  → writer-agent (Opus, 1M context, full source text)
  → evaluator-agent (6-check McKinsey test)
  → if NEEDS_WORK: refine (max 2 iterations)
  → fabrication check (against raw KB sources)
  → final score → editorial inbox
  → Haresh reviews in Editorial Studio → approve/reject logged to KB
```

---

## Database Schema (Supabase — PostgreSQL + pgvector)

### Why Supabase
- Already planned for subscription auth (Stripe + Supabase Auth) — one service, not two
- PostgreSQL + pgvector = structured data + vector search
- Cloud-hosted — accessible from Railway (automated) and local CLI (manual)
- Pro tier: $25/month for 8GB database, 100GB bandwidth — sufficient for years

### Tables

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══ VERTICALS ═══════════════════════════════════════════════════════
CREATE TABLE verticals (
  id          TEXT PRIMARY KEY,              -- 'wealth', 'banking', 'insurance'
  label       TEXT NOT NULL,                 -- 'AI in Wealth Management'
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ═══ COMPANIES (shared across verticals) ═════════════════════════════
CREATE TABLE companies (
  id          TEXT PRIMARY KEY,              -- matches competitor JSON id: 'morgan-stanley'
  name        TEXT NOT NULL,
  domain      TEXT,                          -- 'morganstanley.com'
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE company_verticals (
  company_id  TEXT REFERENCES companies(id),
  vertical_id TEXT REFERENCES verticals(id),
  segment     TEXT NOT NULL,                 -- 'wirehouse', 'global_private_bank' etc.
  PRIMARY KEY (company_id, vertical_id)
);

-- ═══ SOURCES (the KB core — every raw document ever fetched) ═════════
CREATE TABLE sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url             TEXT NOT NULL,
  url_hash        TEXT GENERATED ALWAYS AS (md5(url)) STORED,
  title           TEXT,
  source_name     TEXT,                      -- 'Business Wire', 'RIABiz'
  source_type     TEXT DEFAULT 'article',    -- 'press_release','report','transcript','blog','filing'
  
  -- THE RAW CONTENT — this is what we're preserving
  content_md      TEXT NOT NULL,             -- full Jina markdown
  word_count      INTEGER,
  
  -- When
  published_at    TIMESTAMPTZ,               -- article publication date
  fetched_at      TIMESTAMPTZ DEFAULT now(),
  fetched_by      TEXT DEFAULT 'pipeline',   -- 'pipeline','research-agent','manual','backfill'
  
  -- Classification
  company_id      TEXT REFERENCES companies(id),
  vertical_id     TEXT REFERENCES verticals(id),
  topics          TEXT[] DEFAULT '{}',
  capability      TEXT,                      -- 'advisor_productivity' etc.
  
  -- Quality
  domain_rank     INTEGER,
  is_paywalled    BOOLEAN DEFAULT false,
  is_thin         BOOLEAN DEFAULT false,
  
  -- Vector embedding (Jina embeddings-v3, 512 dims)
  embedding       vector(512),
  
  UNIQUE (url_hash)
);

CREATE INDEX idx_sources_company ON sources (company_id);
CREATE INDEX idx_sources_vertical ON sources (vertical_id);
CREATE INDEX idx_sources_fetched ON sources (fetched_at DESC);
CREATE INDEX idx_sources_topics ON sources USING GIN (topics);
CREATE INDEX idx_sources_embedding ON sources 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ═══ RESEARCH BRIEFS (output of research-agent, input to content-producer) ═
CREATE TABLE research_briefs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_url       TEXT NOT NULL,
  candidate_source    TEXT,
  vertical_id         TEXT REFERENCES verticals(id) DEFAULT 'wealth',
  company_id          TEXT REFERENCES companies(id),
  
  -- Entities extracted by Sonnet
  entities            JSONB NOT NULL,         -- {company_name, company_slug, capability_area,
                                              --  key_topic, event_type, people[], metrics[]}
  
  -- Source references (KB IDs, NOT inline text)
  primary_source_id       UUID REFERENCES sources(id),
  additional_source_ids   UUID[] DEFAULT '{}',
  
  -- Context snapshots (frozen at research time)
  landscape_snapshot      JSONB,              -- {is_tracked, company_summary, past_entries[], peers[]}
  whats_new               TEXT,
  
  -- Quality
  research_confidence     TEXT DEFAULT 'medium',
  source_count            INTEGER DEFAULT 1,
  total_word_count        INTEGER,
  triage_score            INTEGER,            -- initial quick score from Tier 1
  
  -- Status lifecycle
  status          TEXT DEFAULT 'ready',       -- 'ready','in_progress','published','rejected','stale'
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  published_entry_id TEXT                     -- links to data/intelligence/{id}.json when published
);

CREATE INDEX idx_briefs_status ON research_briefs (status);
CREATE INDEX idx_briefs_company ON research_briefs (company_id);
CREATE INDEX idx_briefs_created ON research_briefs (created_at DESC);

-- ═══ EDITORIAL DECISIONS (persona-judge training data) ═══════════════
CREATE TABLE editorial_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        TEXT NOT NULL,              -- intelligence entry id
  brief_id        UUID REFERENCES research_briefs(id),
  vertical_id     TEXT REFERENCES verticals(id) DEFAULT 'wealth',
  
  decision        TEXT NOT NULL,              -- 'approve','reject','edit','pending'
  reason          TEXT,
  editor_notes    TEXT,
  
  -- Snapshot of what was judged
  draft_snapshot  JSONB,                      -- {headline, summary, the_so_what, key_stat}
  evaluator_score JSONB,                      -- from evaluator-agent output
  pipeline_score  INTEGER,
  
  -- Classification (for pattern analysis)
  company_id      TEXT REFERENCES companies(id),
  capability      TEXT,
  entry_type      TEXT,
  
  decided_at      TIMESTAMPTZ DEFAULT now(),
  decided_by      TEXT DEFAULT 'haresh'
);

CREATE INDEX idx_decisions_decision ON editorial_decisions (decision);
CREATE INDEX idx_decisions_company ON editorial_decisions (company_id);

-- ═══ PIPELINE RUNS (audit trail) ═════════════════════════════════════
CREATE TABLE pipeline_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id     TEXT REFERENCES verticals(id) DEFAULT 'wealth',
  tier            TEXT NOT NULL,              -- 'tier1_auto', 'tier2_cli'
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  candidates_found    INTEGER DEFAULT 0,
  sources_stored      INTEGER DEFAULT 0,
  briefs_created      INTEGER DEFAULT 0,
  entries_produced    INTEGER DEFAULT 0,
  errors              JSONB DEFAULT '[]'
);

-- ═══ VECTOR SEARCH FUNCTION ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION match_sources(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 5,
  filter_company_id text DEFAULT NULL,
  filter_vertical_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, url text, title text, source_name text,
  company_id text, topics text[], capability text,
  published_at timestamptz, similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.url, s.title, s.source_name, s.company_id,
         s.topics, s.capability, s.published_at,
         1 - (s.embedding <=> query_embedding) AS similarity
  FROM sources s
  WHERE s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> query_embedding) > match_threshold
    AND (filter_company_id IS NULL OR s.company_id = filter_company_id)
    AND (filter_vertical_id IS NULL OR s.vertical_id = filter_vertical_id)
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## New Files to Create

### 1. `intake-server/agents/kb-client.js` — Supabase singleton + helpers

```
Exports:
  getSupabaseClient()           — singleton, uses SUPABASE_URL + SUPABASE_SERVICE_KEY
  storeSource({url, title, source_name, source_type, content_md, ...})  → UUID
  getSource(id)                 → source row with content_md
  getSourceByUrl(url)           → source row or null (dedup check)
  getCompanySources(company_id, limit=10)  → recent sources for company
  searchSimilar(embedding, opts)  → vector search results
  getJinaEmbedding(text)        → float[512] via Jina API
  storeBrief(brief)             → UUID
  getBrief(id)                  → brief row
  getReadyBriefs(limit=10)     → briefs with status='ready'
  logDecision({entry_id, brief_id, decision, reason, ...})
  logPipelineRun({...})
```

Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
Graceful degradation: all KB calls wrapped in try/catch. If Supabase unreachable, functions return null/empty and log warning. Pipeline falls back to v1.

### 2. `intake-server/agents/research-agent.js` — Deep multi-source research

```
Export:
  research({ url, source_name, vertical, candidate, send })  → researchBrief

Flow:
  1. Fetch primary source via Jina Reader
  2. Store in KB → get primary_source_id
  3. Entity extraction via Sonnet (lightweight, ~300 tokens)
  4. Search for additional sources:
     a. Jina Search: 2 queries (company + topic, company + capability)
     b. DataForSEO News: 1 query (company + AI + topic)
     c. DataForSEO Content Analysis: 1 query (if company is tracked)
  5. Fetch + store each additional source (up to 5)
  6. Query KB: prior sources for same company
  7. Query KB: semantically similar sources (vector search)
  8. Build landscape context (from flat files — existing pattern)
  9. Determine whats_new (Sonnet: compare current sources vs prior coverage summary)
  10. Persist research brief to research_briefs table
  11. Return brief with KB source IDs (no inline content)

The brief returned does NOT contain inline source text — just KB references.
The content-producer hydrates it when the writer needs the text.
This keeps briefs lightweight and the KB as single source of truth.
```

### 3. `intake-server/agents/content-producer.js` — V2 orchestrator

```
Exports:
  produceEntry({ url, source_name, vertical, candidate, send })  → {entry, brief_id, iterations, score}
  produceBatch({ limit, vertical, send })  → results[]

Flow (produceEntry):
  1. research() → brief with KB IDs
  2. hydrateBrief() → loads source text from KB into brief
  3. Loop (max 2 iterations + 1 initial):
     a. write() → draft (Opus)
     b. verify() → fabrication check (against raw KB sources)
     c. evaluate() → 6-check McKinsey test (Opus)
     d. If PASS + not FAIL fabrication → break
     e. If FAIL fabrication → break (stop, don't iterate)
     f. If NEEDS_WORK → continue loop with feedback
  4. scoreEntry() → final score
  5. addPending() → editorial inbox
  6. logDecision() → KB (status: pending)
  7. Return result

Flow (produceBatch):
  1. getReadyBriefs(limit) from KB (or run research first for top N candidates)
  2. For each brief: produceEntry()
  3. Return array of results

CLI entrypoint:
  node content-producer.js --top 5              # produce top 5 ready briefs
  node content-producer.js --url <url>          # research + produce single URL
  node content-producer.js --brief <uuid>       # resume from existing brief
  node content-producer.js --status             # show ready/in-progress briefs
```

### 4. `intake-server/scripts/backfill-kb.js` — Migration script

```
Phase 1: Seed companies table from data/competitors/*.json (37 companies)
Phase 2: Seed verticals table ('wealth')
Phase 3: For each of 43 intelligence entries:
  - Read entry JSON
  - For source_url + each sources[].url:
    - Fetch via Jina Reader (with rate limiting: 1 per 2 seconds)
    - If fetch fails: store entry.summary as content_md with is_thin=true
    - Generate embedding
    - INSERT into sources table
  - Create minimal research_brief record linking to source IDs
Phase 4: Seed editorial_decisions:
  - All published entries → decision='approve'
  - .rejection-log.json entries → decision='reject' with reason

Estimated: ~130 Jina fetches, 15-20 minutes, ~$0.02 in embedding costs
```

---

## Existing Files to Modify

### `intake-server/agents/writer-agent.js`
- Line 25: Change `content.slice(0, 6000)` → `content.slice(0, 12000)` (Opus handles 200K context)
- After line 62 (peer section): Add KB context section noting prior sources were consulted
- No change to function signature — `write()` still takes `{researchBrief, previousDraft, evaluatorFeedback, editorNotes, mode}`

### `intake-server/agents/intake.js`
- After fetching via Jina Reader: call `storeSource()` to persist raw markdown in KB
- This means even v1 pipeline entries start building KB
- Graceful: if KB unavailable, continue without storing

### `intake-server/agents/scheduler.js`
- For ENRICH candidates: call `research()` instead of raw `processUrl()`
- Save research brief to KB
- Tier 2 production deferred to CLI trigger
- Fallback: if KB unavailable, use v1 `processUrl()` path

### `intake-server/server.js`
- Add route: `POST /api/v2/produce` → calls `produceEntry()`
- Add route: `GET /api/v2/briefs` → returns ready briefs from KB
- Add route: `GET /api/v2/kb/stats` → source count, brief count, decision count
- Update `approve-and-publish`: log editorial decision to KB
- Update `reject-with-reason`: log editorial decision to KB

### `intake-server/package.json`
- Add dependency: `@supabase/supabase-js`

---

## Implementation Phases (each independently valuable)

### Phase 1: Foundation (1 session)
- Create Supabase project (Pro tier, $25/month)
- Run all DDL (tables, indexes, RPC function)
- Build `kb-client.js`
- Add `@supabase/supabase-js` to package.json
- Add SUPABASE_URL + SUPABASE_SERVICE_KEY to .env + Railway
- Write + run `backfill-kb.js`
- **Test:** Query KB — "how many sources do we have about Morgan Stanley?"
- **Value:** KB exists with historical data. Can query it even without agent changes.

### Phase 2: Research Agent (1-2 sessions)
- Build `research-agent.js`
- Test on 3 diverse URLs (wirehouse article, advisor tool funding, regulatory news)
- Verify: sources stored in KB, entities extracted, landscape context built, brief persisted
- **Test:** `node research-agent.js --url <url>` produces rich brief
- **Value:** Can run deep research from CLI. KB grows with every research session.

### Phase 3: Content Producer (1-2 sessions)
- Build `content-producer.js`
- Wire in writer-agent + evaluator-agent + fabrication + scoring
- Update writer-agent.js (content limit increase + KB context section)
- CLI interface working
- **Test:** `node content-producer.js --url <url>` → entry in editorial inbox with _research.brief_id
- **Value:** Full Tier 2 pipeline works from CLI. Consulting-quality entries on demand.

### Phase 4: Pipeline Integration (1 session)
- Update scheduler.js: research-agent for ENRICH candidates
- Update intake.js: store raw markdown in KB (even v1 flow)
- Graceful fallback if KB unavailable
- **Test:** Trigger discovery, verify sources stored, briefs created
- **Value:** Daily 5am pipeline builds institutional memory automatically.

### Phase 5: Editorial Decision Capture (1 session)
- Update approve-and-publish + reject-with-reason routes
- Log decisions to KB
- Add optional reason field to reject UI
- **Test:** Approve/reject in Editorial Studio, verify in KB
- **Value:** Persona-judge training data accumulates from day one.

### Phase 6: Multi-Vertical (when Banking launches)
- Schema already supports it — just add vertical row + capability dimensions
- No blocking work needed now

---

## Multi-Vertical Design

**Shared across verticals:**
- `sources` table — a Goldman article about AI is relevant to both wealth and banking
- `companies` table — same entity, different segment per vertical
- Vector embeddings — semantic search works cross-vertical by default
- Pipeline orchestration — same research → write → evaluate → refine loop

**Vertical-specific:**
- Capability dimensions (wealth: 7 existing; banking: credit_decisioning, fraud_detection, etc.)
- Discovery queries (different L1 queries per vertical)
- Writer prompt language (vertical-aware consulting persona)
- Scoring weights (Dim D criteria differ)
- Portal routes (each vertical gets its own pages)

**The bridge:** When research-agent queries KB for a company, it finds sources from ALL verticals. Cross-vertical enrichment is automatic.

---

## Cost Model

| Item | Monthly Cost |
|------|-------------|
| Supabase Pro | $25 |
| Jina embeddings (incremental) | ~$0.50 |
| Sonnet entity extraction | ~$2.00 |
| **Total incremental** | **~$27.50/month** |

Existing Opus/Sonnet costs for writer/evaluator unchanged.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Supabase down → pipeline blocked | `kb-client.js` wraps all calls in try/catch. Falls back to v1 intake.js (no KB). `KB_ENABLED` env flag. |
| Embedding model changes | Store model name in config. Migration script re-embeds all sources (~30 min for 10K docs). |
| URLs 404 during backfill | Store entry summary as fallback content. URL preserved for future re-fetch. |
| KB vs flat JSON out of sync | Portal NEVER reads from KB. Reads flat JSON from git only. KB is pipeline-side only. No sync to break. |
| Vector search noise | Conservative 0.75 threshold. KB context supplements, never replaces live research. |

---

## Verification Plan

After each phase:
1. `node intake-server/scripts/run-tests.js` — all unit tests pass
2. `node intake-server/scripts/smoke-test.js` — all 7 data integrity checks
3. Phase-specific test (documented above per phase)
4. For Phase 3+: run content-producer on 3 test URLs, verify entries in inbox
5. For Phase 4: trigger full pipeline, verify KB populated
6. `npx next build` — portal still builds clean (KB is pipeline-side only)
