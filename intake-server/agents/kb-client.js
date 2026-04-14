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
import { createHash } from 'crypto';

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

    const content_hash = content_md ? createHash('md5').update(content_md).digest('hex') : null;

    const { data, error } = await supabase
      .from('sources')
      .insert({
        url, title, source_name, source_type, content_md,
        company_id, vertical_id, topics, capability,
        published_at, fetched_by, is_thin, is_paywalled,
        word_count: word_count || (content_md ? content_md.split(/\s+/).length : 0),
        content_hash,
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

// ── Brief Lifecycle (v2 pipeline) ────────────────────────────────────────────

export async function updateBriefStatus(id, status, updates = {}) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const payload = { status, ...updates };
    if (status === 'produced' || status === 'held') {
      payload.processed_at = payload.processed_at || new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('research_briefs')
      .update(payload)
      .eq('id', id)
      .select('id')
      .single();

    if (error) { console.warn('[kb-client] updateBriefStatus error:', error.message); return null; }
    return data.id;
  } catch (err) {
    console.warn('[kb-client] updateBriefStatus exception:', err.message);
    return null;
  }
}

export async function getProducedBriefs(limit = 20) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('research_briefs')
      .select('*')
      .eq('status', 'produced')
      .order('processed_at', { ascending: false })
      .limit(limit);

    if (error) { console.warn('[kb-client] getProducedBriefs error:', error.message); return []; }
    return data || [];
  } catch (err) {
    console.warn('[kb-client] getProducedBriefs exception:', err.message);
    return [];
  }
}

export async function getHeldBriefs(limit = 20) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('research_briefs')
      .select('*')
      .eq('status', 'held')
      .order('processed_at', { ascending: false })
      .limit(limit);

    if (error) { console.warn('[kb-client] getHeldBriefs error:', error.message); return []; }
    return data || [];
  } catch (err) {
    console.warn('[kb-client] getHeldBriefs exception:', err.message);
    return [];
  }
}

export async function decideBrief(id, { decision, reason = null, decided_by = 'haresh' }) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const brief = await getBrief(id);
    if (!brief) return null;

    // Update the brief with the decision
    const statusMap = {
      APPROVED: 'approved',
      REJECTED: 'rejected',
      HELD: 'held',
      RETRY: 'ready',  // re-queue for processing
    };

    await updateBriefStatus(id, statusMap[decision] || brief.status, {
      decision,
      decision_reason: reason,
      decided_by,
      decided_at: new Date().toISOString(),
    });

    // Log to editorial_decisions for audit trail
    await logDecision({
      entry_id: brief.v2_entry?.id || brief.entities?.company_slug || id,
      brief_id: id,
      decision,
      reason,
      draft_snapshot: brief.v2_entry,
      evaluator_score: brief.v2_evaluation,
      pipeline_score: brief.v2_score,
      company_id: brief.company_id,
      capability: brief.entities?.capability_area,
      entry_type: brief.v2_entry?.type || 'intelligence',
      decided_by,
    });

    return id;
  } catch (err) {
    console.warn('[kb-client] decideBrief exception:', err.message);
    return null;
  }
}

export async function getDecisionHistory({ limit = 50, company_id = null, decision = null } = {}) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    let query = supabase
      .from('editorial_decisions')
      .select('*')
      .order('decided_at', { ascending: false })
      .limit(limit);

    if (company_id) query = query.eq('company_id', company_id);
    if (decision) query = query.eq('decision', decision);

    const { data, error } = await query;

    if (error) { console.warn('[kb-client] getDecisionHistory error:', error.message); return []; }
    return data || [];
  } catch (err) {
    console.warn('[kb-client] getDecisionHistory exception:', err.message);
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

// ── Published Entries ────────────────────────────────────────────────────────

export async function storePublishedEntry({
  id, entry_type = 'intelligence', company_id = null, vertical_id = 'wealth',
  headline, summary = null, the_so_what = null, key_stat = null,
  capability = null, source_url = null, source_urls = [],
  week = null, published_at = null, tags = [],
  related_landscape_ids = [], supersedes = null,
}) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('published_entries')
      .upsert({
        id, entry_type, company_id, vertical_id, headline, summary,
        the_so_what, key_stat, capability, source_url, source_urls,
        week, published_at, tags, related_landscape_ids, supersedes,
      }, { onConflict: 'id' })
      .select('id')
      .single();

    if (error) { console.warn('[kb-client] storePublishedEntry error:', error.message); return null; }
    return data.id;
  } catch (err) {
    console.warn('[kb-client] storePublishedEntry exception:', err.message);
    return null;
  }
}

export async function getPublishedEntry(id) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('published_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  } catch (err) {
    console.warn('[kb-client] getPublishedEntry exception:', err.message);
    return null;
  }
}

export async function getCompanyEntries(company_id, limit = 20) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('published_entries')
      .select('*')
      .eq('company_id', company_id)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) { console.warn('[kb-client] getCompanyEntries error:', error.message); return []; }
    return data || [];
  } catch (err) {
    console.warn('[kb-client] getCompanyEntries exception:', err.message);
    return [];
  }
}

// ── Landscape Profiles ──────────────────────────────────────────────────────

export async function storeLandscapeProfile({
  id, company_id = null, vertical_id = 'wealth', segment = null,
  ai_strategy_summary = null, headline_metric = null, headline_initiative = null,
  overall_maturity = null, capabilities = {}, evidence_entry_ids = [],
  last_updated = null,
}) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('landscape_profiles')
      .upsert({
        id, company_id: company_id || id, vertical_id, segment,
        ai_strategy_summary, headline_metric, headline_initiative,
        overall_maturity, capabilities, evidence_entry_ids, last_updated,
      }, { onConflict: 'id' })
      .select('id')
      .single();

    if (error) { console.warn('[kb-client] storeLandscapeProfile error:', error.message); return null; }
    return data.id;
  } catch (err) {
    console.warn('[kb-client] storeLandscapeProfile exception:', err.message);
    return null;
  }
}

