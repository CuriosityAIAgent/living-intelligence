-- Content hash column on sources — Principle 7 (idempotent pipelines)
-- Detects when re-fetched content has actually changed vs unchanged.
-- Run this in Supabase SQL Editor.

ALTER TABLE sources ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Backfill existing rows
UPDATE sources SET content_hash = md5(content_md) WHERE content_hash IS NULL AND content_md IS NOT NULL;

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_sources_content_hash ON sources (content_hash);
