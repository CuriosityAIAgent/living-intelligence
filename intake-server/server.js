import 'dotenv/config';

// Sanitise env vars at process start — strips Railway's " =" prefix quirk
if (process.env.MAIL_HOST) process.env.MAIL_HOST = process.env.MAIL_HOST.replace(/^[\s=]+/, '').trim();
if (process.env.MAIL_USER) process.env.MAIL_USER = process.env.MAIL_USER.replace(/^[\s=]+/, '').trim();
if (process.env.MAIL_PASS) process.env.MAIL_PASS = process.env.MAIL_PASS.replace(/^[\s=]+/, '').trim();

import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cron from 'node-cron';
import { autoDiscover } from './agents/auto-discover.js';
import { processUrl } from './agents/intake.js';
import { verify } from './agents/governance.js';
import { publish, commitAndPush } from './agents/publisher.js';
import {
  getPending, addPending, approvePending, rejectPending,
  getBlocked, addBlocked, isBlocked, removeBlocked,
  getRejectionLog, addRejectionLog, readPipelineStatus, readPipelineHistory,
  getArchive, archiveStaleItems,
  isTopicSuppressed, suppressTopic, getSuppressedTopics,
} from './agents/gov-store.js';
import { runDailyPipeline } from './agents/scheduler.js';
import { signToken, verifyToken } from './agents/notifier.js';
import { runFastAudit, runDeepAudit } from './agents/auditor.js';
import {
  checkLandscapeImpact, getLandscapeSuggestions,
  applyLandscapeSuggestion, dismissLandscapeSuggestion,
} from './agents/landscape-trigger.js';
import { runLandscapeSweep, getStaleList } from './agents/landscape-sweep.js';
import { publishTlEntry } from './agents/tl-publisher.js';
import { runTLDiscover, getTLCandidates, dismissTLCandidate } from './agents/tl-discover.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const app = express();
app.use(express.json());

// ── Basic Auth — protects the entire studio ────────────────────────────────
const STUDIO_USER = process.env.STUDIO_USER;
const STUDIO_PASS = process.env.STUDIO_PASS;
if (STUDIO_USER && STUDIO_PASS) {
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      res.set('WWW-Authenticate', 'Basic realm="Editorial Studio"');
      return res.status(401).send('Authentication required');
    }
    const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    if (user === STUDIO_USER && pass === STUDIO_PASS) return next();
    res.set('WWW-Authenticate', 'Basic realm="Editorial Studio"');
    return res.status(401).send('Invalid credentials');
  });
}

app.use(express.static(join(__dirname, 'public')));

const PORT = process.env.INTAKE_PORT || 3003;

// ─── SSE helper ──────────────────────────────────────────────────────────────

function createSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const done = () => res.end();

  return { send, done };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Auto-discover: two-layer discovery (Layer 1 broad + Layer 2 per-company), deduped and ranked
app.post('/api/auto-discover', async (req, res) => {
  const { send, done } = createSSE(res);
  try {
    await autoDiscover({ send });
  } catch (err) {
    send('error', { message: err.message });
  }
  done();
});

// Search the web via Jina s.jina.ai and return candidates
app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  const { send, done } = createSSE(res);

  if (!query) {
    send('error', { message: 'Query is required' });
    done();
    return;
  }

  try {
    send('status', { message: `Searching: "${query}"...` });

    const headers = { 'Accept': 'application/json' };
    if (process.env.JINA_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
    }

    const response = await fetch(
      `https://s.jina.ai/${encodeURIComponent(query)}`,
      { headers, signal: AbortSignal.timeout(30000) }
    );

    if (!response.ok) throw new Error(`Jina Search returned HTTP ${response.status}`);

    const data = await response.json();
    const results = data.data || [];

    const candidates = results
      .filter(r => r.url)
      .map(r => {
        let hostname = '';
        try { hostname = new URL(r.url).hostname.replace(/^www\./, ''); } catch (_) {}
        return {
          id: Buffer.from(r.url).toString('base64').slice(0, 12),
          title: r.title || r.url,
          url: r.url,
          source_name: hostname || 'Web',
          pub_date: r.date || new Date().toISOString(),
          snippet: (r.description || r.content || '').slice(0, 300),
          selected: true,
          via: 'jina_search',
        };
      });

    send('done', { candidates, total: candidates.length, query });
  } catch (err) {
    send('error', { message: err.message });
  }

  done();
});

// Legacy discover route — now an alias for /api/auto-discover
app.post('/api/discover', async (req, res) => {
  const { send, done } = createSSE(res);
  try {
    await autoDiscover({ send });
  } catch (err) {
    send('error', { message: err.message });
  }
  done();
});