export async function getLandscapeProfile(id) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('landscape_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  } catch (err) {
    console.warn('[kb-client] getLandscapeProfile exception:', err.message);
    return null;
  }
}

// ── Source Updates ───────────────────────────────────────────────────────────

export async function updateSource(id, updates) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('sources')
      .update(updates)
      .eq('id', id)
      .select('id')
      .single();

    if (error) { console.warn('[kb-client] updateSource error:', error.message); return null; }
    return data.id;
  } catch (err) {
    console.warn('[kb-client] updateSource exception:', err.message);
    return null;
  }
}

// ── Upsert Source (store or return existing) ────────────────────────────────

export async function upsertSource({
  url, title, source_name, source_type = 'article', content_md,
  company_id = null, vertical_id = 'wealth', topics = [],
  capability = null, published_at = null, fetched_by = 'pipeline',
  is_thin = false, is_paywalled = false, word_count = null,
}) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    // Check if source already exists
    const existing = await getSourceByUrl(url);
    if (existing) {
      const newHash = content_md ? createHash('md5').update(content_md).digest('hex') : null;
      // If existing is thin and we have full content, upgrade it
      if (existing.is_thin && content_md && content_md.length > 500) {
        await updateSource(existing.id, {
          content_md,
          content_hash: newHash,
          is_thin: false,
          word_count: word_count || content_md.split(/\s+/).length,
          fetched_by,
        });
      } else if (newHash && existing.content_hash && newHash !== existing.content_hash) {
        // Content changed since last fetch — update (Principle 7: detect changes)
        await updateSource(existing.id, {
          content_md,
          content_hash: newHash,
          word_count: word_count || content_md.split(/\s+/).length,
          fetched_by,
        });
      }
      return existing.id;
    }

    return await storeSource({
      url, title, source_name, source_type, content_md,
      company_id, vertical_id, topics, capability,
      published_at, fetched_by, is_thin, is_paywalled, word_count,
    });
  } catch (err) {
    console.warn('[kb-client] upsertSource exception:', err.message);
    return null;
  }
}

// ── Company Context (combined query) ────────────────────────────────────────

export async function getCompanyContext(company_id) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { sources: [], entries: [], landscape: null };

    const [sources, entries, landscape] = await Promise.all([
      getCompanySources(company_id, 20),
      getCompanyEntries(company_id, 10),
      getLandscapeProfile(company_id),
    ]);

    return { sources, entries, landscape };
  } catch (err) {
    console.warn('[kb-client] getCompanyContext exception:', err.message);
    return { sources: [], entries: [], landscape: null };
  }
}

// ── Hydrate Brief (load source text from KB into brief) ─────────────────────

export async function hydrateBrief(briefId) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const brief = await getBrief(briefId);
    if (!brief) return null;

    // Load primary source content
    if (brief.primary_source_id) {
      const { data } = await supabase
        .from('sources')
        .select('url, title, source_name, content_md, word_count')
        .eq('id', brief.primary_source_id)
        .single();
      if (data) brief._primary_source = data;
    }

    // Load additional source content
    if (brief.additional_source_ids?.length > 0) {
      const { data } = await supabase
        .from('sources')
        .select('id, url, title, source_name, content_md, word_count')
        .in('id', brief.additional_source_ids);
      if (data) brief._additional_sources = data;
    }

    return brief;
  } catch (err) {
    console.warn('[kb-client] hydrateBrief exception:', err.message);
    return null;
  }
}

// ── Pipeline Events (per-agent observability — Principle 8) ──────────────────

export async function logPipelineEvent({
  run_id = null, agent, entry_id = null, prompt_version = null,
  model = null, tokens_in = null, tokens_out = null,
  latency_ms = null, score = null, error = null,
}) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error: dbError } = await supabase
      .from('pipeline_events')
      .insert({
        run_id, agent, entry_id, prompt_version, model,
        tokens_in, tokens_out, latency_ms, score, error,
      })
      .select('id')
      .single();

    if (dbError) {
      // Table might not exist yet — warn once, don't crash
      if (dbError.code === '42P01') return null;
      console.warn('[kb-client] logPipelineEvent error:', dbError.message);
      return null;
    }
    return data.id;
  } catch (err) {
    console.warn('[kb-client] logPipelineEvent exception:', err.message);
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

// ── Jina Embedding ──────────────────────────────────────────────────────────

export async function getJinaEmbedding(text) {
  try {
    if (!process.env.JINA_API_KEY || !text) return null;

    const res = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'jina-embeddings-v3',
        task: 'text-matching',
        dimensions: 512,
        input: [text.slice(0, 8000)],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.warn('[kb-client] getJinaEmbedding exception:', err.message);
    return null;
  }
}

// ── Semantic Search (vector similarity via match_sources RPC) ───────────────

export async function searchSimilar(text, {
  company_id = null,
  vertical_id = null,
  threshold = 0.75,
  limit = 5,
} = {}) {
  try {
    const embedding = await getJinaEmbedding(text);
    if (!embedding) return [];

    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase.rpc('match_sources', {
      query_embedding: JSON.stringify(embedding),
      match_threshold: threshold,
      match_count: limit,
      filter_company_id: company_id,
      filter_vertical_id: vertical_id,
    });

    if (error) {
      // RPC might not exist yet
      if (error.code === '42883') return [];
      console.warn('[kb-client] searchSimilar error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('[kb-client] searchSimilar exception:', err.message);
    return [];
  }
}
