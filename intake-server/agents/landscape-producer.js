/**
 * landscape-producer.js — v2 pipeline orchestrator for landscape profiles
 *
 * Orchestrates the full landscape enrichment pipeline for one company:
 *   1. Landscape Research Agent → Research Brief
 *   2. Landscape Writer Agent (Opus) → Draft v1
 *   3. Fabrication Agent → Verification v1
 *   4. Landscape Evaluator Agent (Opus) → Quality check v1
 *   5. If needed: Writer refines → Fabrication v2
 *   6. Merge into existing competitor JSON
 *
 * Output: Complete competitor JSON ready to write to data/competitors/
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { researchLandscape } from './landscape-research-agent.js';
import { writeLandscape } from './landscape-writer-agent.js';
import { evaluateLandscape } from './landscape-evaluator-agent.js';
import { checkFabricationV2 } from './fabrication-strict.js';
import { COMPETITORS_DIR } from './config.js';

// ── Build source text for fabrication checking ──────────────────────────────

function buildSourceText(researchBrief) {
  const parts = [];

  // Our intelligence entries
  for (const entry of researchBrief.our_intelligence || []) {
    parts.push(`=== OUR INTEL: ${entry.headline} (${entry.date}) ===\n${entry.summary || ''}\n${entry.the_so_what || ''}`);
  }

  // Fetched articles
  for (const article of researchBrief.articles || []) {
    parts.push(`=== ARTICLE: ${article.title} (${article.hostname}) ===\n${article.content}`);
  }

  return parts.join('\n\n');
}

// ── Fabrication check adapted for landscape ─────────────────────────────────

async function checkLandscapeFabrication(draft, researchBrief, previousDraft) {
  // Build a pseudo-entry for the fabrication agent
  const pseudoEntry = {
    headline: draft.headline_metric || '',
    summary: draft.ai_strategy_summary || '',
    the_so_what: Object.values(draft.capabilities || {}).map(c => c.headline + ' ' + c.detail).join(' '),
    company_name: researchBrief.company.name,
    key_stat: null,
  };

  const pseudoBrief = {
    primary_source: {
      name: 'Compiled sources',
      content: buildSourceText(researchBrief),
    },
    additional_sources: [],
    source_count: 1,
  };

  return checkFabricationV2({
    draft: pseudoEntry,
    researchBrief: pseudoBrief,
    previousDraft: previousDraft ? {
      headline: previousDraft.headline_metric || '',
      summary: previousDraft.ai_strategy_summary || '',
      the_so_what: '',
    } : undefined,
  });
}

// ── Main: Produce Landscape Profile ─────────────────────────────────────────

/**
 * Run the full v2 pipeline for one company's landscape profile.
 *
 * @param {Object} params
 * @param {string} params.companySlug — company ID (e.g., 'morgan-stanley')
 * @param {function} params.send — SSE event emitter
 * @returns {Object} { profile, aborted, reason }
 */
