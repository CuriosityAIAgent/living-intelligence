/**
 * content-producer.js — v2 pipeline orchestrator
 *
 * Orchestrates the full content production pipeline for one candidate:
 *   1. Research Agent → Research Brief
 *   2. Writer Agent (Opus) → Draft v1
 *   3. Fabrication Agent → Verification v1
 *   4. Evaluator Agent (Opus) → Quality check v1
 *   5. If needed: Writer → Draft v2 → Fabrication v2
 *   6. Final scoring
 *   7. Assembly into v2 entry format
 *
 * Also handles "needs work" re-entry flow.
 */

import fetch from 'node-fetch';
import slugify from 'slugify';
import { research } from './research-agent.js';
import { write } from './writer-agent.js';
import { evaluate } from './evaluator-agent.js';
import { checkFabricationV2 } from './fabrication-strict.js';
import { scoreEntry } from './scorer.js';
import { PRESS_RELEASE_DOMAINS, TIER1_MEDIA } from './config.js';
import { addPending } from './gov-store.js';
import {
  logPipelineEvent, logPipelineRun, getReadyBriefs,
  hydrateBrief, storePublishedEntry, updateBriefStatus,
  decideBrief, logDecision, searchSimilar, getCompanyEntries,
} from './kb-client.js';

// ── Verification Retry — search for unverified claims before blocking ────────

async function verifyUnresolvedClaims(fabricationReport, researchBrief) {
  const unverified = (fabricationReport.details || [])
    .filter(d => d.status === 'fabricated' || d.status === 'unverified')
    .map(d => d.claim);

  if (unverified.length === 0) return { verified: [], still_unverified: [] };

  const verified = [];
  const still_unverified = [];

  for (const claim of unverified.slice(0, 3)) { // max 3 retry searches
    // Search for the specific claim
    const query = `${researchBrief.entities?.company_name || ''} ${claim}`;
    try {
      const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
        headers: {
          'Accept': 'application/json',
          ...(process.env.JINA_API_KEY ? { 'Authorization': `Bearer ${process.env.JINA_API_KEY}` } : {}),
        },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = await res.json();
        const results = data.data || [];
        // If we find a credible source mentioning this claim, it's verified
        const found = results.find(r => r.description && r.description.toLowerCase().includes(claim.toLowerCase().split(' ').slice(0, 3).join(' ')));
        if (found) {
          verified.push({ claim, source: found.url, title: found.title });
        } else {
          still_unverified.push(claim);
        }
      } else {
        still_unverified.push(claim);
      }
    } catch (_) {
      still_unverified.push(claim);
    }
  }

  return { verified, still_unverified };
}

// ── Final Scoring (v2) ──────────────────────────────────────────────────────

function computeFinalScore({ draft, fabricationReport, evaluation, researchBrief }) {
  let score = 0;

  // Dim A: Source Quality — average across verified sources
  const sourceCount = researchBrief.source_count || 1;
  const hasPrimary = (researchBrief.sources || []).some(s => s.type === 'primary');
  const hasTier1 = (researchBrief.sources || []).some(s => {
    try { return TIER1_MEDIA.has(new URL(s.url).hostname.replace(/^www\./, '')); } catch { return false; }
  });
  score += hasPrimary ? 23 : hasTier1 ? 20 : 15;

  // Dim B: Claims verification from fabrication report
  const verified = fabricationReport.claims_verified || 0;
  const total = fabricationReport.claims_checked || 1;
  const ratio = verified / total;
  score += ratio >= 0.9 ? 25 : ratio >= 0.7 ? 18 : ratio >= 0.5 ? 10 : 0;
  if (fabricationReport.claims_fabricated > 0) score = Math.max(0, score - 50);

  // Dim C: Freshness
  const age = draft.date ? (Date.now() - new Date(draft.date).getTime()) / 86400000 : 30;
  score += age <= 1 ? 10 : age <= 3 ? 8 : age <= 7 ? 6 : age <= 14 ? 4 : age <= 30 ? 2 : 1;

  // Dim D: Capability Impact
  if (draft.capability_evidence?.capability && draft.capability_evidence?.evidence) score += 10;
  if (draft.capability_evidence?.stage === 'deployed') score += 12;
  else if (draft.capability_evidence?.stage === 'piloting') score += 7;
  else score += 3;
  if (draft.key_stat) score += 5;

  // Dim E: CXO Relevance (from evaluator)
  if (evaluation?.overall === 'PASS') score += 10;
  else if (evaluation?.quality_score >= 7) score += 7;
  else score += 3;

  // Multi-source bonus
  if (sourceCount >= 3) score += 5;
  else if (sourceCount >= 2) score += 3;
  if (hasPrimary) score += 3;

  return Math.min(100, Math.max(0, score));
}