// Process a single URL: fetch → structure → governance
// FAIL  → permanently blocked, cannot be re-submitted
// REVIEW → held in pending queue, requires human approval before publish
// PASS  → entry returned with _governance audit, ready to publish
app.post('/api/process-url', async (req, res) => {
  const { url, source_name } = req.body;
  const { send, done } = createSSE(res);

  if (!url) {
    send('error', { message: 'URL is required' });
    done();
    return;
  }

  // Block permanently-failed URLs
  if (isBlocked(url)) {
    const blocked = getBlocked();
    send('blocked', {
      message: `This URL was permanently blocked by governance: ${blocked[url]?.reason || 'FAIL verdict'}`,
      blocked_at: blocked[url]?.blocked_at,
    });
    done();
    return;
  }

  // Dedup: check if this URL is already published
  {
    const { INTEL_DIR } = await import('./agents/config.js');
    const { readdirSync, readFileSync } = await import('fs');
    try {
      const published = readdirSync(INTEL_DIR).filter(f => f.endsWith('.json'));
      for (const f of published) {
        const entry = JSON.parse(readFileSync(`${INTEL_DIR}/${f}`, 'utf8'));
        if (entry.source_url && entry.source_url.toLowerCase().replace(/\/$/, '') === url.toLowerCase().replace(/\/$/, '')) {
          send('blocked', { message: `Already published: "${entry.headline}" (${f})` });
          done();
          return;
        }
      }
    } catch (_) {}
  }

  try {
    // Step 1: fetch + structure
    const intakeResult = await processUrl({ url, source_name: source_name || 'Unknown', send });
    if (!intakeResult) { done(); return; }

    // Step 2: governance verification
    send('status', { message: 'Running governance check...' });
    const govResult = await verify({
      entry: intakeResult.entry,
      sourceMarkdown: intakeResult.markdown,
      send,
    });

    // Fix 2: Build governance audit record (will be stored inside the JSON file)
    const govAudit = {
      verdict: govResult.verdict,
      confidence: govResult.confidence,
      verified_claims: govResult.verified_claims || [],
      unverified_claims: govResult.unverified_claims || [],
      fabricated_claims: govResult.fabricated_claims || [],
      notes: govResult.notes || '',
      paywall_caveat: govResult.paywall_caveat || false,
      verified_at: new Date().toISOString(),
      human_approved: false,
    };

    // Fix 4: FAIL → permanently block this URL
    if (govResult.verdict === 'FAIL') {
      addBlocked(url, intakeResult.entry.id, govResult.notes || 'Governance FAIL verdict');
      send('blocked', {
        message: 'Entry failed governance — URL permanently blocked. Fabricated or contradicted claims detected.',
        fabricated_claims: govResult.fabricated_claims,
        notes: govResult.notes,
      });
      done();
      return;
    }

    // Attach governance audit to the entry object
    intakeResult.entry._governance = govAudit;

    // Step 3: Score the entry (same as scheduler — no bypass)
    send('status', { message: 'Scoring entry...' });
    const { scoreEntry, formatScoreBreakdown } = await import('./agents/scorer.js');
    const scored = await scoreEntry({
      entry: intakeResult.entry,
      governance: govAudit,
      sourceUrl: url,
    });

    send('status', {
      message: `Score: ${scored.score}/100 → ${scored.action}. ${formatScoreBreakdown(scored)}`,
    });

    // Block low-scoring entries (same threshold as scheduler)
    if (scored.action === 'BLOCK') {
      const reason = scored.reason || `Score ${scored.score}/100 — below review threshold`;
      addBlocked(url, intakeResult.entry.id, reason, { title: intakeResult.entry.headline, score: scored.score });
      send('blocked', {
        message: `Entry scored ${scored.score}/100 — blocked. ${reason}`,
        score: scored.score,
      });
      done();
      return;
    }

    // Paywall caveat: downgrade PUBLISH to REVIEW
    if (scored.action === 'PUBLISH' && govAudit.paywall_caveat) scored.action = 'REVIEW';

    // All PASS and REVIEW stories go to inbox
    addPending(intakeResult.entry, govAudit, { score: scored.score, score_breakdown: formatScoreBreakdown(scored) });
    send('review_queued', {
      message: scored.action === 'PUBLISH'
        ? `Score ${scored.score}/100 — queued for editorial sign-off.`
        : `Score ${scored.score}/100 (${scored.action}) — queued in inbox for review.`,
      entry_id: intakeResult.entry.id,
      score: scored.score,
      governance_verdict: govResult.verdict,
      unverified_claims: govResult.unverified_claims,
      notes: govResult.notes,
    });
    done();
    return;

    // FAIL — already blocked above; this is a safety fallback
    send('complete', {
      entry: intakeResult.entry,
      governance: govAudit,
      can_publish: false,
    });
  } catch (err) {
    send('error', { message: err.message });
  }

  done();
});

