---
name: Knowledge Base Architecture — Supabase + pgvector
description: Persistent KB storing raw sources, published entries, landscape profiles, editorial decisions. Powers v2 pipeline, recommendations, and multi-vertical. Updated session 20 with full relational model.
type: project
---

# Knowledge Base Architecture

**Status:** PHASE 2 COMPLETE (session 22, 2026-04-06). Full KB populated with real content. **265 sources** (264 with full Jina markdown, 609K words), **51 published entries** (43 intelligence + 8 TL), **37 landscape profiles** (119 capabilities, 28 with evidence links), **41 companies**, **91 editorial decisions**. Pending: generate embeddings (vector search), wire research-agent to KB, pipeline integration, editorial decision capture.

## What the KB Stores — The Full Picture

| Layer | What | Why |
|-------|------|-----|
| **Raw sources** | Every article/press release fetched (full markdown + embedding) | Research material — what we read |
| **Published entries** | Final intelligence entries (headline, summary, the_so_what, key_stat) | What we wrote — so future writing builds on context |
| **Landscape profiles** | AI strategy, capability assessments per company | Competitive context — what we know about each firm |
| **Editorial decisions** | Every approve/reject + reasons | Your judgment — trains AI persona |
| **Relationships** | Entry ↔ company ↔ landscape ↔ sources | Everything connected — enables recommendations |

## Relational Model — Everything Connected

```
sources ──────────┐
  (raw articles)   │
                   ├──→ company_id ←──┬── published_entries (what we wrote)
research_briefs ──┘                   │
  (structured research)               ├── landscape_profiles (AI strategy + capabilities)
                                      │
editorial_decisions ──────────────────┘
  (approve/reject + reasons)

Vector embeddings on: sources, published_entries, landscape_profiles
  → semantic similarity across ALL content types
  → "You might also be interested in..." powered by cosine similarity
  → RAG pipeline: writer pulls from full institutional memory
```

**Key relationships:**
- Intelligence entry about BofA Meeting Journey → links to BofA landscape profile
- Landscape upgrade (piloting → deployed) → traces back to the intelligence entry that evidenced it
- Reader on BofA article → recommended: other BofA entries, BofA landscape profile, competitor entries covering similar capabilities
- Writer producing new entry → pulls prior published entries + landscape context + raw sources for same company

## Database Schema (8 tables + auth tables)

### Auth tables (Track A — already designed)
- `organizations` — Stripe customer, max seats, status
- `user_profiles` — auth user, org membership, role