// ── Monday calculation ────────────────────────────────────────────────────────

function getMondayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  if (isNaN(d.getTime())) return dateStr;
  const dow = d.getUTCDay();
  const daysBack = dow === 0 ? 6 : dow - 1;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - daysBack);
  return monday.toISOString().slice(0, 10);
}

// ── Dedup & Development Detection ───────────────────────────────────────────

/**
 * Check if a candidate is a duplicate of an existing entry, a development
 * (same company, new facts), or a genuinely new story.
 *
 * @param {Object} brief - Research brief with entities, company_id
 * @param {Object} hydrated - Hydrated brief with _primary_source
 * @returns {{ type: 'duplicate'|'development'|'new', match?: Object }}
 */
async function detectDuplicateOrDevelopment(brief, hydrated) {
  const headline = hydrated._primary_source?.title || brief.entities?.key_topic || '';
  const companyId = brief.company_id || brief.entities?.company_slug;

  if (!headline) return { type: 'new' };

  // 1. Semantic search against existing sources in KB
  const similar = await searchSimilar(headline, {
    company_id: companyId || null,
    threshold: 0.70,
    limit: 5,
  });

  if (!similar || similar.length === 0) return { type: 'new' };

  // 2. Check similarity scores
  const topMatch = similar[0];

  // High similarity (>0.85) + same company + within 14 days = likely DUPLICATE
  if (topMatch.similarity >= 0.85 && companyId) {
    const matchDate = topMatch.published_at || topMatch.fetched_at;
    const briefDate = brief.created_at || new Date().toISOString();
    const daysDiff = matchDate
      ? Math.abs(Date.now() - new Date(matchDate).getTime()) / 86400000
      : 999;

    if (daysDiff <= 14) {
      return {
        type: 'duplicate',
        match: {
          matched_source_id: topMatch.id,
          matched_url: topMatch.url,
          matched_title: topMatch.title,
          similarity_score: topMatch.similarity,
          days_apart: Math.round(daysDiff),
        },
      };
    }
  }

  // Medium similarity (>0.70) + same company = check for DEVELOPMENT
  if (topMatch.similarity >= 0.70 && companyId) {
    // Load existing entries for this company to check for new facts
    const existingEntries = await getCompanyEntries(companyId, 5);

    if (existingEntries.length > 0) {
      // Check if the new article has different key facts
      // (different key_stat, different capability stage, new metrics)
      const primaryContent = hydrated._primary_source?.content_md || '';
      const existingHeadlines = existingEntries.map(e => e.headline).join(' | ');

      // Simple heuristic: if the headline is very similar to an existing entry's headline,
      // but the content mentions new metrics/dates/stages, it's a development
      const hasNewNumbers = /\$[\d,.]+\s*(billion|million|B|M)/i.test(primaryContent);
      const hasNewStage = /(launch|deploy|scale|expand|pilot|partner)/i.test(headline);
      const headlineSimilarToExisting = existingEntries.some(e => {
        const words1 = new Set(headline.toLowerCase().split(/\s+/));
        const words2 = new Set(e.headline.toLowerCase().split(/\s+/));
        const overlap = [...words1].filter(w => words2.has(w) && w.length > 3).length;
        return overlap / Math.min(words1.size, words2.size) > 0.5;
      });

      if (headlineSimilarToExisting && (hasNewNumbers || hasNewStage)) {
        return {
          type: 'development',
          match: {
            matched_entry_id: existingEntries[0].id,
            matched_headline: existingEntries[0].headline,
            similarity_score: topMatch.similarity,
            reason: 'Same company, overlapping topic, but new facts detected',
          },
        };
      }
    }
  }

  return { type: 'new' };
}

// ── Main: Produce Entry ──────────────────────────────────────────────────────

