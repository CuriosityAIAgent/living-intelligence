-- Migration: Brief Lifecycle for v2 Automated Pipeline
-- Run in Supabase SQL Editor
-- Date: 2026-04-13 (Session 34)

-- 1. Add v2 pipeline output columns to research_briefs
ALTER TABLE research_briefs
  ADD COLUMN IF NOT EXISTS v2_entry     jsonb       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS v2_score     integer     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS v2_fabrication_verdict text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS v2_evaluation jsonb      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS decision     text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS decision_reason text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS decided_by   text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS decided_at   timestamptz DEFAULT NULL;

-- 2. Add check constraint for valid status values
-- (status column already exists with 'ready'/'processing' values)
-- Extend with new lifecycle states
COMMENT ON COLUMN research_briefs.status IS 'Lifecycle: ready → processing → produced | held | duplicate | development';

-- 3. Add check constraint for decision values
ALTER TABLE research_briefs
  ADD CONSTRAINT chk_brief_decision
  CHECK (decision IS NULL OR decision IN (
    'APPROVED', 'REJECTED', 'HELD', 'RETRY',
    'PRODUCED', 'DUPLICATE', 'ENRICHED'
  ));

-- 4. Add index for querying by status (inbox, held views)
CREATE INDEX IF NOT EXISTS idx_briefs_status_created
  ON research_briefs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_briefs_decision
  ON research_briefs (decision)
  WHERE decision IS NOT NULL;

-- 5. Add decision column to editorial_decisions if not exists
-- (table already has: entry_id, brief_id, decision, reason, editor_notes,
--  draft_snapshot, evaluator_score, pipeline_score, company_id, capability,
--  entry_type, vertical_id, decided_by, decided_at)
-- Ensure decision values match our new taxonomy
ALTER TABLE editorial_decisions
  DROP CONSTRAINT IF EXISTS chk_editorial_decision;

ALTER TABLE editorial_decisions
  ADD CONSTRAINT chk_editorial_decision
  CHECK (decision IN (
    'APPROVED', 'REJECTED', 'HELD', 'RETRY',
    'PRODUCED', 'DUPLICATE', 'ENRICHED',
    'PASS', 'REVIEW', 'FAIL',
    'approve', 'reject', 'held', 'retry',
    'produced', 'duplicate', 'enriched'
  ));

-- 6. Add similarity_match column for dedup tracking
ALTER TABLE research_briefs
  ADD COLUMN IF NOT EXISTS similarity_match jsonb DEFAULT NULL;
  -- stores: { matched_entry_id, similarity_score, match_type: 'duplicate'|'development' }

-- 7. Create view for Editorial Studio inbox
CREATE OR REPLACE VIEW v_editorial_inbox AS
SELECT
  rb.id AS brief_id,
  rb.candidate_url,
  rb.company_id,
  rb.entities,
  rb.triage_score,
  rb.v2_score,
  rb.v2_fabrication_verdict,
  rb.v2_evaluation,
  rb.v2_entry,
  rb.status,
  rb.decision,
  rb.source_count,
  rb.created_at AS discovered_at,
  rb.processed_at,
  rb.decided_at,
  rb.decided_by,
  rb.decision_reason,
  rb.similarity_match
FROM research_briefs rb
WHERE rb.status IN ('produced', 'held')
ORDER BY rb.processed_at DESC NULLS LAST;

-- 8. Create view for decision history
CREATE OR REPLACE VIEW v_decision_history AS
SELECT
  ed.id,
  ed.entry_id,
  ed.brief_id,
  ed.decision,
  ed.reason,
  ed.editor_notes,
  ed.evaluator_score,
  ed.pipeline_score,
  ed.company_id,
  ed.capability,
  ed.entry_type,
  ed.decided_by,
  ed.decided_at,
  rb.candidate_url,
  rb.entities,
  rb.v2_score,
  rb.v2_fabrication_verdict
FROM editorial_decisions ed
LEFT JOIN research_briefs rb ON rb.id = ed.brief_id
ORDER BY ed.decided_at DESC;
