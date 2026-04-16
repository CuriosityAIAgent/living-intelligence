/**
 * scheduler.js — Daily pipeline orchestrator (v2 unified)
 *
 * Flow:
 *   autoDiscover() → intelCandidates + tlCandidates + knownCompanyIds
 *   → dedup check (Supabase briefs) + freshness filter (7d news, 30d strategic)
 *   → research-agent: multi-source research → rich brief stored to Supabase
 *   → topic suppression check (post-hoc, uses research entities)
 *   → detect new companies (entry.company not in knownCompanyIds)
 *   → sendDigest(published, pending, blocked, errors, newCompanies, tlCandidates)
 *
 * Phase 2 (Remote Trigger or content-producer.js) picks up ready briefs,
 * runs writer → evaluator → fabrication → scoring. This file only does
 * discovery + research.
 */

import { autoDiscover } from './auto-discover.js';
import { research } from './research-agent.js';
import { addBlocked, isBlocked, isTopicSuppressed, writePipelineStatus } from './gov-store.js';
import { commitInboxState } from './publisher.js';
import { sendDigest } from './notifier.js';
// THRESHOLDS and PRESS_RELEASE_DOMAINS removed — no longer used in v2 scheduler
import { logPipelineRun, logPipelineEvent, briefExistsForUrl, updateBriefStatus } from './kb-client.js';

// ── Freshness thresholds ──────────────────────────────────────────────────────
const NEWS_FRESHNESS_DAYS = 7;
const STRATEGIC_FRESHNESS_DAYS = 30;

// Strategic content indicators (reports, white papers, research — not daily news)
function isStrategicContent(candidate) {
  const title = (candidate.title || '').toLowerCase();
  const url = (candidate.url || '').toLowerCase();
  return /report|white\s*paper|research|study|survey|outlook|forecast|annual|quarterly/i.test(title)
    || /\.pdf|\/reports?\//i.test(url);
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

  const top15 = intelCandidates.slice(0, 15);
  console.log(`[scheduler] ${top15.length} intel candidates to process, ${tlCandidates.length} TL candidates`);

  // ── 2. Research each intelligence candidate ────────────────────────────────
  // v2 unified pipeline: dedup → freshness → research-agent → rich brief to Supabase
  // No governance, scoring, or fabrication here — Phase 2 (Remote Trigger) handles that.

  let skippedDedup = 0;
  let skippedFreshness = 0;
  let skippedBlocked = 0;
  let researchAborted = 0;

  for (const candidate of top15) {
    const url = candidate.url;

    // ── Check 1: Blocked URL ─────────────────────────────────────────────────
    if (isBlocked(url)) {
      console.log(`[scheduler] Skipping blocked URL: ${url}`);
      skippedBlocked++;
      continue;
    }

    // ── Check 2: Brief already exists in Supabase ────────────────────────────
    const existingBrief = await briefExistsForUrl(url);
    if (existingBrief) {
      console.log(`[scheduler] Skipping — brief already exists (${existingBrief.status}): ${url}`);
      skippedDedup++;
      continue;
    }

    // ── Check 3: Freshness filter ────────────────────────────────────────────
    if (candidate.pub_date) {
      const articleAge = (Date.now() - new Date(candidate.pub_date).getTime()) / 86400000;
      const maxAge = isStrategicContent(candidate) ? STRATEGIC_FRESHNESS_DAYS : NEWS_FRESHNESS_DAYS;
      if (articleAge > maxAge) {
        console.log(`[scheduler] Skipping old article (${Math.round(articleAge)}d, max ${maxAge}d): ${candidate.title?.slice(0, 60)}`);
        skippedFreshness++;
        continue;
      }
    }

    // ── Step 4: Deep research ────────────────────────────────────────────────
    console.log(`[scheduler] Researching: ${candidate.title?.slice(0, 80)}`);

    try {
      const { send: researchSend } = makeSink();
      const researchStart = Date.now();

      const brief = await research({
        url,
        title: candidate.title || '',
        source_name: candidate.source_name || 'Unknown',
        send: researchSend,
      });

      const latency = Date.now() - researchStart;

      if (brief.aborted) {
        console.log(`[scheduler] Research aborted (${Math.round(latency / 1000)}s): ${brief.reason}`);
        await logPipelineEvent({ run_id: runId, agent: 'research', latency_ms: latency, error: brief.reason });
        blocked.push({ url, title: candidate.title, reason: `Research aborted: ${brief.reason}` });
        researchAborted++;
        continue;
      }

      await logPipelineEvent({
        run_id: runId,
        agent: 'research',
        entry_id: brief.brief_id || null,
        latency_ms: latency,
        score: { source_count: brief.source_count, confidence: brief.research_confidence },
      });

      console.log(`[scheduler] Research complete (${Math.round(latency / 1000)}s): ${brief.source_count} sources, confidence ${brief.research_confidence}`);

      // ── Check 5: Topic suppression (post-hoc, using research entities) ───
      const companySlug = (brief.entities?.company_slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const capArea = brief.entities?.capability_area || '';
      if (companySlug && capArea && isTopicSuppressed(companySlug, capArea)) {
        console.log(`[scheduler] Suppressed topic ${companySlug}:${capArea} — marking brief as blocked`);
        if (brief.brief_id) {
          await updateBriefStatus(brief.brief_id, 'blocked', {
            decision: 'SUPPRESSED',
            decision_reason: `Topic suppressed: ${companySlug}:${capArea}`,
            decided_by: 'scheduler',
            decided_at: new Date().toISOString(),
          });
        }
        addBlocked(url, brief.brief_id || url, `Topic suppressed: ${companySlug}:${capArea}`);
        blocked.push({ url, title: candidate.title, reason: `Topic suppressed: ${companySlug}/${capArea}` });
        continue;
      }

      // ── Step 6: New company detection ──────────────────────────────────────
      const companyName = (brief.entities?.company_name || '').toLowerCase();
      const isKnown = knownCompanyIds.has(companySlug)
        || knownCompanyNames.has(companyName)
        || [...knownCompanyIds].some(id => id.length >= 3 && (id.startsWith(companySlug) || companySlug.startsWith(id)));
      if (companySlug && !isKnown && companySlug.length > 2 && !['unknown', 'other', 'various'].includes(companySlug)) {
        const alreadyFlagged = newCompanies.some(c => c.id === companySlug);
        if (!alreadyFlagged) {
          newCompanies.push({
            id: companySlug,
            name: brief.entities?.company_name || companySlug,
            url,
            headline: candidate.title,
          });
        }
      }

      // ── Track for digest ───────────────────────────────────────────────────
      pending.push({
        id: brief.brief_id || url,
        title: candidate.title || brief.entities?.key_topic || url,
        company_name: brief.entities?.company_name || '',
        source_count: brief.source_count || 1,
        confidence: brief.research_confidence || 'unknown',
      });

    } catch (err) {
      console.error(`[scheduler] Error researching ${url}:`, err.message);
      errors.push({ url, stage: 'research', message: err.message });
    }
  }

  console.log(`[scheduler] Research phase: ${pending.length} briefs created, ${skippedDedup} dedup, ${skippedFreshness} stale, ${skippedBlocked} blocked, ${researchAborted} aborted, ${errors.length} errors`);

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
