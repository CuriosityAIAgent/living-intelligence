-- Migration: iteration_logs
-- Stores every draft version produced by the v2 content pipeline,
-- including the evaluator score, check results, and full entry snapshot.
-- Run this in the Supabase SQL Editor.

CREATE TABLE iteration_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_id UUID NOT NULL REFERENCES research_briefs(id),
  company_id TEXT NOT NULL,
  version INTEGER NOT NULL,  -- 1, 2, or 3
  quality_score INTEGER,     -- 1-10 from evaluator
  overall TEXT CHECK (overall IN ('PASS', 'NEEDS_WORK')),
  checks JSONB,              -- {specificity: {pass: true}, so_what: {pass: false, feedback: "..."}, ...}
  feedback_summary TEXT,     -- one-line summary of what needed fixing
  entry_snapshot JSONB,      -- full entry JSON at this version
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying all iterations belonging to a brief
CREATE INDEX idx_iteration_logs_brief ON iteration_logs(brief_id);

-- Index for pattern analysis (e.g. which companies or checks fail most)
CREATE INDEX idx_iteration_logs_company ON iteration_logs(company_id);

-- RLS
ALTER TABLE iteration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON iteration_logs FOR ALL USING (true) WITH CHECK (true);

-- Also add v2_iterations column to research_briefs (stores iteration summary on the brief itself)
ALTER TABLE research_briefs ADD COLUMN IF NOT EXISTS v2_iterations JSONB DEFAULT '[]';