export async function produceLandscape({ companySlug, send }) {
  const iterations = [];

  // ── Stage 1: Research ─────────────────────────────────────────────────────
  send('landscape_stage', { stage: 'research', message: `Researching ${companySlug}...` });

  let researchBrief;
  try {
    researchBrief = await researchLandscape({ companySlug, send });
  } catch (err) {
    return { aborted: true, reason: `Research failed: ${err.message}` };
  }

  if (researchBrief.aborted) {
    return { aborted: true, reason: researchBrief.reason };
  }

  // ── Stage 2: Write v1 ─────────────────────────────────────────────────────
  send('landscape_stage', { stage: 'write_v1', message: 'Writing landscape profile v1 (Opus)...' });

  let draftV1;
  try {
    draftV1 = await writeLandscape({ researchBrief });
  } catch (err) {
    return { aborted: true, reason: `Writer v1 failed: ${err.message}` };
  }

  // ── Stage 3: Fabrication check v1 ─────────────────────────────────────────
  send('landscape_stage', { stage: 'fabrication_v1', message: 'Checking fabrication v1...' });

  let fabV1;
  try {
    fabV1 = await checkLandscapeFabrication(draftV1, researchBrief);
  } catch (err) {
    fabV1 = { verdict: 'SUSPECT', issues: [`Fabrication error: ${err.message}`], claims_checked: 0, claims_verified: 0, claims_unverified: 0, claims_fabricated: 0, details: [], cross_source_conflicts: [], drift_from_previous: [], checked_at: new Date().toISOString() };
  }

  // ── Stage 4: Evaluate v1 ──────────────────────────────────────────────────
  send('landscape_stage', { stage: 'evaluate_v1', message: 'Evaluating v1 against Landscape McKinsey Test...' });

  let evalV1;
  try {
    evalV1 = await evaluateLandscape({ draft: draftV1, researchBrief });
  } catch (err) {
    evalV1 = { overall: 'NEEDS_WORK', quality_score: 5, checks: {}, priority_fix: 'Evaluator error' };
  }

  iterations.push({
    version: 1,
    strategy_preview: draftV1.ai_strategy_summary?.slice(0, 100),
    evaluation: evalV1,
    fabrication_verdict: fabV1.verdict,
    timestamp: new Date().toISOString(),
  });

  send('landscape_stage', {
    stage: 'evaluate_v1_result',
    message: `v1: ${evalV1.overall} (score ${evalV1.quality_score}/10). ${evalV1.overall === 'PASS' ? 'All checks pass.' : `Fix: ${evalV1.priority_fix || 'see feedback'}`}`,
  });

  // ── Early exit or refine ──────────────────────────────────────────────────
  let finalDraft = draftV1;
  let finalFab = fabV1;
  let finalEval = evalV1;

  if (evalV1.overall !== 'PASS') {
    // ── Iteration 2: Refine ─────────────────────────────────────────────────
    send('landscape_stage', { stage: 'write_v2', message: 'Refining to v2 (Opus)...' });

    let draftV2;
    try {
      draftV2 = await writeLandscape({ researchBrief, previousDraft: draftV1, evaluatorFeedback: evalV1 });
    } catch (err) {
      send('landscape_stage', { stage: 'write_v2_error', message: `Refinement failed: ${err.message}. Using v1.` });
      draftV2 = draftV1;
    }

    // Fabrication check v2
    send('landscape_stage', { stage: 'fabrication_v2', message: 'Checking fabrication v2...' });

    let fabV2;
    try {
      fabV2 = await checkLandscapeFabrication(draftV2, researchBrief, draftV1);
    } catch (err) {
      fabV2 = { verdict: 'SUSPECT', issues: [], claims_checked: 0, claims_verified: 0, claims_unverified: 0, claims_fabricated: 0, details: [], cross_source_conflicts: [], drift_from_previous: [], checked_at: new Date().toISOString() };
    }

    // Evaluate v2
    let evalV2;
    try {
      evalV2 = await evaluateLandscape({ draft: draftV2, researchBrief });
    } catch (err) {
      evalV2 = { overall: 'NEEDS_WORK', quality_score: 5, checks: {}, priority_fix: 'Evaluator error' };
    }

    iterations.push({
      version: 2,
      strategy_preview: draftV2.ai_strategy_summary?.slice(0, 100),
      evaluation: evalV2,
      fabrication_verdict: fabV2.verdict,
      timestamp: new Date().toISOString(),
    });

    finalDraft = draftV2;
    finalFab = fabV2;
    finalEval = evalV2;

    send('landscape_stage', {
      stage: 'evaluate_v2_result',
      message: `v2: ${evalV2.overall} (score ${evalV2.quality_score}/10)`,
    });
  }

  // ── Stage 5: Merge with existing profile ──────────────────────────────────

  // Load existing profile for static fields
  let existingProfile;
  try {
    existingProfile = JSON.parse(readFileSync(join(COMPETITORS_DIR, `${companySlug}.json`), 'utf8'));
  } catch {
    return { aborted: true, reason: `Cannot read existing profile for ${companySlug}` };
  }

  // Merge: keep static fields from existing, update content from draft
  const profile = {
    id: existingProfile.id,
    name: existingProfile.name,
    segment: existingProfile.segment,
    regions: existingProfile.regions,
    color: existingProfile.color,
    ai_strategy_summary: finalDraft.ai_strategy_summary || existingProfile.ai_strategy_summary,
    head_of_ai: existingProfile.head_of_ai,
    headline_metric: finalDraft.headline_metric || existingProfile.headline_metric,
    headline_initiative: finalDraft.headline_initiative || existingProfile.headline_initiative,
    overall_maturity: finalDraft.overall_maturity || existingProfile.overall_maturity,
    capabilities: finalDraft.capabilities || existingProfile.capabilities,
    last_updated: new Date().toISOString().slice(0, 10),

    // v2 metadata
    _landscape_v2: {
      iterations,
      fabrication: {
        verdict: finalFab.verdict,
        claims_checked: finalFab.claims_checked,
        claims_verified: finalFab.claims_verified,
        claims_fabricated: finalFab.claims_fabricated,
      },
      evaluation: {
        overall: finalEval.overall,
        quality_score: finalEval.quality_score,
      },
      research: {
        intel_entries: researchBrief.our_intelligence?.length || 0,
        tl_mentions: researchBrief.our_tl_mentions?.length || 0,
        articles_fetched: researchBrief.articles?.length || 0,
        peers_compared: researchBrief.peers?.length || 0,
        confidence: researchBrief.research_confidence,
      },
      processed_at: new Date().toISOString(),
    },
  };

  send('landscape_complete', {
    message: `Profile ready: ${existingProfile.name} | Eval: ${finalEval.overall} (${finalEval.quality_score}/10) | Fab: ${finalFab.verdict} | Caps: ${Object.keys(finalDraft.capabilities || {}).length} | Iterations: ${iterations.length}`,
    company: existingProfile.name,
    quality_score: finalEval.quality_score,
    fabrication: finalFab.verdict,
    capabilities: Object.keys(finalDraft.capabilities || {}).length,
    iterations: iterations.length,
  });

  return { profile, aborted: false };
}
