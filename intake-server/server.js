import 'dotenv/config';

// Sanitise env vars at process start — strips Railway's " =" prefix quirk
if (process.env.MAIL_HOST) process.env.MAIL_HOST = process.env.MAIL_HOST.replace(/^[\s=]+/, '').trim();
if (process.env.MAIL_USER) process.env.MAIL_USER = process.env.MAIL_USER.replace(/^[\s=]+/, '').trim();
if (process.env.MAIL_PASS) process.env.MAIL_PASS = process.env.MAIL_PASS.replace(/^[\s=]+/, '').trim();

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cron from 'node-cron';
import { discover } from './agents/discovery.js';
import { autoDiscover } from './agents/auto-discover.js';
import { processUrl } from './agents/intake.js';
import { verify } from './agents/governance.js';
import { publish, commitAndPush } from './agents/publisher.js';
import {
  getPending, addPending, approvePending, rejectPending,
  getBlocked, addBlocked, isBlocked,
} from './agents/gov-store.js';
import { runDailyPipeline } from './agents/scheduler.js';
import { signToken, verifyToken } from './agents/notifier.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
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

// Auto-discover: RSS + Jina + DataForSEO in parallel, deduped and ranked
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

// Discover stories from RSS feeds
app.post('/api/discover', async (req, res) => {
  const { send, done } = createSSE(res);
  try {
    await discover({ send });
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

  // Fix 4: Block permanently-failed URLs before wasting any processing
  if (isBlocked(url)) {
    const blocked = getBlocked();
    send('blocked', {
      message: `This URL was permanently blocked by governance: ${blocked[url]?.reason || 'FAIL verdict'}`,
      blocked_at: blocked[url]?.blocked_at,
    });
    done();
    return;
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

    // Fix 1: REVIEW → hold in pending queue, do NOT allow direct publish
    if (govResult.verdict === 'REVIEW') {
      addPending(intakeResult.entry, govAudit);
      send('review_queued', {
        message: 'Entry has unverified claims and requires human approval before publishing.',
        entry_id: intakeResult.entry.id,
        unverified_claims: govResult.unverified_claims,
        notes: govResult.notes,
      });
      done();
      return;
    }

    // PASS — return entry ready to publish (with audit attached)
    send('complete', {
      entry: intakeResult.entry,
      governance: govAudit,
      can_publish: true,
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
    headline: item.entry.headline,
    company_name: item.entry.company_name,
    source_url: item.entry.source_url,
    unverified_claims: item.governance.unverified_claims,
    notes: item.governance.notes,
    confidence: item.governance.confidence,
    queued_at: item.queued_at,
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

// ─── Governance audit endpoints ───────────────────────────────────────────────

// View all permanently blocked URLs
app.get('/api/blocked', (req, res) => {
  res.json(getBlocked());
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
  const confidence = gov?.confidence ? `${Math.round(gov.confidence * 100)}%` : 'n/a';
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

// ─── Cron: daily pipeline at 6:00 AM ─────────────────────────────────────────

cron.schedule('0 6 * * *', () => {
  console.log('[cron] 6:00 AM Europe/London — starting daily pipeline');
  runDailyPipeline().catch(err => {
    console.error('[cron] Daily pipeline failed:', err.message);
  });
}, { timezone: 'Europe/London' });

// ─── POST /api/run-pipeline — manually trigger full pipeline + digest ─────────

app.post('/api/run-pipeline', async (req, res) => {
  console.log('[manual] Pipeline triggered via API');
  res.json({ ok: true, message: 'Pipeline started — check server logs' });
  runDailyPipeline().catch(err => {
    console.error('[manual] Pipeline failed:', err.message);
  });
});

// ─── POST /api/test-digest — send a sample digest email immediately ───────────

app.post('/api/test-digest', async (req, res) => {
  try {
    const { sendDigest } = await import('./agents/notifier.js');
    await sendDigest({
      published: [
        { id: 'test-1', title: 'Goldman Sachs deploys autonomous compliance agents with Anthropic', company_name: 'Goldman Sachs', confidence: 94 },
        { id: 'test-2', title: 'Morgan Stanley AskResearchGPT now live for all 16,000 advisors', company_name: 'Morgan Stanley', confidence: 91 },
      ],
      pending: [
        { id: 'test-3', title: 'UBS opens AI Transformation Factory in Singapore', company_name: 'UBS', confidence: 0.78, unverified_claims: ['headcount figure unverified'], notes: 'One stat needs checking' },
      ],
      blocked: [],
      errors: [],
    });
    res.json({ ok: true, message: `Test digest sent to ${process.env.DIGEST_EMAIL}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/debug-mail — inspect actual MAIL_* env var values (safe) ───────

app.get('/api/debug-mail', (req, res) => {
  const host = process.env.MAIL_HOST || '';
  res.json({
    MAIL_HOST_value:  host,
    MAIL_HOST_length: host.length,
    MAIL_HOST_codes:  [...host].slice(0, 6).map(c => c.charCodeAt(0)),
    MAIL_USER_set:    !!process.env.MAIL_USER,
    MAIL_PASS_set:    !!process.env.MAIL_PASS,
    MAIL_PORT:        process.env.MAIL_PORT || '(not set)',
  });
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
  console.log(`  Governance: PASS-only publish gate active`);
  console.log(`  Cron: daily pipeline at 06:00 Europe/London\n`);
});
