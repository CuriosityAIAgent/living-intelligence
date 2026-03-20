/**
 * scheduler.js — Daily pipeline orchestrator
 *
 * Runs the full lights-out discovery → intake → governance → publish cycle.
 * Called by the 6 AM cron job in server.js, or directly for testing:
 *   node -e "import('./agents/scheduler.js').then(m => m.runDailyPipeline())"
 *
 * Flow:
 *   autoDiscover() → top 10 candidates (deduped, scored)
 *   → processUrl() each → PASS / REVIEW / FAIL
 *   → PASS: publish directly to main, collect for digest
 *   → REVIEW: add to pending queue, collect for digest with approve links
 *   → FAIL: block URL, log only
 *   → sendDigest(results)
 */

import { autoDiscover } from './auto-discover.js';
import { processUrl } from './intake.js';
import { verify } from './governance.js';
import { scoreEntry, formatScoreBreakdown } from './scorer.js';
import { publish, commitAndPush } from './publisher.js';
import { addPending, addBlocked, isBlocked } from './gov-store.js';
import { sendDigest } from './notifier.js';

// No-op send for internal pipeline (we collect results ourselves)
function makeSink() {
  const logs = [];
  const send = (event, data) => logs.push({ event, data });
  return { send, logs };
}

/**
 * Run the full daily pipeline.
 * Returns a summary object: { published, pending, blocked, errors }
 */
export async function runDailyPipeline() {
  console.log(`[scheduler] Daily pipeline started at ${new Date().toISOString()}`);

  const published = [];
  const pending   = [];
  const blocked   = [];
  const errors    = [];

  // ── 1. Discover candidates ─────────────────────────────────────────────────
  let candidates = [];
  try {
    const { send, logs } = makeSink();
    await autoDiscover({ send });

    // autoDiscover emits a 'done' event with { candidates }
    const doneEvent = logs.find(l => l.event === 'done');
    candidates = doneEvent?.data?.candidates || [];
  } catch (err) {
    console.error('[scheduler] autoDiscover failed:', err.message);
    errors.push({ stage: 'discover', message: err.message });
  }

  // Take top 10 (already ranked by score from autoDiscover)
  const top10 = candidates.slice(0, 10);
  console.log(`[scheduler] ${top10.length} candidates to process`);

  // ── 2. Process each candidate ──────────────────────────────────────────────
  const publishedIds = [];

  for (const candidate of top10) {
    const url = candidate.url;

    // Skip permanently blocked URLs
    if (isBlocked(url)) {
      console.log(`[scheduler] Skipping blocked URL: ${url}`);
      continue;
    }

    console.log(`[scheduler] Processing: ${candidate.title}`);

    try {
      const { send } = makeSink();

      // Step 1: fetch + structure
      const intakeResult = await processUrl({
        url,
        source_name: candidate.source_name || 'Unknown',
        send,
      });

      if (!intakeResult) {
        errors.push({ url, stage: 'intake', message: 'processUrl returned null' });
        continue;
      }

      // Step 2: governance verification
      const { send: govSend } = makeSink();
      const govResult = await verify({
        entry: intakeResult.entry,
        sourceMarkdown: intakeResult.markdown,
        send: govSend,
      });

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

      // ── Scorer: 4-dimension auto-judgment (async — Backlinks API lookup) ───
      const scored = await scoreEntry({
        entry:      intakeResult.entry,
        governance: govAudit,
        sourceUrl:  url,
      });

      console.log(`[scheduler] Score ${scored.score}/100 → ${scored.action}: ${intakeResult.entry.headline}`);

      // ── BLOCK (score < 50 or fabricated claims) ───────────────────────────
      if (scored.action === 'BLOCK') {
        const reason = scored.reason || `Score ${scored.score}/100 — below publish threshold`;
        addBlocked(url, intakeResult.entry.id, reason);
        blocked.push({
          url,
          title:  intakeResult.entry.headline || candidate.title,
          reason,
          score:  scored.score,
        });
        console.log(`[scheduler] BLOCK → blocked: ${url}`);
        continue;
      }

      // ── REVIEW (score 50–74 or paywall caveat downgrade) ──────────────────
      if (scored.action === 'REVIEW') {
        addPending(intakeResult.entry, govAudit);
        pending.push({
          id:                intakeResult.entry.id,
          title:             intakeResult.entry.headline || candidate.title,
          company_name:      intakeResult.entry.company_name,
          score:             scored.score,
          score_breakdown:   formatScoreBreakdown(scored),
          unverified_claims: govResult.unverified_claims || [],
          paywall_caveat:    govAudit.paywall_caveat,
          notes:             govResult.notes || '',
        });
        console.log(`[scheduler] REVIEW → pending queue: ${intakeResult.entry.id}`);
        continue;
      }

      // ── PUBLISH (score >= 75, all claims verified, no paywall caveat) ─────
      const { send: pubSend } = makeSink();
      const entryId = publish({ entry: intakeResult.entry, send: pubSend });
      publishedIds.push(entryId);
      published.push({
        id:           entryId,
        title:        intakeResult.entry.headline || candidate.title,
        company_name: intakeResult.entry.company_name,
        score:        scored.score,
      });
      console.log(`[scheduler] PUBLISH → auto-published: ${entryId}`);

    } catch (err) {
      console.error(`[scheduler] Error processing ${url}:`, err.message);
      errors.push({ url, stage: 'process', message: err.message });
    }
  }

  // ── 3. Commit + push published entries to main ────────────────────────────
  if (publishedIds.length > 0) {
    try {
      const { send } = makeSink();
      commitAndPush({ ids: publishedIds, send, branch: 'main' });
      console.log(`[scheduler] Pushed ${publishedIds.length} entries to main`);
    } catch (err) {
      console.error('[scheduler] Git push failed:', err.message);
      errors.push({ stage: 'git', message: err.message });
    }
  }

  // ── 4. Send daily digest ───────────────────────────────────────────────────
  const results = { published, pending, blocked, errors };

  try {
    await sendDigest(results);
    console.log('[scheduler] Digest sent');
  } catch (err) {
    console.error('[scheduler] Failed to send digest:', err.message);
    errors.push({ stage: 'email', message: err.message });
  }

  console.log(`[scheduler] Done. published=${published.length} pending=${pending.length} blocked=${blocked.length} errors=${errors.length}`);
  return results;
}