/**
 * Run the full v2 pipeline for one candidate.
 *
 * @param {Object} params
 * @param {string} params.url - Candidate URL
 * @param {string} params.title - Candidate title
 * @param {string} params.source_name - Source publication
 * @param {number} [params.triage_score] - Stage 1 triage score (if available)
 * @param {function} params.send - SSE event emitter
 * @returns {Object} { entry, aborted, reason }
 */
export async function produceEntry({ url, title, source_name, triage_score, send, existingResearchBrief }) {
  const iterations = [];
  const runId = await logPipelineRun({ tier: 'tier2_cli', started_at: new Date().toISOString() });

  // ── Stage 2: Research ─────────────────────────────────────────────────────
  let researchBrief;

  if (existingResearchBrief) {
    // Brief already researched (scheduler ran research-agent) — skip duplicate research
    // Normalize hydrated brief shape to match what research() returns, since
    // hydrateBrief() uses _primary_source/content_md vs primary_source/content
    send('pipeline_stage', { stage: 'research', message: 'Using existing research brief — skipping duplicate research.' });
    const h = existingResearchBrief;
    researchBrief = {
      ...h,
      primary_source: h.primary_source || {
        url: h._primary_source?.url || h.candidate_url,
        name: h._primary_source?.source_name || h._primary_source?.title || 'Unknown',
        content: h._primary_source?.content_md || '',
        word_count: h._primary_source?.word_count || 0,
      },
      additional_sources: h.additional_sources || (h._additional_sources || []).map(s => ({
        url: s.url,
        name: s.source_name || s.title || new URL(s.url).hostname,
        title: s.title || '',
        type: s.type || 'coverage',
        content: s.content_md || '',
        word_count: s.word_count || 0,
      })),
      sources: h.sources || [
        { url: h._primary_source?.url || h.candidate_url, name: h._primary_source?.source_name || 'Primary', type: 'primary' },
        ...(h._additional_sources || []).map(s => ({ url: s.url, name: s.source_name || s.title, type: 'coverage' })),
      ],
      source_count: h.source_count || (1 + (h._additional_sources || []).length),
      entities: h.entities || {},
      whats_new: h.whats_new || '',
      research_confidence: h.research_confidence || 'medium',
      landscape_snapshot: h.landscape_snapshot || {},
      landscape: h.landscape || (h.landscape_snapshot ? {
        is_tracked: h.landscape_snapshot.is_tracked || false,
        company: {
          name: h.entities?.company_name || '',
          overall_maturity: null,
          ai_strategy_summary: h.landscape_snapshot.company_summary || '',
        },
        past_entries: (h.landscape_snapshot.past_entries || []).map(headline =>
          typeof headline === 'string' ? { headline, date: '' } : headline
        ),
        peers: h.landscape_snapshot.peers || [],
      } : {}),
    };
  } else {
    send('pipeline_stage', { stage: 'research', message: 'Starting deep research...' });

    let researchStart = Date.now();
    try {
      researchBrief = await research({ url, title, source_name, send });
      await logPipelineEvent({ run_id: runId, agent: 'research', latency_ms: Date.now() - researchStart });
    } catch (err) {
      await logPipelineEvent({ run_id: runId, agent: 'research', latency_ms: Date.now() - researchStart, error: err.message });
      return { aborted: true, reason: `Research failed: ${err.message}` };
    }

    if (researchBrief.aborted) {
      return { aborted: true, reason: researchBrief.reason };
    }
  }

  // ── Stage 3, Iteration 1: Write → Fabrication → Evaluate ──────────────────
  send('pipeline_stage', { stage: 'write_v1', message: 'Writing draft v1 (Opus)...' });

  let draftV1;
  try {
    draftV1 = await write({ researchBrief });
  } catch (err) {
    return { aborted: true, reason: `Writer v1 failed: ${err.message}` };
  }

  send('pipeline_stage', { stage: 'fabrication_v1', message: 'Checking fabrication v1...' });

  let fabV1;
  try {
    fabV1 = await checkFabricationV2({ draft: draftV1, researchBrief });
  } catch (err) {
    fabV1 = { verdict: 'SUSPECT', issues: [`Fabrication v1 error: ${err.message}`], claims_checked: 0, claims_verified: 0, claims_unverified: 0, claims_fabricated: 0, details: [], cross_source_conflicts: [], drift_from_previous: [], checked_at: new Date().toISOString() };
  }

  if (fabV1.verdict === 'FAIL') {
    // Before blocking — try to verify the specific claims via targeted search
    send('pipeline_stage', { stage: 'verification_retry', message: 'Fabrication flagged claims — searching for verification...' });
    const retryResult = await verifyUnresolvedClaims(fabV1, researchBrief);

    if (retryResult.verified.length > 0) {
      send('pipeline_stage', {
        stage: 'verification_retry_result',
        message: `Found sources for ${retryResult.verified.length} claim(s): ${retryResult.verified.map(v => v.claim.slice(0, 40)).join(', ')}`,
      });
      // Add verified sources to research brief
      for (const v of retryResult.verified) {
        researchBrief.sources.push({ name: new URL(v.source).hostname, url: v.source, type: 'coverage' });
        researchBrief.source_count = researchBrief.sources.length;
      }
      // Downgrade from FAIL to SUSPECT — claims found but from different sources
      fabV1.verdict = 'SUSPECT';
      fabV1.issues = retryResult.still_unverified.map(c => `Still unverified: ${c}`);
    } else {
      return { aborted: true, reason: `Fabrication FAIL on v1 (verified retry found nothing): ${fabV1.issues.join('; ')}` };
    }
  }

  send('pipeline_stage', { stage: 'evaluate_v1', message: 'Evaluating v1 against McKinsey test...' });

  let evalV1;
  try {
    evalV1 = await evaluate({ draft: draftV1, researchBrief });
  } catch (err) {
    evalV1 = { overall: 'NEEDS_WORK', quality_score: 5, checks: {}, priority_fix: 'Evaluator error' };
  }

  iterations.push({
    version: 1,
    headline: draftV1.headline,
    the_so_what: draftV1.the_so_what,
    evaluation: evalV1,
    fabrication_verdict: fabV1.verdict,
    timestamp: new Date().toISOString(),
  });

  send('pipeline_stage', {
    stage: 'evaluate_v1_result',
    message: `v1: ${evalV1.overall} (score ${evalV1.quality_score}/10). ${evalV1.overall === 'PASS' ? 'All checks pass — skipping to final.' : `Fix: ${evalV1.priority_fix || 'see feedback'}`}`,
  });

  // ── Early exit: if v1 passes all checks, use it ───────────────────────────
  let finalDraft = draftV1;
  let finalFab = fabV1;
  let finalEval = evalV1;

  if (evalV1.overall !== 'PASS') {
    // ── Iteration 2: Refine → Fabrication ─────────────────────────────────
    send('pipeline_stage', { stage: 'write_v2', message: 'Refining to v2 (Opus)...' });

    let draftV2;
    try {
      draftV2 = await write({ researchBrief, previousDraft: draftV1, evaluatorFeedback: evalV1 });
    } catch (err) {
      // Use v1 if refinement fails
      send('pipeline_stage', { stage: 'write_v2_error', message: `Refinement failed: ${err.message}. Using v1.` });
      draftV2 = draftV1;
    }

    send('pipeline_stage', { stage: 'fabrication_v2', message: 'Checking fabrication v2 (with drift detection)...' });

    let fabV2;
    try {
      fabV2 = await checkFabricationV2({ draft: draftV2, researchBrief, previousDraft: draftV1 });
    } catch (err) {
      fabV2 = { verdict: 'SUSPECT', issues: [`Fabrication v2 error: ${err.message}`], claims_checked: 0, claims_verified: 0, claims_unverified: 0, claims_fabricated: 0, details: [], cross_source_conflicts: [], drift_from_previous: [], checked_at: new Date().toISOString() };
    }

    if (fabV2.verdict === 'FAIL') {
      // Fall back to v1 which passed fabrication
      send('pipeline_stage', { stage: 'fabrication_v2_fail', message: 'v2 failed fabrication — falling back to v1.' });
      finalDraft = draftV1;
      finalFab = fabV1;
    } else {
      // Evaluate v2
      let evalV2;
      try {
        evalV2 = await evaluate({ draft: draftV2, researchBrief });
      } catch (err) {
        evalV2 = { overall: 'NEEDS_WORK', quality_score: 5, checks: {}, priority_fix: 'Evaluator error' };
      }

      iterations.push({
        version: 2,
        headline: draftV2.headline,
        the_so_what: draftV2.the_so_what,
        evaluation: evalV2,
        fabrication_verdict: fabV2.verdict,
        timestamp: new Date().toISOString(),
      });

      finalDraft = draftV2;
      finalFab = fabV2;
      finalEval = evalV2;

      send('pipeline_stage', {
        stage: 'evaluate_v2_result',
        message: `v2: ${evalV2.overall} (score ${evalV2.quality_score}/10)`,
      });
    }
  }

  // ── Stage 4: Final Scoring ────────────────────────────────────────────────
  const finalScore = computeFinalScore({
    draft: finalDraft,
    fabricationReport: finalFab,
    evaluation: finalEval,
    researchBrief,
  });

  send('pipeline_stage', { stage: 'scoring', message: `Final score: ${finalScore}/100` });

  // ── Stage 5: Assemble v2 Entry ────────────────────────────────────────────
  const entryId = finalDraft.id || slugify(finalDraft.headline || 'untitled', {
    lower: true, strict: true, trim: true,
  }).slice(0, 60);

  const entry = {
    // Core fields
    id: entryId,
    type: finalDraft.type || 'market_signal',
    headline: finalDraft.headline,
    summary: finalDraft.summary,
    the_so_what: finalDraft.the_so_what,
    company: finalDraft.company || researchBrief.entities?.company_slug || '',
    company_name: finalDraft.company_name || researchBrief.entities?.company_name || '',
    date: finalDraft.date || researchBrief.entities?.date || '1970-01-01', // NEVER default to today — 1970 flags missing date for review
    week: getMondayOf(finalDraft.date || researchBrief.entities?.date || '1970-01-01'),
    source_name: source_name || researchBrief.candidate_source,
    source_url: url,
    source_verified: finalFab.verdict === 'CLEAN',
    image_url: null, // publisher.js auto-resolves
    key_stat: finalDraft.key_stat || null,
    capability_evidence: finalDraft.capability_evidence || null,
    tags: finalDraft.tags || {},
    sources: researchBrief.sources || [],
    source_count: researchBrief.source_count || 1,
    featured: false,

    // v2 pipeline metadata
    _triage_score: triage_score || null,
    _final_score: finalScore,

    _research: {
      entities: researchBrief.entities,
      source_count: researchBrief.source_count,
      sources_found: (researchBrief.additional_sources || []).length + 1,
      landscape_context: {
        is_tracked: researchBrief.landscape?.is_tracked || false,
        current_maturity: researchBrief.landscape?.company?.overall_maturity || null,
        peer_comparison: (researchBrief.landscape?.peers || []).map(p => `${p.name} (${p.maturity})`).join(', '),
      },
      past_entries_count: researchBrief.landscape?.past_entries?.length || 0,
      whats_new: researchBrief.whats_new,
      confidence: researchBrief.research_confidence,
      researched_at: researchBrief.researched_at,
    },

    _fabrication: {
      verdict: finalFab.verdict,
      claims_checked: finalFab.claims_checked,
      claims_verified: finalFab.claims_verified,
      claims_unverified: finalFab.claims_unverified,
      claims_fabricated: finalFab.claims_fabricated,
      details: (finalFab.details || []).slice(0, 20),
      cross_source_conflicts: finalFab.cross_source_conflicts || [],
      drift_from_previous: finalFab.drift_from_previous || [],
      checked_at: finalFab.checked_at,
    },

    _iterations: iterations,

    _editor_notes: [],
  };

  // Add to editorial inbox
  const govAudit = {
    verdict: finalFab.verdict === 'CLEAN' ? 'PASS' : 'REVIEW',
    confidence: finalFab.verdict === 'CLEAN' ? 90 : 60,
    verified_claims: (finalFab.details || []).filter(d => d.status === 'verified').map(d => d.claim),
    unverified_claims: (finalFab.details || []).filter(d => d.status === 'unverified').map(d => d.claim),
    fabricated_claims: (finalFab.details || []).filter(d => d.status === 'fabricated').map(d => d.claim),
    notes: `v2 pipeline — ${iterations.length} iteration(s), fabrication: ${finalFab.verdict}`,
    paywall_caveat: false,
    verified_at: new Date().toISOString(),
    human_approved: false,
  };
  addPending(entry, govAudit, { score: finalScore, score_breakdown: `v2 pipeline (${iterations.length} iterations)` });
  send('pipeline_stage', { stage: 'inbox', message: `Added to editorial inbox: ${entry.id}` });

  // Log final pipeline event + update run
  await logPipelineEvent({
    run_id: runId, agent: 'content-producer', entry_id: entry.id,
    score: { final_score: finalScore, fabrication: finalFab.verdict, iterations: iterations.length },
  });

  send('pipeline_complete', {
    message: `Entry ready: "${entry.headline}" | Score: ${finalScore}/100 | Sources: ${entry.source_count} | Fabrication: ${finalFab.verdict}`,
    id: entry.id,
    score: finalScore,
    fabrication: finalFab.verdict,
    iterations: iterations.length,
  });

  return { entry, aborted: false, runId };
}