### KB tables (Track B)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Verticals (multi-vertical from day one)
CREATE TABLE verticals (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Companies (shared across verticals)
CREATE TABLE companies (
  id TEXT PRIMARY KEY,           -- matches competitor JSON: 'morgan-stanley'
  name TEXT NOT NULL,
  domain TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE company_verticals (
  company_id TEXT REFERENCES companies(id),
  vertical_id TEXT REFERENCES verticals(id),
  segment TEXT NOT NULL,
  PRIMARY KEY (company_id, vertical_id)
);

-- Sources (raw documents — the research library)
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  url_hash TEXT GENERATED ALWAYS AS (md5(url)) STORED,
  title TEXT,
  source_name TEXT,
  source_type TEXT DEFAULT 'article',
  content_md TEXT NOT NULL,          -- full Jina markdown
  word_count INTEGER,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  fetched_by TEXT DEFAULT 'pipeline',
  company_id TEXT REFERENCES companies(id),
  vertical_id TEXT REFERENCES verticals(id),
  topics TEXT[] DEFAULT '{}',
  capability TEXT,
  domain_rank INTEGER,
  is_paywalled BOOLEAN DEFAULT false,
  is_thin BOOLEAN DEFAULT false,
  embedding vector(512),
  UNIQUE (url_hash)
);

-- Published entries (what we wrote — the magazine)
CREATE TABLE published_entries (
  id TEXT PRIMARY KEY,               -- matches JSON filename slug
  entry_type TEXT DEFAULT 'intelligence',  -- 'intelligence', 'thought_leadership'
  company_id TEXT REFERENCES companies(id),
  vertical_id TEXT REFERENCES verticals(id) DEFAULT 'wealth',
  headline TEXT NOT NULL,
  summary TEXT,
  the_so_what TEXT,
  key_stat TEXT,
  capability TEXT,
  source_url TEXT,
  source_urls TEXT[] DEFAULT '{}',   -- all sources
  week TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  embedding vector(512)              -- for recommendations
);

-- Landscape profiles (competitive context)
CREATE TABLE landscape_profiles (
  id TEXT PRIMARY KEY,               -- matches competitor JSON: 'morgan-stanley'
  company_id TEXT REFERENCES companies(id),
  vertical_id TEXT REFERENCES verticals(id) DEFAULT 'wealth',
  segment TEXT,
  ai_strategy_summary TEXT,
  headline_metric TEXT,
  headline_initiative TEXT,
  overall_maturity TEXT,
  capabilities JSONB,                -- full 7-dimension breakdown
  last_updated TIMESTAMPTZ,
  embedding vector(512)              -- for cross-type recommendations
);

-- Research briefs (research agent output)
CREATE TABLE research_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_url TEXT NOT NULL,
  company_id TEXT REFERENCES companies(id),
  vertical_id TEXT REFERENCES verticals(id) DEFAULT 'wealth',
  entities JSONB NOT NULL,
  primary_source_id UUID REFERENCES sources(id),
  additional_source_ids UUID[] DEFAULT '{}',
  landscape_snapshot JSONB,
  whats_new TEXT,
  source_count INTEGER DEFAULT 1,
  total_word_count INTEGER,
  triage_score INTEGER,
  status TEXT DEFAULT 'ready',
  created_at TIMESTAMPTZ DEFAULT now(),
  published_entry_id TEXT REFERENCES published_entries(id)
);

-- Editorial decisions (persona-judge training data)
CREATE TABLE editorial_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT,
  brief_id UUID REFERENCES research_briefs(id),
  vertical_id TEXT REFERENCES verticals(id) DEFAULT 'wealth',
  company_id TEXT REFERENCES companies(id),
  decision TEXT NOT NULL,            -- 'approve', 'reject', 'edit'
  reason TEXT,
  editor_notes TEXT,
  draft_snapshot JSONB,
  evaluator_score JSONB,
  pipeline_score INTEGER,
  capability TEXT,
  entry_type TEXT,
  decided_at TIMESTAMPTZ DEFAULT now(),
  decided_by TEXT DEFAULT 'haresh'
);

-- Pipeline runs (audit trail)
CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id TEXT REFERENCES verticals(id) DEFAULT 'wealth',
  tier TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  candidates_found INTEGER DEFAULT 0,
  sources_stored INTEGER DEFAULT 0,
  briefs_created INTEGER DEFAULT 0,
  entries_produced INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'
);