// Fix 3: Publish approved entries — enforces governance gate server-side
// Accepts only entries with _governance.verdict === 'PASS'
// or _governance.human_approved === true (REVIEW entries approved via pending queue)
app.post('/api/publish', (req, res) => {
  const { entries } = req.body;
  const { send, done } = createSSE(res);

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    send('error', { message: 'No entries provided' });
    done();
    return;
  }

  const publishedIds = [];
  const rejected = [];

  for (const entry of entries) {
    const gov = entry._governance;

    // Hard gate: reject anything without a valid governance audit
    if (!gov) {
      rejected.push({ id: entry.id, reason: 'Missing governance audit — entry was not processed through the intake pipeline' });
      continue;
    }

    const isApprovedPass = gov.verdict === 'PASS';
    const isApprovedReview = gov.verdict === 'REVIEW' && gov.human_approved === true;

    if (!isApprovedPass && !isApprovedReview) {
      rejected.push({
        id: entry.id,
        reason: gov.verdict === 'FAIL'
          ? 'Entry failed governance and is permanently blocked'
          : 'REVIEW entry requires human approval via the pending queue',
      });
      continue;
    }

    try {
      const id = publish({ entry, send });
      publishedIds.push(id);
    } catch (err) {
      send('error', { message: `Failed to publish ${entry.id}: ${err.message}` });
    }
  }

  if (rejected.length > 0) {
    send('rejected', { count: rejected.length, items: rejected });
  }

  if (publishedIds.length > 0) {
    send('status', { message: `Published ${publishedIds.length} entries. Committing to git...` });
    commitAndPush({ ids: publishedIds, send });
    // Landscape impact check for each published entry (non-blocking)
    for (const entry of entries) {
      if (publishedIds.includes(entry.id)) {
        setImmediate(() => checkLandscapeImpact(entry).catch(() => {}));
      }
    }
  } else {
    send('error', { message: 'No entries passed governance gate — nothing published.' });
  }

  done();
});

// ─── Pending queue management ─────────────────────────────────────────────────

// List all REVIEW entries waiting for human approval
app.get('/api/pending', (req, res) => {
  const pending = getPending();
  const items = Object.entries(pending).map(([id, item]) => ({
    id,
    // Full entry fields for editorial review
    headline: item.entry.headline,
    the_so_what: item.entry.the_so_what || null,
    summary: item.entry.summary || null,
    type: item.entry.type,
    date: item.entry.date,
    company_name: item.entry.company_name,
    source_name: item.entry.source_name,
    source_url: item.entry.source_url,
    key_stat: item.entry.key_stat || null,
    capability_evidence: item.entry.capability_evidence || null,
    tags: item.entry.tags || null,
    // Governance fields
    unverified_claims: item.governance.unverified_claims,
    notes: item.governance.notes,
    confidence: item.governance.confidence,
    queued_at: item.queued_at,
    // Full entry for approve flow
    _entry: item.entry,
  }));
  res.json({ count: items.length, items });
});

// Human approves a REVIEW entry — moves it out of pending and marks human_approved: true
app.post('/api/pending/:id/approve', (req, res) => {
  const entry = approvePending(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'Entry not found in pending queue' });
  }
  res.json({ ok: true, message: 'Entry approved — ready to publish via /api/publish', entry });
});

// Human rejects a REVIEW entry — moves it to the blocked list permanently
app.post('/api/pending/:id/reject', (req, res) => {
  const ok = rejectPending(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: 'Entry not found in pending queue' });
  }
  res.json({ ok: true, message: 'Entry rejected and URL permanently blocked' });
});

// ─── Editorial Inbox ──────────────────────────────────────────────────────────

// All stories queued for editorial review (PASS + REVIEW, nothing auto-publishes)
app.get('/api/inbox', (req, res) => {
  // Move stale items (>7 days) to archive before returning inbox
  archiveStaleItems();

  const pending = getPending();
  let items = Object.entries(pending).map(([id, item]) => ({
    id,
    headline:           item.entry.headline,
    the_so_what:        item.entry.the_so_what || null,
    summary:            item.entry.summary || null,
    type:               item.entry.type,
    date:               item.entry.date,
    company_name:       item.entry.company_name,
    source_name:        item.entry.source_name,
    source_url:         item.entry.source_url,
    image_url:          item.entry.image_url || null,
    key_stat:           item.entry.key_stat || null,
    capability_evidence: item.entry.capability_evidence || null,
    tags:               item.entry.tags || null,
    governance_verdict: item.governance.verdict,
    confidence:         item.governance.confidence,
    unverified_claims:  item.governance.unverified_claims || [],
    notes:              item.governance.notes || '',
    paywall_caveat:     item.governance.paywall_caveat || false,
    score:              item.score ?? null,
    score_breakdown:    item.score_breakdown ?? null,
    queued_at:          item.queued_at,
    discovered_at:      item.discovered_at || item.queued_at || null,
    _entry:             item.entry,
  }));

  // REVIEW items first (need attention), then by score descending
  items.sort((a, b) => {
    if (a.governance_verdict === 'REVIEW' && b.governance_verdict !== 'REVIEW') return -1;
    if (b.governance_verdict === 'REVIEW' && a.governance_verdict !== 'REVIEW') return 1;
    return (b.score || 0) - (a.score || 0);
  });

  const archiveCount = Object.keys(getArchive()).length;
  res.json({ count: items.length, items, archive_count: archiveCount });
});

