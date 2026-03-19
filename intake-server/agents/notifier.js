/**
 * notifier.js — Daily digest email sender
 *
 * Uses Resend (resend.com) HTTP API — works on Railway (SMTP ports are blocked).
 * Falls back to nodemailer/SMTP if RESEND_API_KEY is not set (local dev).
 *
 * Required env vars:
 *   DIGEST_EMAIL    — recipient address
 *   RESEND_API_KEY  — from resend.com (free tier: 3,000 emails/month)
 *   REVIEW_SECRET   — 32-char secret for HMAC-SHA256 token signing
 *   INTAKE_BASE_URL — public URL of this server
 *
 * Optional (local dev fallback only):
 *   MAIL_HOST / MAIL_PORT / MAIL_USER / MAIL_PASS
 */

import crypto from 'crypto';

// ── Token signing ─────────────────────────────────────────────────────────────

export function signToken(entryId) {
  const secret = process.env.REVIEW_SECRET || 'dev-secret-change-in-production';
  return crypto
    .createHmac('sha256', secret)
    .update(entryId)
    .digest('hex');
}

export function verifyToken(entryId, token) {
  return signToken(entryId) === token;
}

// ── HTML email builder ────────────────────────────────────────────────────────

function buildHtml({ published, pending, date }) {
  const baseUrl = (process.env.INTAKE_BASE_URL || 'http://localhost:3003').replace(/\/$/, '');

  const publishedSection = published.length > 0 ? `
    <tr><td style="padding:20px 24px 8px">
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#666">
        ✅ Auto-Published (${published.length})
      </p>
    </td></tr>
    ${published.map(p => `
    <tr><td style="padding:4px 24px">
      <p style="margin:0;font-size:14px;color:#1a1a1a">
        → ${escapeHtml(p.title)}
        ${p.company_name ? `<span style="color:#888;font-size:12px"> · ${escapeHtml(p.company_name)}</span>` : ''}
      </p>
    </td></tr>`).join('')}
  ` : '';

  const pendingSection = pending.length > 0 ? `
    <tr><td style="padding:20px 24px 8px">
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c0392b">
        ⚠️ Needs Your Review (${pending.length})
      </p>
    </td></tr>
    ${pending.map(p => {
      const token       = signToken(p.id);
      const rejectUrl   = `${baseUrl}/review/${token}?id=${encodeURIComponent(p.id)}&action=reject`;
      const reviewUrl   = `${baseUrl}/review/${token}?id=${encodeURIComponent(p.id)}`;
      const confidence  = p.confidence ? `${Math.round(p.confidence * 100)}%` : 'n/a';
      const unverified  = p.unverified_claims?.length || 0;

      return `
    <tr><td style="padding:8px 24px;border-left:3px solid #e67e22;margin-left:24px">
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1a1a1a">${escapeHtml(p.title)}</p>
      <p style="margin:0 0 8px;font-size:12px;color:#888">
        Confidence: ${confidence}${unverified > 0 ? ` · ${unverified} unverified claim${unverified !== 1 ? 's' : ''}` : ''}
        ${p.notes ? ` · ${escapeHtml(p.notes.slice(0, 80))}` : ''}
      </p>
      <a href="${reviewUrl}" style="display:inline-block;background:#27ae60;color:#fff;text-decoration:none;padding:6px 14px;border-radius:4px;font-size:12px;font-weight:600;margin-right:8px">Review &amp; Approve ↗</a>
      <a href="${rejectUrl}" style="display:inline-block;background:#e74c3c;color:#fff;text-decoration:none;padding:6px 14px;border-radius:4px;font-size:12px;font-weight:600">Reject ↗</a>
    </td></tr>`;
    }).join('')}
  ` : '';

  const portalUrl = process.env.PORTAL_URL || 'https://wealth.tigerai.tech';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    <tr><td style="background:#1C1C2E;padding:20px 24px">
      <p style="margin:0;font-size:16px;font-weight:700;color:#fff">Living Intelligence</p>
      <p style="margin:4px 0 0;font-size:12px;color:#aaa">AI Portal Daily Update — ${date}</p>
    </td></tr>
    ${publishedSection}
    ${pendingSection}
    ${published.length === 0 && pending.length === 0 ? `
    <tr><td style="padding:20px 24px">
      <p style="margin:0;color:#888;font-size:14px">No new stories today — nothing matched the relevance threshold.</p>
    </td></tr>` : ''}
    <tr><td style="padding:16px 24px;border-top:1px solid #eee">
      <a href="${portalUrl}" style="font-size:12px;color:#990F3D">View portal →</a>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Send via Resend HTTP API ───────────────────────────────────────────────────

async function sendViaResend({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Living Intelligence <digest@tigerai.tech>',
      to:      [to],
      subject,
      html,
    }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`Resend API error: ${JSON.stringify(body)}`);
  return body;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function sendDigest({ published = [], pending = [], blocked = [], errors = [] }) {
  const to = process.env.DIGEST_EMAIL;
  if (!to) {
    console.warn('[notifier] DIGEST_EMAIL not set — skipping digest email');
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn('[notifier] RESEND_API_KEY not set — skipping digest email');
    return;
  }

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const publishedCount = published.length;
  const pendingCount   = pending.length;

  let subject = `AI Portal Update — ${today}`;
  if (publishedCount > 0 || pendingCount > 0) {
    const parts = [];
    if (publishedCount > 0) parts.push(`${publishedCount} published`);
    if (pendingCount   > 0) parts.push(`${pendingCount} need${pendingCount === 1 ? 's' : ''} review`);
    subject = `AI Portal: ${parts.join(', ')} — ${today}`;
  } else {
    subject = `AI Portal: nothing new today — ${today}`;
  }

  const html = buildHtml({ published, pending, date: today });
  await sendViaResend({ to, subject, html });
  console.log(`[notifier] Digest sent to ${to} via Resend`);
}