// ── "Needs Work" Re-entry ────────────────────────────────────────────────────

/**
 * Re-process an entry with editor notes.
 * Uses stored _research brief to avoid re-fetching.
 *
 * @param {Object} params
 * @param {Object} params.entry - Existing entry with _research
 * @param {string} params.editorNotes - Human editor feedback
 * @param {Object} params.researchBrief - Full research brief (stored from original run)
 * @param {function} params.send - SSE event emitter
 * @returns {Object} Updated entry
 */
export async function reworkEntry({ entry, editorNotes, researchBrief, send }) {
  send('pipeline_stage', { stage: 'rework', message: `Re-writing with editor notes: "${editorNotes.slice(0, 100)}..."` });

  // Writer takes current entry + notes + research brief
  const reworkedDraft = await write({
    researchBrief,
    previousDraft: entry,
    editorNotes,
  });

  // Fabrication check on the reworked version
  send('pipeline_stage', { stage: 'rework_fabrication', message: 'Checking fabrication on reworked draft...' });
  const fabCheck = await checkFabricationV2({ draft: reworkedDraft, researchBrief, previousDraft: entry });

  if (fabCheck.verdict === 'FAIL') {
    send('pipeline_stage', { stage: 'rework_fail', message: 'Reworked draft failed fabrication — keeping original.' });
    entry._editor_notes.push({ note: editorNotes, result: 'fabrication_failed', timestamp: new Date().toISOString() });
    return entry;
  }

  // Update entry with reworked content
  entry.headline = reworkedDraft.headline || entry.headline;
  entry.summary = reworkedDraft.summary || entry.summary;
  entry.the_so_what = reworkedDraft.the_so_what || entry.the_so_what;
  entry.key_stat = reworkedDraft.key_stat || entry.key_stat;
  entry._fabrication = {
    ...fabCheck,
    details: (fabCheck.details || []).slice(0, 20),
  };
  entry._iterations.push({
    version: entry._iterations.length + 1,
    headline: reworkedDraft.headline,
    the_so_what: reworkedDraft.the_so_what,
    evaluation: null,
    fabrication_verdict: fabCheck.verdict,
    editor_notes: editorNotes,
    timestamp: new Date().toISOString(),
  });
  entry._editor_notes.push({ note: editorNotes, result: 'applied', timestamp: new Date().toISOString() });

  send('pipeline_stage', { stage: 'rework_complete', message: 'Rework applied successfully.' });
  return entry;
}

