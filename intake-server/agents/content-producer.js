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
export async function produceEntry({ url, title, source_name, triage_score, send }) {
  const iterations = [];

  // ── Stage 2: Research ─────────────────────────────────────────────────────
  send('pipeline_stage', { stage: 'research', message: 'Starting deep research...' });

  let researchBrief;
  try {
    researchBrief = await research({ url, title, source_name, send });
  } catch (err) {
    return { aborted: true, reason: `Research failed: ${err.message}` };
  }

  if (researchBrief.aborted) {
    return { aborted: true, reason: researchBrief.reason };
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

  send('pipeline_complete', {
    message: `Entry ready: "${entry.headline}" | Score: ${finalScore}/100 | Sources: ${entry.source_count} | Fabrication: ${finalFab.verdict}`,
    id: entry.id,
    score: finalScore,
    fabrication: finalFab.verdict,
    iterations: iterations.length,
  });

  return { entry, aborted: false };
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
