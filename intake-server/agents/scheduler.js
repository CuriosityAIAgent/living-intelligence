/**
 * scheduler.js — Daily pipeline orchestrator
 *
 * Flow:
 *   autoDiscover() → intelCandidates + tlCandidates + knownCompanyIds
 *   → process top 15 intelligence candidates through intake → governance → scorer
 *   → PUBLISH (score ≥ 75): auto-publish + git push
 *   → REVIEW  (score 60–74): pending queue + Telegram link
 *   → BLOCK   (score < 60 or fabricated): permanently block URL
 *   → entity+event dedup: same company + same type within 14 days → REVIEW with duplicate note
 *   → detect new companies (entry.company not in knownCompanyIds)
 *   → sendDigest(published, pending, blocked, errors, newCompanies, tlCandidates)
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { autoDiscover } from './auto-discover.js';
import { processUrl } from './intake.js';
import { enrichContext } from './context-enricher.js';
import { verify } from './governance.js';
import { checkFabrication } from './fabrication-strict.js';
import { validateFormat } from './format-validator.js';
import { scoreEntry, formatScoreBreakdown } from './scorer.js';
import { addPending, addBlocked, isBlocked, isTopicSuppressed, writePipelineStatus } from './gov-store.js';
import { commitInboxState } from './publisher.js';
import { sendDigest } from './notifier.js';
import { INTEL_DIR, THRESHOLDS } from './config.js';
import { logPipelineRun, logPipelineEvent, storeBrief, upsertSource } from './kb-client.js';

// ── Review threshold ───────────────────────────────────────────────────────────
// PUBLISH ≥ 75  |  REVIEW 60–74  |  BLOCK < 60
// Full score breakdown: A: Source (0-25) + B: Claims (0-25) + C: Fresh (0-10) + D: Impact (0-40)
const REVIEW_THRESHOLD = THRESHOLDS.REVIEW;

// ── Entity+event dedup ────────────────────────────────────────────────────────
// Prevents the same funding round / acquisition / event type from re-surfacing
// within 14 days. Builds a map of company:type → most recent published_at date
// from the existing data/intelligence/*.json files.

function buildEntityEventMap() {
  const map = new Map(); // key: "company_id:type" → latest published_at millis
  try {
    for (const f of readdirSync(INTEL_DIR).filter(f => f.endsWith('.json'))) {
      try {
        const e = JSON.parse(readFileSync(join(INTEL_DIR, f), 'utf8'));
        const key = `${(e.company || '').toLowerCase()}:${e.type}`;
        const ts  = new Date(e.published_at || e.date || 0).getTime();
        if (!map.has(key) || ts > map.get(key)) map.set(key, ts);
      } catch (_) {}
    }
  } catch (_) {}
  return map;
}

function isDuplicateEvent(entry, entityEventMap) {
  const company = (entry.company || '').toLowerCase();
  const type    = entry.type;
  if (!company || !type) return false;
  const key = `${company}:${type}`;
  const lastTs = entityEventMap.get(key);
  if (!lastTs) return false;
  const ageDays = (Date.now() - lastTs) / 86400000;
  return ageDays <= 14;
}

// No-op send for internal pipeline (we collect results ourselves)
function makeSink() {
  const logs = [];
  const send = (event, data) => logs.push({ event, data });
  return { send, logs };
}

/**
 * Run the full daily pipeline.
 * Returns a summary object: { published, pending, blocked, errors, newCompanies, tlCandidates }
 *
 * NOTE: Nothing auto-publishes. All scored stories (PASS and REVIEW) go to the
 * editorial inbox for human sign-off. 'published' array will always be empty
 * from this function — it's kept for interface compatibility with sendDigest.
 */