-- Vector search function
CREATE OR REPLACE FUNCTION match_content(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 10,
  filter_company_id text DEFAULT NULL,
  content_types text[] DEFAULT '{sources,published_entries,landscape_profiles}'
)
RETURNS TABLE (
  content_type text, content_id text, title text,
  company_id text, capability text, similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  -- Search across ALL content types in one query
  SELECT * FROM (
    SELECT 'source'::text, s.id::text, s.title, s.company_id,
           s.capability, 1 - (s.embedding <=> query_embedding) AS sim
    FROM sources s
    WHERE 'sources' = ANY(content_types) AND s.embedding IS NOT NULL
      AND (filter_company_id IS NULL OR s.company_id = filter_company_id)
    UNION ALL
    SELECT 'entry'::text, e.id, e.headline, e.company_id,
           e.capability, 1 - (e.embedding <=> query_embedding)
    FROM published_entries e
    WHERE 'published_entries' = ANY(content_types) AND e.embedding IS NOT NULL
      AND (filter_company_id IS NULL OR e.company_id = filter_company_id)
    UNION ALL
    SELECT 'landscape'::text, l.id, l.ai_strategy_summary, l.company_id,
           NULL, 1 - (l.embedding <=> query_embedding)
    FROM landscape_profiles l
    WHERE 'landscape_profiles' = ANY(content_types) AND l.embedding IS NOT NULL
      AND (filter_company_id IS NULL OR l.company_id = filter_company_id)
  ) combined
  WHERE sim > match_threshold
  ORDER BY sim DESC
  LIMIT match_count;
END;
$$;
```

## Recommendations — "You might also be interested in"

Since the portal already has a Supabase connection (for auth), it can query the KB for recommendations at zero extra cost.

**On intelligence article pages:**
- Other entries about the same company
- Entries covering the same capability across competitors
- The company's landscape profile
- Semantically similar entries (vector search)

**On landscape profile pages:**
- Intelligence entries that evidenced capability ratings
- Entries about peer companies in the same segment
- Semantically similar landscape profiles

**Implementation:** One Supabase RPC call per page load. Pre-compute and cache if needed.

## Pipeline Integration

**Writer context (when producing new entry):**
```
From KB, pull for this company:
  1. All prior published entries (headlines, the_so_what) — don't repeat
  2. Current landscape profile (strategy, capabilities) — build on it
  3. All raw sources (full text) — ground claims
  4. Editorial decisions (what was approved/rejected and why) — learn preferences
```

**Landscape upgrades:**
- When new intelligence entry evidences a capability change → flag for landscape review
- The entry_id links to the landscape_profile via company_id
- Audit trail: "Advisor Productivity upgraded from Piloting to Deployed based on entry bofa-meeting-journey"

## Backfill Plan

Phase 1: Seed companies (37) + verticals ('wealth')
Phase 2: For each of 43 intelligence entries:
  - Fetch each source URL via Jina → store in `sources`
  - Store the published entry in `published_entries` (headline, summary, the_so_what, etc.)
  - Generate embeddings for both
Phase 3: For each of 37 landscape profiles:
  - Store in `landscape_profiles` (strategy, capabilities, evidence)
  - Generate embedding
Phase 4: Seed editorial_decisions from published (approve) + rejection log (reject)

~130 Jina fetches + 80 embeddings, ~20 minutes, ~$0.05

## Additional Tables (session 20 architecture review)

**user_activity** — page views, searches, downloads. Proves ROI ("your team read 47 articles this quarter"), feeds personalized recommendations, enables usage analytics per org.

**user_watchlist** — companies/capabilities a user follows. Powers "Alert me about BofA" notifications and personalized homepage ("3 new developments in your watchlist").

**entry_versions** — content versioning. We already rewrote all 43 entries once (v2). Tracks what changed, when, why.

**source_domains** — aggregate governance outcomes per domain. Learns which sources are trustworthy over time. Feeds back into scorer.js.

## Additional Fields on Existing Tables

- `deleted_at` (soft delete) on published_entries, landscape_profiles, sources
- `supersedes TEXT` on published_entries — links entry to the one it replaces
- `related_landscape_ids TEXT[]` on published_entries — explicit entry ↔ landscape links
- `tags TEXT[]` on published_entries — flexible tagging (regulatory, M&A, earnings)
- `evidence_entry_ids TEXT[]` on landscape_profiles — which entries support this assessment
- `usage_stats JSONB` on organizations — monthly view counts, active users
- `search_vector tsvector` on published_entries — PostgreSQL full-text search (GIN index)

## Security

- Row-Level Security (RLS) on user_activity, user_watchlist — one org can't see another's data
- Supabase handles this natively

## Total Schema: 14 tables + auth

Auth: organizations, user_profiles
KB: sources, published_entries, landscape_profiles, research_briefs, editorial_decisions, companies, company_verticals, verticals, pipeline_runs
Engagement: user_activity, user_watchlist, entry_versions, source_domains

## Cost

Supabase Pro: $25/month (shared with auth)
Jina embeddings: ~$0.50/month incremental
Sonnet entity extraction: ~$2/month
Total incremental: ~$2.50/month (Supabase already paid for auth)

## Full Plan File

Detailed DDL, agent signatures, implementation phases at:
`/Users/haresh/.claude/plans/scalable-fluttering-cake.md`
