/**
 * kb-client.js — Supabase Knowledge Base client
 *
 * Singleton client + helper functions for the KB tables.
 * All functions wrapped in try/catch — if Supabase is unreachable,
 * they return null/empty and log a warning. Pipeline falls back gracefully.
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js';

// ── Singleton ────────────────────────────────────────────────────────────────

let _supabase = null;

export function getSupabaseClient() {
  if (_supabase) return _supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.warn('[kb-client] SUPABASE_URL or SUPABASE_SERVICE_KEY not set — KB disabled');
    return null;
  }

  _supabase = createClient(url, key);
  return _supabase;
}

// ── Sources ──────────────────────────────────────────────────────────────────

export async function storeSource({
  url, title, source_name, source_type = 'article', content_md,
  company_id = null, vertical_id = 'wealth', topics = [],
  capability = null, published_at = null, fetched_by = 'pipeline',
  is_thin = false, is_paywalled = false, word_count = null,
}) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('sources')
      .insert({
        url, title, source_name, source_type, content_md,
        company_id, vertical_id, topics, capability,
        published_at, fetched_by, is_thin, is_paywalled,
        word_count: word_count || (content_md ? content_md.split(/\s+/).length : 0),
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') return null; // duplicate URL — already exists
      console.warn('[kb-client] storeSource error:', error.message);
      return null;
    }
    return data.id;
  } catch (err) {
    console.warn('[kb-client] storeSource exception:', err.message);
    return null;
  }
}

export async function getSourceByUrl(url) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .eq('url', url)
      .single();

    if (error) return null;
    return data;
  } catch (err) {
    console.warn('[kb-client] getSourceByUrl exception:', err.message);
    return null;
  }
}

export async function getCompanySources(company_id, limit = 10) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .eq('company_id', company_id)
      .order('fetched_at', { ascending: false })
      .limit(limit);

    if (error) { console.warn('[kb-client] getCompanySources error:', error.message); return []; }
    return data || [];
  } catch (err) {
    console.warn('[kb-client] getCompanySources exception:', err.message);
    return [];
  }
}

// ── Research Briefs ──────────────────────────────────────────────────────────

export async function storeBrief(brief) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('research_briefs')
      .insert(brief)
      .select('id')
      .single();

    if (error) { console.warn('[kb-client] storeBrief error:', error.message); return null; }
    return data.id;
  } catch (err) {
    console.warn('[kb-client] storeBrief exception:', err.message);
    return null;
  }
}

export async function getBrief(id) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('research_briefs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  } catch (err) {
    console.warn('[kb-client] getBrief exception:', err.message);
    return null;
  }
}

export async function getReadyBriefs(limit = 10) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('research_briefs')
      .select('*')
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) { console.warn('[kb-client] getReadyBriefs error:', error.message); return []; }
    return data || [];
  } catch (err) {
    console.warn('[kb-client] getReadyBriefs exception:', err.message);
    return [];
  }
}

// ── Editorial Decisions ──────────────────────────────────────────────────────

export async function logDecision({
  entry_id, brief_id = null, decision, reason = null,
  editor_notes = null, draft_snapshot = null, evaluator_score = null,
  pipeline_score = null, company_id = null, capability = null,
  entry_type = null, vertical_id = 'wealth', decided_by = 'haresh',
}) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('editorial_decisions')
      .insert({
        entry_id, brief_id, vertical_id, decision, reason,
        editor_notes, draft_snapshot, evaluator_score,
        pipeline_score, company_id, capability, entry_type, decided_by,
      })
      .select('id')
      .single();

    if (error) { console.warn('[kb-client] logDecision error:', error.message); return null; }
    return data.id;
  } catch (err) {
    console.warn('[kb-client] logDecision exception:', err.message);
    return null;
  }
}

// ── Pipeline Runs ────────────────────────────────────────────────────────────

export async function logPipelineRun({
  vertical_id = 'wealth', tier, started_at = null, completed_at = null,
  candidates_found = 0, sources_stored = 0, briefs_created = 0,
  entries_produced = 0, errors = [],
}) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('pipeline_runs')
      .insert({
        vertical_id, tier, started_at, completed_at,
        candidates_found, sources_stored, briefs_created,
        entries_produced, errors,
      })
      .select('id')
      .single();

    if (error) { console.warn('[kb-client] logPipelineRun error:', error.message); return null; }
    return data.id;
  } catch (err) {
    console.warn('[kb-client] logPipelineRun exception:', err.message);
    return null;
  }
}
