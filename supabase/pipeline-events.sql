-- Pipeline Events table — per-agent observability (Principle 8)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS pipeline_events (
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

CREATE INDEX idx_pipeline_events_run ON pipeline_events (run_id);
CREATE INDEX idx_pipeline_events_agent ON pipeline_events (agent);
CREATE INDEX idx_pipeline_events_created ON pipeline_events (created_at DESC);