// Archived stories (>7 days old, read-only history)
app.get('/api/inbox/archive', (req, res) => {
  const archive = getArchive();
  const items = Object.entries(archive).map(([id, item]) => ({
    id,
    headline:      item.entry.headline,
    company_name:  item.entry.company_name,
    source_name:   item.entry.source_name,
    source_url:    item.entry.source_url,
    date:          item.entry.date,
    type:          item.entry.type,
    score:         item.score ?? null,
    governance_verdict: item.governance?.verdict || null,
    discovered_at: item.discovered_at || item.queued_at || null,
  }));
  // Newest first
  items.sort((a, b) => (b.discovered_at || '').localeCompare(a.discovered_at || ''));
  res.json({ count: items.length, items });
});

// Approve + publish in one server-side call (SSE streaming)
app.post('/api/inbox/:id/approve-and-publish', (req, res) => {
  const { send, done } = createSSE(res);
  const edits = req.body || {};

  // 1. Pull entry from inbox (removes from pending store)
  const entry = approvePending(req.params.id);
  if (!entry) {
    send('error', { message: 'Entry not found in inbox' });
    done();
    return;
  }

  // 2. Apply any inline edits from the editor
  if (edits.headline)    entry.headline    = edits.headline.trim();
  if (edits.the_so_what) entry.the_so_what = edits.the_so_what.trim();
  if (edits.summary)     entry.summary     = edits.summary.trim();
  if (edits.key_stat)    entry.key_stat    = edits.key_stat;

  // 3. Publish (write JSON to data/intelligence/)
  let entryId;
  try {
    send('status', { message: `Publishing: ${entry.headline}` });
    entryId = publish({ entry, send });
    send('published', { id: entryId });
  } catch (pubErr) {
    // Rollback — put entry back in inbox
    addPending(entry, entry._governance || {});
    send('error', { message: `Publish failed — entry returned to inbox. ${pubErr.message}` });
    done();
    return;
  }

  // 4. Git commit + push
  try {
    commitAndPush({ ids: [entryId], send, branch: 'main' });
  } catch (gitErr) {
    send('error', { message: `Published but git push failed: ${gitErr.message}` });
  }

  // 5. Non-blocking landscape impact check — runs after response is sent
  const publishedEntry = { ...entry, id: entryId };
  setImmediate(() => checkLandscapeImpact(publishedEntry).catch(() => {}));

  done();
});

// Reject with editorial reason — logs feedback for algorithm tuning
app.post('/api/inbox/:id/reject-with-reason', (req, res) => {
  const { reason = 'other', notes = '' } = req.body || {};
  const pending = getPending();
  const item = pending[req.params.id];
  if (!item) return res.status(404).json({ error: 'Entry not found in inbox' });

  const companyId  = item.entry.company;
  const entryType  = item.entry.type;

  addRejectionLog({
    id:                req.params.id,
    url:               item.entry.source_url,
    headline:          item.entry.headline,
    company:           item.entry.company_name,
    company_id:        companyId,
    entry_type:        entryType,
    reason,
    notes,
    score:             item.score ?? null,
    governance_verdict: item.governance.verdict,
    rejected_at:       new Date().toISOString(),
  });

  // Auto-suppress this company+type topic after 2+ rejections with same reason
  // (e.g. jump-ai:funding rejected twice → suppress jump-ai:funding for 60 days)
  // A different entry type for the same company still gets through.
  if (companyId && entryType) {
    const log = getRejectionLog();
    const topicRejections = log.filter(
      r => r.company_id === companyId && r.entry_type === entryType && r.reason === reason
    ).length;
    if (topicRejections >= 1 && !isTopicSuppressed(companyId, entryType)) {
      suppressTopic(companyId, entryType, item.entry.company_name,
        `Auto-suppressed: ${reason} (${topicRejections + 1}x)`, 60);
      console.log(`[inbox] Suppressed topic ${companyId}:${entryType} for 60 days (${reason})`);
    }
  }

  rejectPending(req.params.id);
  res.json({ ok: true });
});

