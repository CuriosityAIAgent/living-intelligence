/**
 * scheduler.js — Daily pipeline orchestrator
 *
 * Flow:
 *   autoDiscover() → intelCandidates + tlCandidates + knownCompanyIds
 *   → process top 10 intelligence candidates through intake → governance → scorer
 *   → PUBLISH (score ≥ 75): auto-publish + git push
 *   → REVIEW  (score 65–74): pending queue + Telegram link
 *   → BLOCK   (score < 65 or fabricated): permanently block URL
 *   → detect new companies (entry.company not in knownCompanyIds)
 *   → sendDigest(published, pending, blocked, errors, newCompanies, tlCandidates)
 */

import { autoDiscover } from './auto-discover.js';
import { processUrl } from './intake.js';
import { verify } from './governance.js';
import { scoreEntry, formatScoreBreakdown } from './scorer.js';
import { publish, commitAndPush } from './publisher.js';
import { addPending, addBlocked, isBlocked } from './gov-store.js';
import { sendDigest } from './notifier.js';

// ── Review threshold ──────────────────────────────────────────────────────────
// PUBLISH ≥ 75  |  REVIEW 65–74  |  BLOCK < 65
// Raised from 50 to 65 to reduce low-confidence items reaching the review queue.
const REVIEW_THRESHOLD = 65;

// No-op send for internal pipeline (we collect results ourselves)
function makeSink() {
  const logs = [];
  const send = (event, data) => logs.push({ event, data });
  return { send, logs };
}

/**
 * Run the full daily pipeline.
 * Returns a summary object: { published, pending, blocked, errors, newCompanies, tlCandidates }
 */
export async function runDailyPipeline() {
  console.log(`[scheduler] Daily pipeline started at ${new Date().toISOString()}`);

  const published    = [];
  const pending      = [];
  const blocked      = [];
  const errors       = [];
  const newCompanies = []; // companies discovered but not in the landscape

  // ── 1. Discover candidates ─────────────────────────────────────────────────
  let intelCandidates = [];
  let tlCandidates    = [];
  let knownCompanyIds   = new Set(); // landscape IDs e.g. "jump-ai"
  let knownCompanyNames = new Set(); // landscape display names lowercased e.g. "jump", "lpl financial"

  try {
    const { send, logs } = makeSink();
    await autoDiscover({ send });

    const doneEvent = logs.find(l => l.event === 'done');
    intelCandidates = doneEvent?.data?.intelCandidates || [];
    tlCandidates    = doneEvent?.data?.tlCandidates    || [];
    knownCompanyIds   = doneEvent?.data?.knownCompanyIds   || new Set();
    knownCompanyNames = doneEvent?.data?.knownCompanyNames || new Set();

    const sources = doneEvent?.data?.sources || {};
    console.log(`[scheduler] Discovery: L1 news=${sources.layer1_news} L2 cos=${sources.layer2_companies} (${sources.companies_queried} cos) L1 TL=${sources.layer1_tl} L2 auth=${sources.layer2_authors}`);
  } catch (err) {
    console.error('[scheduler] autoDiscover failed:', err.message);
    errors.push({ stage: 'discover', message: err.message });
  }

  const top10 = intelCandidates.slice(0, 10);
  console.log(`[scheduler] ${top10.length} intel candidates to process, ${tlCandidates.length} TL candidates`);

  // ── 2. Process each intelligence candidate ─────────────────────────────────
  const publishedIds = [];

  for (const candidate of top10) {
    const url = candidate.url;

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

      // Step 3: score
      const scored = await scoreEntry({
        entry:      intakeResult.entry,
        governance: govAudit,
        sourceUrl:  url,
      });

      // Override action with raised REVIEW threshold (65 instead of default 50)
      if (scored.action !== 'BLOCK') {
        scored.action = scored.score >= 75 ? 'PUBLISH' : scored.score >= REVIEW_THRESHOLD ? 'REVIEW' : 'BLOCK';
        // Re-apply paywall caveat downgrade
        if (scored.action === 'PUBLISH' && govAudit.paywall_caveat) scored.action = 'REVIEW';
      }

      console.log(`[scheduler] Score ${scored.score}/100 → ${scored.action}: ${intakeResult.entry.headline}`);

      // ── New company detection ──────────────────────────────────────────────
      // If the entry references a company not in our landscape, flag it.
      const entryCompanyId   = (intakeResult.entry.company      || '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
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
        addBlocked(url, intakeResult.entry.id, reason);
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
          id:                intakeResult.entry.id,
          title:             intakeResult.entry.headline || candidate.title,
          company_name:      intakeResult.entry.company_name,
          score:             scored.score,
          score_breakdown:   formatScoreBreakdown(scored),
          unverified_claims: govResult.unverified_claims || [],
          paywall_caveat:    govAudit.paywall_caveat,
          notes:             govResult.notes || '',
        });
        console.log(`[scheduler] REVIEW → pending: ${intakeResult.entry.id}`);
        continue;
      }

      // ── PUBLISH ────────────────────────────────────────────────────────────
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

  // ── 3. Commit + push published entries to main ─────────────────────────────
  if (publishedIds.length > 0) {
    let gitError = null;
    const gitSend = (type, data) => {
      if (type === 'error') gitError = data.message;
    };
    try {
      commitAndPush({ ids: publishedIds, send: gitSend, branch: 'main' });
      if (gitError) throw new Error(gitError);
      console.log(`[scheduler] Pushed ${publishedIds.length} entries to main`);
    } catch (err) {
      console.error('[scheduler] Git push failed:', err.message);
      errors.push({
        stage:   'git_push',
        message: `⚠️ Git push FAILED — ${publishedIds.length} entries written but NOT deployed. Check GIT_TOKEN. IDs: ${publishedIds.join(', ')}. Error: ${err.message}`,
      });
    }
  }

  // ── 4. Send daily digest ───────────────────────────────────────────────────
  const results = { published, pending, blocked, errors, newCompanies, tlCandidates };

  try {
    await sendDigest(results);
    console.log('[scheduler] Digest sent');
  } catch (err) {
    console.error('[scheduler] Failed to send digest:', err.message);
    errors.push({ stage: 'email', message: err.message });
  }

  console.log(`[scheduler] Done. published=${published.length} pending=${pending.length} blocked=${blocked.length} new_cos=${newCompanies.length} tl_candidates=${tlCandidates.length} errors=${errors.length}`);
  return results;
}
