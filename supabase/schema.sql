-- Living Intelligence — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run)
-- Creates: 2 auth tables + 8 KB tables + 4 engagement tables + indexes + RLS + functions

-- ═══ EXTENSIONS ═══════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══ AUTH TABLES ══════════════════════════════════════════════════

CREATE TABLE organizations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT,
  stripe_customer_id  TEXT UNIQUE,
  tier                TEXT DEFAULT 'standard',
  max_seats           INTEGER DEFAULT 5,
  status              TEXT DEFAULT 'active',
  usage_stats         JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT,
  company     TEXT,
  org_id      UUID REFERENCES organizations(id),
  role        TEXT DEFAULT 'member',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ═══ VERTICALS ═══════════════════════════════════════════════════
CREATE TABLE verticals (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO verticals (id, label) VALUES ('wealth', 'AI in Wealth Management');

-- ═══ COMPANIES ═══════════════════════════════════════════════════
CREATE TABLE companies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  domain      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE company_verticals (
  company_id  TEXT REFERENCES companies(id),
  vertical_id TEXT REFERENCES verticals(id),
  segment     TEXT NOT NULL,
  PRIMARY KEY (company_id, vertical_id)
);

-- ═══ SOURCES ═════════════════════════════════════════════════════
CREATE TABLE sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url             TEXT NOT NULL,
  url_hash        TEXT GENERATED ALWAYS AS (md5(url)) STORED,
  title           TEXT,
  source_name     TEXT,
  source_type     TEXT DEFAULT 'article',
  content_md      TEXT NOT NULL,
  word_count      INTEGER,
  published_at    TIMESTAMPTZ,
  fetched_at      TIMESTAMPTZ DEFAULT now(),
  fetched_by      TEXT DEFAULT 'pipeline',
  company_id      TEXT REFERENCES companies(id),
  vertical_id     TEXT REFERENCES verticals(id),
  topics          TEXT[] DEFAULT '{}',
  capability      TEXT,
  domain_rank     INTEGER,
  is_paywalled    BOOLEAN DEFAULT false,
  is_thin         BOOLEAN DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  embedding       vector(512),
  UNIQUE (url_hash)
);

CREATE INDEX idx_sources_company ON sources (company_id);
CREATE INDEX idx_sources_vertical ON sources (vertical_id);
CREATE INDEX idx_sources_fetched ON sources (fetched_at DESC);
CREATE INDEX idx_sources_topics ON sources USING GIN (topics);

-- ═══ PUBLISHED ENTRIES ═══════════════════════════════════════════
CREATE TABLE published_entries (
  id                    TEXT PRIMARY KEY,
  entry_type            TEXT DEFAULT 'intelligence',
  company_id            TEXT REFERENCES companies(id),
  vertical_id           TEXT REFERENCES verticals(id) DEFAULT 'wealth',
  headline              TEXT NOT NULL,
  summary               TEXT,
  the_so_what           TEXT,
  key_stat              TEXT,
  capability            TEXT,
  source_url            TEXT,
  source_urls           TEXT[] DEFAULT '{}',
  week                  TEXT,
  published_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  supersedes            TEXT,
  related_landscape_ids TEXT[] DEFAULT '{}',
  tags                  TEXT[] DEFAULT '{}',
  search_vector         tsvector,
  embedding             vector(512)
);

CREATE INDEX idx_entries_company ON published_entries (company_id);
CREATE INDEX idx_entries_vertical ON published_entries (vertical_id);
CREATE INDEX idx_entries_published ON published_entries (published_at DESC);
CREATE INDEX idx_entries_search ON published_entries USING GIN (search_vector);

-- Auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION update_entry_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.headline, '') || ' ' ||
    coalesce(NEW.summary, '') || ' ' ||
    coalesce(NEW.the_so_what, '') || ' ' ||
    coalesce(NEW.key_stat, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entry_search_vector
  BEFORE INSERT OR UPDATE ON published_entries
  FOR EACH ROW EXECUTE FUNCTION update_entry_search_vector();

-- ═══ LANDSCAPE PROFILES ═════════════════════════════════════════
CREATE TABLE landscape_profiles (
  id                  TEXT PRIMARY KEY,
  company_id          TEXT REFERENCES companies(id),
  vertical_id         TEXT REFERENCES verticals(id) DEFAULT 'wealth',
  segment             TEXT,
  ai_strategy_summary TEXT,
  headline_metric     TEXT,
  headline_initiative TEXT,
  overall_maturity    TEXT,
  capabilities        JSONB,
  evidence_entry_ids  TEXT[] DEFAULT '{}',
  last_updated        TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ,
  embedding           vector(512)
);

-- ═══ RESEARCH BRIEFS ════════════════════════════════════════════
CREATE TABLE research_briefs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_url           TEXT NOT NULL,
  company_id              TEXT REFERENCES companies(id),
  vertical_id             TEXT REFERENCES verticals(id) DEFAULT 'wealth',
  entities                JSONB NOT NULL,
  primary_source_id       UUID REFERENCES sources(id),
  additional_source_ids   UUID[] DEFAULT '{}',
  landscape_snapshot      JSONB,
  whats_new               TEXT,
  source_count            INTEGER DEFAULT 1,
  total_word_count        INTEGER,
  triage_score            INTEGER,
  status                  TEXT DEFAULT 'ready',
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  published_entry_id      TEXT REFERENCES published_entries(id)
);