// ─── Landscape suggestions ────────────────────────────────────────────────────

// All pending landscape maturity upgrade suggestions
app.get('/api/landscape-suggestions', (req, res) => {
  res.json(getLandscapeSuggestions());
});

// Apply a suggestion: updates competitor JSON + git push to main
app.post('/api/landscape-suggestions/:id/apply', (req, res) => {
  const result = applyLandscapeSuggestion(req.params.id);
  if (!result) return res.status(404).json({ error: 'Suggestion not found or already actioned' });
  res.json({ ok: true, ...result });
});

// Dismiss a suggestion without applying
app.post('/api/landscape-suggestions/:id/dismiss', (req, res) => {
  const ok = dismissLandscapeSuggestion(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Suggestion not found' });
  res.json({ ok: true });
});

// Stale capability list (fast — no search, just reads date_assessed fields)
app.get('/api/landscape-stale', (req, res) => {
  res.json(getStaleList());
});

// Run staleness sweep — searches for recent news on all stale capabilities (slow, SSE)
app.post('/api/landscape-sweep', async (req, res) => {
  const { send, done } = createSSE(res);
  try {
    await runLandscapeSweep({ send });
  } catch (err) {
    send('error', { message: err.message });
  }
  done();
});

// ─── Thought Leadership publish ───────────────────────────────────────────────

// Approve a TL candidate: fetch + Claude extract + write JSON + push to main
app.post('/api/tl-publish', async (req, res) => {
  const { url } = req.body;
  const { send, done } = createSSE(res);

  if (!url) {
    send('error', { message: 'URL is required' });
    done();
    return;
  }

  try {
    await publishTlEntry({ url, send });
  } catch (err) {
    send('error', { message: err.message });
  }
  done();
});

// ── TL Discovery routes ───────────────────────────────────────────────────────

app.post('/api/tl-discover', (req, res) => {
  const { send, done } = createSSE(res);
  runTLDiscover({ send })
    .then(() => done())
    .catch(e => { send('error', { message: e.message }); done(); });
});

app.get('/api/tl-candidates', (req, res) => {
  res.json({ candidates: getTLCandidates() });
});

app.post('/api/tl-candidates/dismiss', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  dismissTLCandidate(url);
  res.json({ ok: true });
});

app.get('/api/tl-published', (req, res) => {
  try {
    const tlDir = join(DATA_DIR, 'thought-leadership');
    console.log('[tl-published] Looking in:', tlDir, 'exists:', fs.existsSync(tlDir));
    const files = fs.readdirSync(tlDir).filter(f => f.endsWith('.json'));
    console.log('[tl-published] Found', files.length, 'files:', files.join(', '));
    const entries = files.map(f => {
      try { return JSON.parse(fs.readFileSync(join(tlDir, f), 'utf8')); } catch { return null; }
    }).filter(Boolean).sort((a, b) => (b.date_published || '').localeCompare(a.date_published || ''));
    res.json({ entries });
  } catch(e) {
    console.error('[tl-published] Error:', e.message, 'DATA_DIR:', DATA_DIR);
    res.json({ entries: [] });
  }
});

// Pipeline status — last run summary for inbox dashboard
app.get('/api/pipeline-status', (req, res) => {
  const status = readPipelineStatus();
  const pending = getPending();
  const blocked = getBlocked();

  // Count entries published today from data/intelligence/
  const today = new Date().toISOString().split('T')[0];
  let publishedToday = 0;
  const todayFiles = fs.existsSync(DATA_DIR + '/intelligence')
    ? fs.readdirSync(DATA_DIR + '/intelligence').filter(f => f.endsWith('.json'))
    : [];
  for (const f of todayFiles) {
    try {
      const e = JSON.parse(fs.readFileSync(DATA_DIR + '/intelligence/' + f, 'utf-8'));
      if (e._governance?.approved_at && e._governance.approved_at.startsWith(today)) publishedToday++;
    } catch (_) {}
  }

  // Count rejections today
  const log = getRejectionLog();
  const rejectedToday = log.filter(r => r.rejected_at && r.rejected_at.startsWith(today)).length;

  res.json({
    last_run_at:       status?.started_at || null,
    last_run_found:    status?.candidates_found || 0,
    last_run_queued:   status?.queued || 0,
    last_run_blocked:  status?.blocked || 0,
    inbox_count:       Object.keys(pending).length,
    published_today:   publishedToday,
    rejected_today:    rejectedToday,
    blocked_total:     Object.keys(blocked).length,
    blocked_items:     status?.blocked_items || [],
    tl_items:          status?.tl_items || [],
  });
});