export async function runDailyPipeline() {
  const startedAt = new Date().toISOString();
  console.log(`[scheduler] Daily pipeline started at ${startedAt}`);

  // PRINCIPLE 8: Log pipeline run to KB
  const runId = await logPipelineRun({
    tier: 'tier1_auto',
    started_at: startedAt,
  });

  const published    = []; // always empty — nothing auto-publishes
  const pending      = [];
  const blocked      = [];
  const errors       = [];
  const newCompanies = [];

  // ── 1. Discover candidates ─────────────────────────────────────────────────
  let intelCandidates = [];
  let tlCandidates    = [];
  let knownCompanyIds   = new Set(); // landscape IDs e.g. "jump-ai"
  let knownCompanyNames = new Set(); // landscape display names lowercased e.g. "jump", "lpl financial"
  let discoverySources  = {};        // layer breakdown for pipeline status

  try {
    const { send, logs } = makeSink();
    await autoDiscover({ send });

    const doneEvent = logs.find(l => l.event === 'done');
    intelCandidates = doneEvent?.data?.intelCandidates || [];
    tlCandidates    = doneEvent?.data?.tlCandidates    || [];
    knownCompanyIds   = doneEvent?.data?.knownCompanyIds   || new Set();
    knownCompanyNames = doneEvent?.data?.knownCompanyNames || new Set();

    discoverySources = doneEvent?.data?.sources || {};
    console.log(`[scheduler] Discovery: L1 news=${discoverySources.layer1_news} L1 caps=${discoverySources.layer1_capabilities} (${discoverySources.capabilities_queried} dims) L2 cos=${discoverySources.layer2_companies} (${discoverySources.companies_queried} cos) L3 newsapi=${discoverySources.layer3_newsapi || 0} L1 TL=${discoverySources.layer1_tl} L2 auth=${discoverySources.layer2_authors}`);
  } catch (err) {
    console.error('[scheduler] autoDiscover failed:', err.message);
    errors.push({ stage: 'discover', message: err.message });
  }

  // Build entity+event dedup map from existing entries
  const entityEventMap = buildEntityEventMap();

  const top15 = intelCandidates.slice(0, 15);
  console.log(`[scheduler] ${top15.length} intel candidates to process, ${tlCandidates.length} TL candidates`);

  // ── 2. Process each intelligence candidate ─────────────────────────────────

  for (const candidate of top15) {
    const url = candidate.url;

    if (isBlocked(url)) {
      console.log(`[scheduler] Skipping blocked URL: ${url}`);
      continue;
    }

    console.log(`[scheduler] Processing: ${candidate.title}`);

    try {
      const { send } = makeSink();

      // Step 1: fetch + structure
      let intakeStart = Date.now();
      const intakeResult = await processUrl({
        url,
        source_name: candidate.source_name || 'Unknown',
        send,
      });

      if (!intakeResult) {
        await logPipelineEvent({ run_id: runId, agent: 'intake', latency_ms: Date.now() - intakeStart, error: 'processUrl returned null' });
        errors.push({ url, stage: 'intake', message: 'processUrl returned null' });
        continue;
      }
      await logPipelineEvent({ run_id: runId, agent: 'intake', entry_id: intakeResult.entry?.id, latency_ms: Date.now() - intakeStart });

      // Topic suppression — company+type rejected 2+ times with same reason → skip
      const entryCompanyId = (intakeResult.entry.company || '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const entryType = intakeResult.entry.type;
      if (entryCompanyId && entryType && isTopicSuppressed(entryCompanyId, entryType)) {
        console.log(`[scheduler] Skipping suppressed topic ${entryCompanyId}:${entryType}`);
        blocked.push({ url, reason: `Topic suppressed: ${intakeResult.entry.company_name || entryCompanyId} / ${entryType}` });
        addBlocked(url, intakeResult.entry.id || url, `Topic suppressed: ${entryCompanyId}:${entryType}`);
        continue;
      }

      // Entity+event dedup — same company + same event type within 14 days → REVIEW
      if (isDuplicateEvent(intakeResult.entry, entityEventMap)) {
        const dupNote = `Possible duplicate: ${intakeResult.entry.company_name || intakeResult.entry.company} already has a ${intakeResult.entry.type} entry within the last 14 days`;
        console.log(`[scheduler] Entity+event dup → REVIEW: ${dupNote}`);
        const govAuditDup = {
          verdict:           'REVIEW',
          confidence:        50,
          verified_claims:   [],
          unverified_claims: [dupNote],
          fabricated_claims: [],
          notes:             dupNote,
          paywall_caveat:    false,
          verified_at:       new Date().toISOString(),
          human_approved:    false,
        };
        intakeResult.entry._governance = govAuditDup;
        addPending(intakeResult.entry, govAuditDup);
        pending.push({
          id:                intakeResult.entry.id,
          title:             intakeResult.entry.headline || candidate.title,
          company_name:      intakeResult.entry.company_name,
          score:             0,
          score_breakdown:   'Duplicate check',
          unverified_claims: [dupNote],
          paywall_caveat:    false,
          notes:             dupNote,
        });
        continue;
      }

      // Step 1b: context enrichment — regenerate the_so_what with landscape context
      try {
        const enriched = await enrichContext({
          entry: intakeResult.entry,
          articleMarkdown: intakeResult.markdown,
        });
        // Replace blind the_so_what with context-aware version
        intakeResult.entry.the_so_what = enriched.the_so_what;
        intakeResult.entry._enrichment = {
          what_changed: enriched.what_changed,
          landscape_context: enriched.landscape_context,
          confidence: enriched.enrichment_confidence,
          notes: enriched.enrichment_notes,
        };
        console.log(`[scheduler] Context enriched (${enriched.enrichment_confidence}): ${intakeResult.entry.id}`);
      } catch (enrichErr) {
        console.error(`[scheduler] Context enrichment failed: ${enrichErr.message}`);
        // Non-fatal — continue with original the_so_what
      }

      // Step 2a: format validation (pure rules, no API cost)
      const formatResult = validateFormat(intakeResult.entry);
      if (!formatResult.valid) {
        console.log(`[scheduler] Format issues for ${intakeResult.entry.id}: ${formatResult.errors.join(', ')}`);
        // Don't block — format errors route to REVIEW with annotation
        intakeResult.entry._format_errors = formatResult.errors;
      }

      // Step 2b: governance verification (6k→12k window)
      const govStart = Date.now();
      const { send: govSend } = makeSink();
      const govResult = await verify({
        entry: intakeResult.entry,
        sourceMarkdown: intakeResult.markdown,
        send: govSend,
      });
      await logPipelineEvent({ run_id: runId, agent: 'governance', entry_id: intakeResult.entry.id, latency_ms: Date.now() - govStart, score: { verdict: govResult.verdict, confidence: govResult.confidence } });

      const govAudit = {
        verdict:            govResult.verdict,
        confidence:         govResult.confidence,
        verified_claims:    govResult.verified_claims   || [],
        unverified_claims:  govResult.unverified_claims  || [],
        fabricated_claims:  govResult.fabricated_claims  || [],
        notes:              govResult.notes              || '',
        paywall_caveat:     govResult.paywall_caveat     || false,
        verified_at:        new Date().toISOString(),
        human_approved:     false,
      };

      intakeResult.entry._governance = govAudit;

      // Step 2c: fabrication-strict check (12k window, dedicated pass)
      const fabStart = Date.now();
      let fabricationResult = { verdict: 'SUSPECT', issues: ['Not checked'], checked_at: new Date().toISOString() };
      try {
        fabricationResult = await checkFabrication({
          entry: intakeResult.entry,
          sourceMarkdown: intakeResult.markdown,
        });
        console.log(`[scheduler] Fabrication check: ${fabricationResult.verdict} for ${intakeResult.entry.id}`);
        await logPipelineEvent({ run_id: runId, agent: 'fabrication', entry_id: intakeResult.entry.id, latency_ms: Date.now() - fabStart, score: { verdict: fabricationResult.verdict } });
      } catch (fabErr) {
        console.error(`[scheduler] Fabrication check failed: ${fabErr.message}`);
        await logPipelineEvent({ run_id: runId, agent: 'fabrication', entry_id: intakeResult.entry.id, latency_ms: Date.now() - fabStart, error: fabErr.message });
      }
      intakeResult.entry._fabrication = fabricationResult;

      // Hard block on FAIL fabrication verdict
      if (fabricationResult.verdict === 'FAIL') {
        const reason = `Fabrication detected: ${fabricationResult.issues.join('; ')}`;
        const title = intakeResult.entry.headline || candidate.title;
        addBlocked(url, intakeResult.entry.id, reason, { title, score: 0 });
        blocked.push({ url, title, reason, score: 0 });
        console.log(`[scheduler] FABRICATION FAIL → BLOCK: ${url}`);
        continue;
      }

      // Step 3: score
      const scoreStart = Date.now();
      const scored = await scoreEntry({
        entry:      intakeResult.entry,
        governance: govAudit,
        sourceUrl:  url,
      });
      await logPipelineEvent({ run_id: runId, agent: 'scorer', entry_id: intakeResult.entry.id, latency_ms: Date.now() - scoreStart, score: { score: scored.score, action: scored.action } });

      // Override action with raised REVIEW threshold (65 instead of default 50)
      if (scored.action !== 'BLOCK') {
        scored.action = scored.score >= 75 ? 'PUBLISH' : scored.score >= REVIEW_THRESHOLD ? 'REVIEW' : 'BLOCK';
        // Re-apply paywall caveat downgrade
        if (scored.action === 'PUBLISH' && govAudit.paywall_caveat) scored.action = 'REVIEW';
      }

      console.log(`[scheduler] Score ${scored.score}/100 → ${scored.action}: ${intakeResult.entry.headline}`);

      // ── New company detection ──────────────────────────────────────────────
      // If the entry references a company not in our landscape, flag it.
      const entryCompanyName = (intakeResult.entry.company_name || '').toLowerCase();
      // Match by ID, by name, or by partial ID (e.g. "jump" matches "jump-ai")
      const isKnown = knownCompanyIds.has(entryCompanyId)
        || knownCompanyNames.has(entryCompanyName)
        || [...knownCompanyIds].some(id => id.length >= 3 && (id.startsWith(entryCompanyId) || entryCompanyId.startsWith(id)));
      if (entryCompanyId && !isKnown) {
        const companyName = intakeResult.entry.company_name || intakeResult.entry.company || entryCompanyId;
        // Only flag if it's not a generic catch-all ID
        if (entryCompanyId.length > 2 && !['unknown', 'other', 'various'].includes(entryCompanyId)) {
          const alreadyFlagged = newCompanies.some(c => c.id === entryCompanyId);
          if (!alreadyFlagged) {
            newCompanies.push({
              id:   entryCompanyId,
              name: companyName,
              url,
              headline: intakeResult.entry.headline,
            });
          }
        }
      }

      // ── BLOCK ──────────────────────────────────────────────────────────────
      if (scored.action === 'BLOCK') {
        const reason = scored.reason || `Score ${scored.score}/100 — below ${REVIEW_THRESHOLD} review threshold`;
        addBlocked(url, intakeResult.entry.id, reason, { title: intakeResult.entry.headline, score: scored.score });
        blocked.push({
          url,
          title:  intakeResult.entry.headline || candidate.title,
          reason,
          score:  scored.score,
        });
        console.log(`[scheduler] BLOCK: ${url}`);
        continue;
      }

      // ── REVIEW ─────────────────────────────────────────────────────────────
      if (scored.action === 'REVIEW') {
        addPending(intakeResult.entry, govAudit);
        pending.push({
          id:                  intakeResult.entry.id,
          title:               intakeResult.entry.headline || candidate.title,
          company_name:        intakeResult.entry.company_name,
          score:               scored.score,
          score_breakdown:     formatScoreBreakdown(scored),
          unverified_claims:   govResult.unverified_claims || [],
          paywall_caveat:      govAudit.paywall_caveat,
          notes:               govResult.notes || '',
          fabrication_verdict: fabricationResult.verdict,
          fabrication_issues:  fabricationResult.issues,
          format_errors:       intakeResult.entry._format_errors || [],
          enrichment:          intakeResult.entry._enrichment || null,
        });
        console.log(`[scheduler] REVIEW → pending: ${intakeResult.entry.id}`);
        continue;
      }

      // ── INBOX (was PUBLISH) ────────────────────────────────────────────────
      // All stories — including high-scoring PASS entries — go to the editorial
      // inbox for human review. Nothing publishes automatically.
      addPending(intakeResult.entry, govAudit, {
        score:           scored.score,
        score_breakdown: formatScoreBreakdown(scored),
      });
      pending.push({
        id:                  intakeResult.entry.id,
        title:               intakeResult.entry.headline || candidate.title,
        company_name:        intakeResult.entry.company_name,
        score:               scored.score,
        score_breakdown:     formatScoreBreakdown(scored),
        unverified_claims:   govResult.unverified_claims || [],
        paywall_caveat:      govAudit.paywall_caveat,
        notes:               govResult.notes || '',
        governance_verdict:  govAudit.verdict,
        fabrication_verdict: fabricationResult.verdict,
        fabrication_issues:  fabricationResult.issues,
        format_errors:       intakeResult.entry._format_errors || [],
        enrichment:          intakeResult.entry._enrichment || null,
      });
      console.log(`[scheduler] INBOX → queued for editorial review (score ${scored.score}): ${intakeResult.entry.id}`);

      // Store as research brief in KB for v2 pipeline (Claude Code /produce picks these up)
      if (scored.score >= REVIEW_THRESHOLD) {
        setImmediate(async () => {
          try {
            // Get primary source ID (already stored by intake.js)
            const primarySourceId = intakeResult.entry._kb_source_id || null;
            const isTracked = knownCompanyIds.has(entryCompanyId) || [...knownCompanyIds].some(id => id.length >= 3 && (id.startsWith(entryCompanyId) || entryCompanyId.startsWith(id)));
            await storeBrief({
              candidate_url: url,
              company_id: isTracked ? entryCompanyId : null,
              vertical_id: 'wealth',
              entities: {
                company_name: intakeResult.entry.company_name,
                company_slug: entryCompanyId,
                capability_area: intakeResult.entry.capability_evidence?.capability || null,
                key_topic: intakeResult.entry.headline?.slice(0, 50),
                event_type: intakeResult.entry.type,
              },
              primary_source_id: primarySourceId,
              triage_score: scored.score,
              source_count: (intakeResult.entry.sources || []).length || 1,
              status: 'ready',
            });
          } catch (_) { /* non-blocking */ }
        });
      }

    } catch (err) {
      console.error(`[scheduler] Error processing ${url}:`, err.message);
      errors.push({ url, stage: 'process', message: err.message });
    }
  }

  // ── 3. Write pipeline status (for inbox dashboard) ────────────────────────
  writePipelineStatus({
    started_at:        startedAt,
    candidates_found:  top15.length,
    queued:            pending.length,
    blocked:           blocked.length,
    errors:            errors.length,
    error_details:     errors.slice(0, 10),
    discovery_sources: discoverySources,
    tl_candidates:     tlCandidates.length,
    tl_items:          tlCandidates.slice(0, 15),
    blocked_items:     blocked,
  });

  // ── 3b. Persist inbox state to git so it survives Railway redeployments ───
  commitInboxState();

  // ── 4. Send daily digest ───────────────────────────────────────────────────
  const results = { published, pending, blocked, errors, newCompanies, tlCandidates };

  try {
    await sendDigest(results);
    console.log('[scheduler] Digest sent');
  } catch (err) {
    console.error('[scheduler] Failed to send digest:', err.message);
    errors.push({ stage: 'email', message: err.message });
  }

  // PRINCIPLE 8: Update pipeline run with final counts
  if (runId) {
    const supabase = (await import('./kb-client.js')).getSupabaseClient();
    if (supabase) {
      await supabase.from('pipeline_runs').update({
        completed_at: new Date().toISOString(),
        candidates_found: top15.length,
        entries_produced: pending.length,
        errors: errors.slice(0, 20),
      }).eq('id', runId);
    }
  }

  console.log(`[scheduler] Done. published=${published.length} pending=${pending.length} blocked=${blocked.length} new_cos=${newCompanies.length} tl=${tlCandidates.length} errors=${errors.length}`);
  return results;
}