CREATE INDEX idx_briefs_status ON research_briefs (status);
CREATE INDEX idx_briefs_company ON research_briefs (company_id);
CREATE INDEX idx_briefs_created ON research_briefs (created_at DESC);

-- ═══ EDITORIAL DECISIONS ════════════════════════════════════════
CREATE TABLE editorial_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        TEXT,
  brief_id        UUID REFERENCES research_briefs(id),
  vertical_id     TEXT REFERENCES verticals(id) DEFAULT 'wealth',
  company_id      TEXT REFERENCES companies(id),
  decision        TEXT NOT NULL,
  reason          TEXT,
  editor_notes    TEXT,
  draft_snapshot  JSONB,
  evaluator_score JSONB,
  pipeline_score  INTEGER,
  capability      TEXT,
  entry_type      TEXT,
  decided_at      TIMESTAMPTZ DEFAULT now(),
  decided_by      TEXT DEFAULT 'haresh'
);

CREATE INDEX idx_decisions_decision ON editorial_decisions (decision);
CREATE INDEX idx_decisions_company ON editorial_decisions (company_id);

-- ═══ PIPELINE RUNS ══════════════════════════════════════════════
CREATE TABLE pipeline_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id         TEXT REFERENCES verticals(id) DEFAULT 'wealth',
  tier                TEXT NOT NULL,
  started_at          TIMESTAMPTZ DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  candidates_found    INTEGER DEFAULT 0,
  sources_stored      INTEGER DEFAULT 0,
  briefs_created      INTEGER DEFAULT 0,
  entries_produced    INTEGER DEFAULT 0,
  errors              JSONB DEFAULT '[]'
);

-- ═══ ENGAGEMENT TABLES ══════════════════════════════════════════

CREATE TABLE user_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID REFERENCES organizations(id),
  action      TEXT NOT NULL,
  entry_id    TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_user ON user_activity (user_id);
CREATE INDEX idx_activity_org ON user_activity (org_id);
CREATE INDEX idx_activity_created ON user_activity (created_at DESC);

CREATE TABLE user_watchlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID REFERENCES organizations(id),
  watch_type  TEXT NOT NULL,
  watch_id    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, watch_type, watch_id)
);

CREATE TABLE entry_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  snapshot    JSONB NOT NULL,
  changed_by  TEXT DEFAULT 'pipeline',
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_versions_entry ON entry_versions (entry_id);

CREATE TABLE source_domains (
  domain          TEXT PRIMARY KEY,
  total_fetched   INTEGER DEFAULT 0,
  pass_count      INTEGER DEFAULT 0,
  fail_count      INTEGER DEFAULT 0,
  avg_quality     FLOAT DEFAULT 0,
  last_fetched    TIMESTAMPTZ DEFAULT now()
);

-- ═══ ROW LEVEL SECURITY ═════════════════════════════════════════

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Service role can manage all profiles (for webhooks)
CREATE POLICY "Service role manages profiles"
  ON user_profiles FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read their org
CREATE POLICY "Users can read own org"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

-- Service role can manage all orgs
CREATE POLICY "Service role manages orgs"
  ON organizations FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read/write their own activity
CREATE POLICY "Users can read own activity"
  ON user_activity FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own activity"
  ON user_activity FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can manage their own watchlist
CREATE POLICY "Users can manage own watchlist"
  ON user_watchlist FOR ALL
  USING (user_id = auth.uid());

-- ═══ TEAM INVITE FUNCTION ════════════════════════════════════════

-- Pending invites table — stores email→org mapping before user signs up
CREATE TABLE pending_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  org_id      UUID REFERENCES organizations(id) NOT NULL,
  invited_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (email, org_id)
);

CREATE OR REPLACE FUNCTION invite_team_member(p_email text, p_org_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Check seat limit
  IF (SELECT count(*) FROM user_profiles WHERE org_id = p_org_id) >=
     (SELECT max_seats FROM organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'Organization has reached its seat limit';
  END IF;

  -- Insert pending invite (ignore if already invited)
  INSERT INTO pending_invites (email, org_id, invited_by)
  VALUES (p_email, p_org_id, auth.uid())
  ON CONFLICT (email, org_id) DO NOTHING;
END;
$$;

-- Auto-link user to org on first sign-in if they have a pending invite
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
  v_email text;
BEGIN
  v_email := NEW.email;

  -- Check for pending invite
  SELECT org_id INTO v_org_id
  FROM pending_invites
  WHERE email = v_email
  LIMIT 1;

  -- Create user profile
  INSERT INTO user_profiles (id, email, full_name, org_id, role)
  VALUES (
    NEW.id,
    v_email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    v_org_id,
    CASE WHEN v_org_id IS NOT NULL THEN 'member' ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    org_id = COALESCE(user_profiles.org_id, EXCLUDED.org_id);

  -- Clean up pending invite
  IF v_org_id IS NOT NULL THEN
    DELETE FROM pending_invites WHERE email = v_email AND org_id = v_org_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: auto-create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ═══ VECTOR SEARCH FUNCTION ═════════════════════════════════════

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