// Pipeline run history — last 30 runs with counts
app.get('/api/pipeline-history', (req, res) => {
  const history = readPipelineHistory();
  // Return lightweight version (no blocked_items or tl_items arrays — just counts)
  res.json({
    runs: history.map(run => ({
      started_at:       run.started_at,
      candidates_found: run.candidates_found || 0,
      queued:           run.queued || 0,
      blocked:          run.blocked || 0,
      errors:           run.errors || 0,
      tl_candidates:    run.tl_candidates || 0,
    })),
  });
});

// Recent published — entries from last 7 days for editorial audit
app.get('/api/recent-published', (req, res) => {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recent = [];
  const intelFiles = fs.existsSync(DATA_DIR + '/intelligence')
    ? fs.readdirSync(DATA_DIR + '/intelligence').filter(f => f.endsWith('.json'))
    : [];
  for (const f of intelFiles) {
    try {
      const e = JSON.parse(fs.readFileSync(DATA_DIR + '/intelligence/' + f, 'utf-8'));
      if (e.published_at && e.published_at >= cutoff) {
        recent.push({
          id:             e.id,
          headline:       e.headline,
          the_so_what:    e.the_so_what || null,
          company_name:   e.company_name,
          date:           e.date,
          published_at:   e.published_at,
          human_approved: e._governance?.human_approved || false,
          score:          e._governance?.confidence || null,
        });
      }
    } catch (_) {}
  }
  recent.sort((a, b) => b.published_at.localeCompare(a.published_at));
  res.json({ count: recent.length, items: recent });
});

// ─── Governance audit endpoints ───────────────────────────────────────────────

// Activity log — last 7 days of approvals + rejections combined
app.get('/api/activity-log', (req, res) => {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Rejections from rejection log
  const rejections = (getRejectionLog() || [])
    .filter(r => r.rejected_at && r.rejected_at >= cutoff)
    .map(r => ({
      id:         r.id,
      headline:   r.headline || r.id,
      company:    r.company_name || null,
      action:     'rejected',
      reason:     r.reason || null,
      timestamp:  r.rejected_at,
    }));

  // Approvals from published entries
  const approvals = [];
  const intelFiles = fs.existsSync(DATA_DIR + '/intelligence')
    ? fs.readdirSync(DATA_DIR + '/intelligence').filter(f => f.endsWith('.json'))
    : [];
  for (const f of intelFiles) {
    try {
      const e = JSON.parse(fs.readFileSync(DATA_DIR + '/intelligence/' + f, 'utf-8'));
      const approvedAt = e._governance?.approved_at || e.published_at;
      if (approvedAt && approvedAt >= cutoff) {
        approvals.push({
          id:        e.id,
          headline:  e.headline,
          company:   e.company_name || null,
          action:    'approved',
          timestamp: approvedAt,
        });
      }
    } catch {}
  }

  const combined = [...rejections, ...approvals]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  res.json({ log: combined });
});

// View all permanently blocked URLs
app.get('/api/blocked', (req, res) => {
  const store = getBlocked();
  const blocked = Object.entries(store).map(([url, meta]) => ({ url, ...meta }));
  res.json({ blocked });
});

app.post('/api/blocked/unblock', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  removeBlocked(url);
  res.json({ ok: true, url });
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  const pending = getPending();
  const blocked = getBlocked();
  res.json({
    ok: true,
    port: PORT,
    timestamp: new Date().toISOString(),
    governance: {
      pending_approvals: Object.keys(pending).length,
      blocked_urls: Object.keys(blocked).length,
    },
  });
});

// ─── Mobile review routes (email links) ──────────────────────────────────────

