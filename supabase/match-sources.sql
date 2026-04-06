-- Vector search function — Principle 6 (pgvector is the right call)
-- Requires: CREATE EXTENSION IF NOT EXISTS vector; (already done in schema.sql)
-- Run this in Supabase SQL Editor.

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