// ── Batch Production (v2 lifecycle) ─────────────────────────────────────────

/**
 * Produce entries for the top N ready briefs from KB.
 * Full lifecycle: ready → processing → dedup check → v2 pipeline → produced/held/duplicate
 * Every step logged to editorial_decisions in Supabase.
 */
export async function produceBatch({ limit = 5, send }) {
  const briefs = await getReadyBriefs(limit);
  if (briefs.length === 0) {
    send('pipeline_stage', { stage: 'batch', message: 'No ready briefs in KB.' });
    return { produced: 0, held: 0, duplicates: 0, developments: 0, errors: 0, results: [] };
  }

  send('pipeline_stage', { stage: 'batch', message: `Processing ${briefs.length} ready briefs...` });
  const summary = { produced: 0, held: 0, duplicates: 0, developments: 0, errors: 0, results: [] };

  for (const brief of briefs) {
    try {
      // Mark as processing
      await updateBriefStatus(brief.id, 'processing');

      const hydrated = await hydrateBrief(brief.id);
      if (!hydrated) {
        summary.errors++;
        summary.results.push({ briefId: brief.id, aborted: true, reason: 'Failed to hydrate' });
        await updateBriefStatus(brief.id, 'ready'); // re-queue for next run
        continue;
      }

      // ── Dedup check ──────────────────────────────────────────────────────
      send('pipeline_stage', { stage: 'dedup', message: `Checking dedup for: ${brief.entities?.key_topic || brief.candidate_url}` });
      const dedup = await detectDuplicateOrDevelopment(brief, hydrated);

      if (dedup.type === 'duplicate') {
        send('pipeline_stage', { stage: 'dedup_skip', message: `DUPLICATE — matches: ${dedup.match.matched_title} (sim: ${dedup.match.similarity_score.toFixed(2)})` });
        await updateBriefStatus(brief.id, 'duplicate', {
          similarity_match: dedup.match,
          decision: 'DUPLICATE',
          decision_reason: `Duplicate of ${dedup.match.matched_url} (similarity: ${dedup.match.similarity_score.toFixed(2)})`,
          decided_by: 'pipeline',
          decided_at: new Date().toISOString(),
        });
        await logDecision({
          entry_id: brief.entities?.company_slug || brief.id,
          brief_id: brief.id,
          decision: 'DUPLICATE',
          reason: `Matched ${dedup.match.matched_title} (sim: ${dedup.match.similarity_score.toFixed(2)}, ${dedup.match.days_apart}d apart)`,
          company_id: brief.company_id,
          decided_by: 'pipeline',
        });
        summary.duplicates++;
        summary.results.push({ briefId: brief.id, type: 'duplicate', match: dedup.match });
        continue;
      }

      if (dedup.type === 'development') {
        send('pipeline_stage', { stage: 'dedup_development', message: `DEVELOPMENT — same company, new facts. Processing through v2 to enrich.` });
        // Developments still go through the full v2 pipeline — they just get flagged
        // so the Editorial Studio can show "updates existing entry: X"
        await updateBriefStatus(brief.id, 'processing', {
          similarity_match: dedup.match,
        });
      }

      // ── Full v2 pipeline ─────────────────────────────────────────────────
      // Pass hydrated brief as existingResearchBrief to skip duplicate research
      const result = await produceEntry({
        url: brief.candidate_url,
        title: hydrated._primary_source?.title || '',
        source_name: brief.entities?.company_name || '',
        triage_score: brief.triage_score,
        send,
        existingResearchBrief: hydrated,
      });

      if (result.aborted) {
        await updateBriefStatus(brief.id, 'held', {
          decision: 'HELD',
          decision_reason: result.reason,
          decided_by: 'pipeline',
          decided_at: new Date().toISOString(),
        });
        await logDecision({
          entry_id: brief.entities?.company_slug || brief.id,
          brief_id: brief.id,
          decision: 'HELD',
          reason: result.reason,
          company_id: brief.company_id,
          decided_by: 'pipeline',
        });
        summary.held++;
        summary.results.push({ briefId: brief.id, type: 'held', reason: result.reason });
        continue;
      }

      // Store v2 output in the brief
      const status = (result.entry._final_score >= 75 && result.entry._fabrication.verdict === 'CLEAN')
        ? 'produced'
        : 'held';

      await updateBriefStatus(brief.id, status, {
        v2_entry: result.entry,
        v2_score: result.entry._final_score,
        v2_fabrication_verdict: result.entry._fabrication.verdict,
        v2_evaluation: result.entry._iterations?.[result.entry._iterations.length - 1]?.evaluation || null,
        similarity_match: dedup.type === 'development' ? dedup.match : null,
      });

      await logDecision({
        entry_id: result.entry.id,
        brief_id: brief.id,
        decision: status === 'produced' ? 'PRODUCED' : 'HELD',
        reason: status === 'produced'
          ? `Score ${result.entry._final_score}/100, fabrication ${result.entry._fabrication.verdict}, ${result.entry.source_count} sources`
          : `Score ${result.entry._final_score}/100 (< 75) or fabrication ${result.entry._fabrication.verdict}`,
        draft_snapshot: result.entry,
        evaluator_score: result.entry._iterations?.[result.entry._iterations.length - 1]?.evaluation,
        pipeline_score: result.entry._final_score,
        company_id: brief.company_id,
        capability: result.entry.capability_evidence?.capability,
        entry_type: result.entry.type,
        decided_by: 'pipeline',
      });

      if (status === 'produced') {
        summary.produced++;
        if (dedup.type === 'development') summary.developments++;
      } else {
        summary.held++;
      }
      summary.results.push({
        briefId: brief.id,
        type: status,
        entryId: result.entry.id,
        score: result.entry._final_score,
        fabrication: result.entry._fabrication.verdict,
        isDevelopment: dedup.type === 'development',
      });

    } catch (err) {
      console.error(`[content-producer] Error processing brief ${brief.id}:`, err.message);
      await updateBriefStatus(brief.id, 'ready'); // re-queue
      summary.errors++;
      summary.results.push({ briefId: brief.id, aborted: true, reason: err.message });
    }
  }

  send('pipeline_stage', {
    stage: 'batch_complete',
    message: `Batch done: ${summary.produced} produced, ${summary.held} held, ${summary.duplicates} duplicates, ${summary.developments} developments, ${summary.errors} errors`,
  });

  return summary;
}