// GET /review/:token?id=<entryId>
// Serves a mobile-friendly review page for a pending REVIEW entry.
// Also handles direct approve/reject via ?action=approve|reject (one-tap from email).
app.get('/review/:token', (req, res) => {
  const { token } = req.params;
  const { id: entryId, action } = req.query;

  if (!entryId) {
    return res.status(400).send('<p>Missing entry ID.</p>');
  }

  if (!verifyToken(entryId, token)) {
    return res.status(403).send('<p>Invalid or expired review link.</p>');
  }

  const pending = getPending();
  const item = pending[entryId];

  if (!item) {
    return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Already Reviewed</title>
<style>body{font-family:-apple-system,sans-serif;max-width:480px;margin:40px auto;padding:20px;text-align:center}
h2{color:#27ae60}</style></head>
<body><h2>Already Reviewed</h2><p>This entry has already been approved or rejected.</p></body></html>`);
  }

  // Handle one-tap approve/reject from email
  if (action === 'approve') {
    const entry = approvePending(entryId);
    if (entry) {
      try {
        const dummySend = () => {};
        const id = publish({ entry, send: dummySend });
        commitAndPush({ ids: [id], send: dummySend, branch: 'main' });
        // Landscape impact check (non-blocking)
        setImmediate(() => checkLandscapeImpact({ ...entry, id }).catch(() => {}));
      } catch (err) {
        console.error('[review] Publish after approve failed:', err.message);
      }
    }
    return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Published</title>
<style>body{font-family:-apple-system,sans-serif;max-width:480px;margin:40px auto;padding:20px;text-align:center}
h2{color:#27ae60}</style></head>
<body><h2>✓ Published</h2><p>Entry approved and published to the portal.</p></body></html>`);
  }

  if (action === 'reject') {
    rejectPending(entryId);
    return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rejected</title>
<style>body{font-family:-apple-system,sans-serif;max-width:480px;margin:40px auto;padding:20px;text-align:center}
h2{color:#c0392b}</style></head>
<body><h2>✗ Rejected</h2><p>Entry rejected and URL permanently blocked.</p></body></html>`);
  }

  // Full review page
  const gov = item.governance;
  const confidence = gov?.confidence ? `${Math.round(gov.confidence)}%` : 'n/a';
  const unverified = (gov?.unverified_claims || []).map(c => `<li>${escHtml(c)}</li>`).join('');
  const baseUrl = (process.env.INTAKE_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
  const approveUrl = `${baseUrl}/review/${token}?id=${encodeURIComponent(entryId)}&action=approve`;
  const rejectUrl  = `${baseUrl}/review/${token}?id=${encodeURIComponent(entryId)}&action=reject`;

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Review: ${escHtml(item.entry.headline || entryId)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         max-width:480px;margin:0 auto;padding:16px;background:#f9f9f9;color:#1a1a1a}
    h1{font-size:18px;line-height:1.4;margin:0 0 8px}
    .meta{font-size:12px;color:#888;margin:0 0 16px}
    .summary{font-size:14px;line-height:1.6;background:#fff;
             border-radius:8px;padding:16px;margin-bottom:16px;
             border:1px solid #eee}
    .gov{background:#fff;border-radius:8px;padding:16px;
         border:1px solid #f0c040;margin-bottom:24px}
    .gov h2{font-size:12px;text-transform:uppercase;letter-spacing:1px;
            color:#888;margin:0 0 8px}
    .gov .conf{font-size:24px;font-weight:700;color:#e67e22;margin:0 0 8px}
    .gov ul{margin:8px 0 0;padding-left:20px;font-size:13px;color:#555}
    .actions{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .btn{display:block;padding:14px;border:none;border-radius:8px;
         font-size:16px;font-weight:700;cursor:pointer;text-align:center;
         text-decoration:none;color:#fff}
    .approve{background:#27ae60}
    .reject{background:#e74c3c}
  </style>
</head>
<body>
  <h1>${escHtml(item.entry.headline || entryId)}</h1>
  <p class="meta">${escHtml(item.entry.company_name || '')}${item.entry.pub_date ? ' · ' + new Date(item.entry.pub_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p>
  <div class="summary">
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase">Summary</p>
    <p style="margin:0;font-size:14px">${escHtml(item.entry.summary || 'No summary available.')}</p>
    ${item.entry.source_url ? `<p style="margin:8px 0 0"><a href="${escHtml(item.entry.source_url)}" style="font-size:12px;color:#990F3D">Source →</a></p>` : ''}
  </div>
  <div class="gov">
    <h2>Governance</h2>
    <p class="conf">${confidence} confidence</p>
    ${unverified ? `<p style="margin:0;font-size:13px;font-weight:600;color:#555">Unverified claims:</p><ul>${unverified}</ul>` : '<p style="margin:0;font-size:13px;color:#27ae60">No unverified claims flagged.</p>'}
    ${gov?.notes ? `<p style="margin:8px 0 0;font-size:12px;color:#888">${escHtml(gov.notes)}</p>` : ''}
  </div>
  <div class="actions">
    <a href="${approveUrl}" class="btn approve">✓ Publish</a>
    <a href="${rejectUrl}" class="btn reject">✗ Reject</a>
  </div>
</body>
</html>`);
});

// POST /review/:token/approve — programmatic approve (for API clients)
app.post('/review/:token/approve', (req, res) => {
  const { token } = req.params;
  const { id: entryId } = req.query;

  if (!entryId || !verifyToken(entryId, token)) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  const entry = approvePending(entryId);
  if (!entry) {
    return res.status(404).json({ error: 'Entry not found in pending queue' });
  }

  try {
    const dummySend = () => {};
    const id = publish({ entry, send: dummySend });
    commitAndPush({ ids: [id], send: dummySend, branch: 'main' });
    // Landscape impact check (non-blocking)
    setImmediate(() => checkLandscapeImpact({ ...entry, id }).catch(() => {}));
    res.json({ ok: true, message: 'Entry approved, published, and pushed to main', id });
  } catch (err) {
    res.status(500).json({ error: `Publish failed: ${err.message}` });
  }
});

// POST /review/:token/reject — programmatic reject (for API clients)
app.post('/review/:token/reject', (req, res) => {
  const { token } = req.params;
  const { id: entryId } = req.query;

  if (!entryId || !verifyToken(entryId, token)) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  const ok = rejectPending(entryId);
  if (!ok) {
    return res.status(404).json({ error: 'Entry not found in pending queue' });
  }

  res.json({ ok: true, message: 'Entry rejected and URL permanently blocked' });
});

// ─── Cron: daily pipeline at 5:00 AM UK time ─────────────────────────────────

cron.schedule('0 5 * * *', () => {
  console.log('[cron] 5:00 AM Europe/London — starting daily pipeline');
  runDailyPipeline().catch(err => {
    console.error('[cron] Daily pipeline failed:', err.message);
  });
}, { timezone: 'Europe/London' });

// ─── POST /api/run-pipeline — manually trigger full pipeline + digest ─────────

app.post('/api/run-pipeline', async (req, res) => {
  const { send, done } = createSSE(res);
  console.log('[manual] Pipeline triggered via API');
  send('status', { message: 'Pipeline starting — discovery + processing (~4-6 min)...' });
  try {
    const results = await runDailyPipeline();
    send('done', {
      published: results.published.length,
      pending:   results.pending.length,
      blocked:   results.blocked.length,
      errors:    results.errors.length,
      message:   `Done. ${results.pending.length} queued for review · ${results.blocked.length} blocked · ${results.errors.length} errors`,
    });
  } catch (err) {
    console.error('[manual] Pipeline failed:', err.message);
    send('error', { message: err.message });
  }
  done();
});

// ─── POST /api/test-digest — send a sample digest email immediately ───────────

app.post('/api/test-digest', async (req, res) => {
  try {
    const { sendDigest } = await import('./agents/notifier.js');
    await sendDigest({
      published: [
        { id: 'test-1', title: "Goldman Sachs deploys autonomous compliance agents with Anthropic", company_name: 'Goldman Sachs', score: 95 },
        { id: 'test-2', title: "Morgan Stanley's AskResearchGPT goes live for all 16,000 advisors", company_name: 'Morgan Stanley', score: 88 },
      ],
      pending: [
        {
          id: 'test-3',
          title: 'UBS opens AI Transformation Factory in Singapore',
          company_name: 'UBS',
          score: 62,
          score_breakdown: 'Score: 62/100 · Source: Reuters (25) · Claims: 1 unverified (18) · Fresh: 3d old (20) · Relevance: Tracked company (13)',
          unverified_claims: ['Headcount figure of 200 engineers not confirmed in source'],
          paywall_caveat: false,
          notes: '',
        },
      ],
      blocked: [
        { title: 'AI Startup Claims 10x Advisor Productivity with No Evidence', score: 28 },
      ],
      errors: [],
      newCompanies: [
        { id: 'farther-finance', name: 'Farther Finance', headline: 'Farther launches AI-driven estate planning feature for RIAs' },
      ],
      tlCandidates: [
        { title: 'The Coming AI Wave in Wealth Management', url: 'https://example.com/ai-wave', snippet: 'A new essay by Andreessen Horowitz on how AI agents will reshape the advisor industry...', via: 'layer1_tl' },
      ],
    });
    res.json({ ok: true, message: 'Test digest sent to Telegram' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Audit endpoints ──────────────────────────────────────────────────────────

// GET /api/audit — run fast audit (rule-based, no API cost)
app.get('/api/audit', async (req, res) => {
  const { send, done } = createSSE(res);
  try {
    await runFastAudit({ send });
  } catch (err) {
    send('error', { message: err.message });
  }
  done();
});

// GET /api/audit/deep — run deep audit (rule-based + Claude AI verification)
app.get('/api/audit/deep', async (req, res) => {
  const { send, done } = createSSE(res);
  try {
    await runDeepAudit({ send });
  } catch (err) {
    send('error', { message: err.message });
  }
  done();
});

// GET /api/audit/report — return the last saved audit report
app.get('/api/audit/report', (req, res) => {
  const reportPath = join(DATA_DIR, 'audit-report.json');
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    res.json(report);
  } catch {
    res.status(404).json({ error: 'No audit report found — run /api/audit first' });
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

app.listen(PORT, () => {
  console.log(`\n✦ Living Intelligence Intake Server`);
  console.log(`  Running at: http://localhost:${PORT}`);
  console.log(`  Portal data: data/intelligence/`);
  console.log(`  Editorial: ALL stories queue for human review — nothing auto-publishes`);
  console.log(`  Cron: daily pipeline at 06:00 Europe/London\n`);
});
