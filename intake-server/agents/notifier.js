/**
 * notifier.js — Daily digest sender via Telegram
 *
 * Uses Telegram Bot API (HTTPS) — works on Railway, no SMTP needed.
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN — from @BotFather
 *   TELEGRAM_CHAT_ID   — your personal chat ID (from getUpdates)
 *   REVIEW_SECRET      — 32-char secret for HMAC-SHA256 token signing
 *   INTAKE_BASE_URL    — public URL of this server
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

// ── Telegram sender ───────────────────────────────────────────────────────────

async function sendTelegram(text) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`Telegram API error: ${JSON.stringify(body)}`);
  return body;
}

// ── Message builder ───────────────────────────────────────────────────────────

function buildMessage({ published, pending, blocked, errors, date }) {
  const baseUrl   = (process.env.INTAKE_BASE_URL || 'http://localhost:3003').replace(/\/$/, '');
  const portalUrl = process.env.PORTAL_URL || 'https://wealth.tigerai.tech';
  const lines     = [];

  lines.push(`<b>Living Intelligence</b> · ${date}`);
  lines.push('');

  if (published.length > 0) {
    lines.push(`<b>✅ Auto-published (${published.length})</b>`);
    published.forEach(p => {
      const score = p.score ? ` · ${p.score}/100` : '';
      lines.push(`  → ${p.title}${p.company_name ? ` <i>${p.company_name}</i>` : ''}${score}`);
    });
    lines.push('');
  }

  if (pending.length > 0) {
    lines.push(`<b>⚠️ Needs Your Review (${pending.length})</b>`);
    pending.forEach(p => {
      const token     = signToken(p.id);
      const reviewUrl = `${baseUrl}/review/${token}?id=${encodeURIComponent(p.id)}`;

      lines.push(`  → <b>${p.title}</b>${p.company_name ? ` <i>${p.company_name}</i>` : ''}`);

      // Score breakdown on one line
      if (p.score_breakdown) {
        lines.push(`    <code>${p.score_breakdown}</code>`);
      }

      // Specific unverified claims — the reason it needs review
      if (p.unverified_claims && p.unverified_claims.length > 0) {
        p.unverified_claims.forEach(claim => {
          lines.push(`    ⚠ <i>${claim}</i>`);
        });
      }

      // Paywall caveat flag
      if (p.paywall_caveat) {
        lines.push(`    ℹ Paywall caveat — limited source content`);
      }

      lines.push(`    <a href="${reviewUrl}">Review →</a>`);
      lines.push('');
    });
  }

  if (blocked.length > 0) {
    lines.push(`<b>🚫 Auto-blocked (${blocked.length})</b>`);
    blocked.forEach(b => {
      const score = b.score !== undefined ? ` · score ${b.score}/100` : '';
      lines.push(`  → ${b.title}${score}`);
    });
    lines.push('');
  }

  if (errors.length > 0) {
    lines.push(`<b>❌ Errors (${errors.length})</b>`);
    errors.forEach(e => lines.push(`  · ${e.stage}: ${e.message}`));
    lines.push('');
  }

  if (published.length === 0 && pending.length === 0) {
    lines.push('No new stories today — nothing matched the relevance threshold.');
    lines.push('');
  }

  lines.push(`<a href="${portalUrl}">View portal →</a>`);

  return lines.join('\n');
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function sendDigest({ published = [], pending = [], blocked = [], errors = [] }) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.warn('[notifier] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skipping digest');
    return;
  }

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const text  = buildMessage({ published, pending, blocked, errors, date: today });

  await sendTelegram(text);
  console.log(`[notifier] Digest sent to Telegram chat ${process.env.TELEGRAM_CHAT_ID}`);
}