// ── CLI Entrypoint ──────────────────────────────────────────────────────────

async function cli() {
  const args = process.argv.slice(2);
  const send = (type, data) => console.log(`[${type}] ${data.message || JSON.stringify(data)}`);

  if (args.includes('--status')) {
    const briefs = await getReadyBriefs(50);
    console.log(`\nReady briefs in KB: ${briefs.length}`);
    for (const b of briefs) {
      console.log(`  ${b.id.slice(0, 8)} | ${b.candidate_url?.slice(0, 60)} | sources: ${b.source_count || '?'} | ${b.created_at?.slice(0, 10)}`);
    }
    return;
  }

  if (args.includes('--url')) {
    const url = args[args.indexOf('--url') + 1];
    if (!url) { console.error('Usage: --url <url>'); process.exit(1); }
    console.log(`\nProducing entry for: ${url}\n`);
    const result = await produceEntry({ url, title: '', source_name: '', send });
    if (result.aborted) {
      console.error(`\nAborted: ${result.reason}`);
      process.exit(1);
    }
    console.log(`\nEntry produced: ${result.entry.headline}`);
    console.log(`Score: ${result.entry._final_score}/100`);
    console.log(`Fabrication: ${result.entry._fabrication.verdict}`);
    console.log(`Iterations: ${result.entry._iterations.length}`);
    console.log(`\nFull entry JSON written to stdout (pipe to file if needed):`);
    console.log(JSON.stringify(result.entry, null, 2));
    return;
  }

  if (args.includes('--top')) {
    const limit = parseInt(args[args.indexOf('--top') + 1], 10) || 5;
    console.log(`\nProducing top ${limit} ready briefs...\n`);
    const batch = await produceBatch({ limit, send });
    console.log(`\nDone. ${batch.produced}/${batch.results.length} produced, ${batch.held} held, ${batch.duplicates} duplicates, ${batch.errors} errors.`);
    return;
  }

  if (args.includes('--brief')) {
    const briefId = args[args.indexOf('--brief') + 1];
    if (!briefId) { console.error('Usage: --brief <uuid>'); process.exit(1); }
    const hydrated = await hydrateBrief(briefId);
    if (!hydrated) { console.error(`Brief ${briefId} not found or failed to hydrate.`); process.exit(1); }
    console.log(`\nProducing from brief ${briefId}...\n`);
    const result = await produceEntry({
      url: hydrated.candidate_url,
      title: hydrated._primary_source?.title || '',
      source_name: hydrated.candidate_source || '',
      send,
      existingResearchBrief: hydrated,
    });
    if (result.aborted) {
      console.error(`\nAborted: ${result.reason}`);
      process.exit(1);
    }
    console.log(`\nEntry produced: ${result.entry.headline}`);
    console.log(JSON.stringify(result.entry, null, 2));
    return;
  }

  console.log(`
Content Producer CLI — v2 Pipeline

Usage:
  node --env-file=.env agents/content-producer.js --url <url>     Research + produce single URL
  node --env-file=.env agents/content-producer.js --brief <uuid>  Resume from existing brief
  node --env-file=.env agents/content-producer.js --top <N>       Produce top N ready briefs
  node --env-file=.env agents/content-producer.js --status        Show ready briefs
`);
}

// Run CLI if executed directly
const isMain = process.argv[1]?.endsWith('content-producer.js');
if (isMain) {
  cli().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}
