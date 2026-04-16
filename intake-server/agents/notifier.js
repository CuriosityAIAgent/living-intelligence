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

function buildMessage({ published, pending, blocked, errors, newCompanies, tlCandidates, date }) {
  const baseUrl   = (process.env.INTAKE_BASE_URL || 'http://localhost:3003').replace(/\/$/, '');
  const portalUrl = process.env.PORTAL_URL || 'https://wealth.tigerai.tech';
  const lines     = [];

  lines.push(`<b>Living Intelligence</b> · ${date}`);
  lines.push('');

  // ── Auto-published — grouped by capability dimension ─────────────────────
  if (published.length > 0) {
    lines.push(`<b>✅ Auto-published (${published.length})</b>`);

    // Group by capability (falls back to "General" for entries without capability_evidence)
    const CAPABILITY_LABELS = {
      advisor_productivity:    'Advisor Productivity',
      client_personalization:  'Client Personalization',
      investment_portfolio:    'Investment & Portfolio',
      research_content:        'Research & Content',
      client_acquisition:      'Client Acquisition',
      operations_compliance:   'Operations & Compliance',
      new_business_models:     'New Business Models',
    };
    const grouped = {};
    published.forEach(p => {
      const cap = p.capability || 'general';
      if (!grouped[cap]) grouped[cap] = [];
      grouped[cap].push(p);
    });

    for (const [cap, entries] of Object.entries(grouped)) {
      const label = CAPABILITY_LABELS[cap] || (cap === 'general' ? null : cap);
      if (label) lines.push(`  <i>${label}</i>`);
      entries.forEach(p => {
        const score = p.score ? ` · ${p.score}/100` : '';
        const stage = p.capability_stage ? ` [${p.capability_stage}]` : '';
        lines.push(`  → ${p.title}${p.company_name ? ` <i>${p.company_name}</i>` : ''}${stage}${score}`);
      });
    }
    lines.push('');
  }

  // ── Needs review ──────────────────────────────────────────────────────────
  if (pending.length > 0) {
    lines.push(`<b>⚠️ Needs Your Review (${pending.length})</b>`);
    pending.forEach(p => {
      const token     = signToken(p.id);
      const reviewUrl = `${baseUrl}/review/${token}?id=${encodeURIComponent(p.id)}`;

      lines.push(`  → <b>${p.title}</b>${p.company_name ? ` <i>${p.company_name}</i>` : ''}`);

      // v2 brief metadata
      if (p.source_count || p.confidence) {
        const parts = [];
        if (p.source_count) parts.push(`${p.source_count} sources`);
        if (p.confidence) parts.push(`confidence: ${p.confidence}`);
        lines.push(`    <code>${parts.join(' · ')}</code>`);
      }

      // v1 fallback fields (legacy inbox items)
      if (p.score_breakdown) {
        lines.push(`    <code>${p.score_breakdown}</code>`);
      }
      if (p.unverified_claims && p.unverified_claims.length > 0) {
        p.unverified_claims.forEach(claim => {
          lines.push(`    ⚠ <i>${claim}</i>`);
        });
      }
      if (p.paywall_caveat) {
        lines.push(`    ℹ Paywall caveat — limited source content`);
      }

      lines.push(`    <a href="${reviewUrl}">Review →</a>`);
      lines.push('');
    });
  }

  // ── Auto-blocked — show top 5 only ──────────────────────────────────────
  if (blocked.length > 0) {
    const showBlocked = blocked.slice(0, 5);
    const hiddenCount = blocked.length - showBlocked.length;
    lines.push(`<b>🚫 Auto-blocked (${blocked.length})</b>`);
    showBlocked.forEach(b => {
      const score = b.score !== undefined ? ` · score ${b.score}/100` : '';
      lines.push(`  → ${b.title}${score}`);
    });
    if (hiddenCount > 0) lines.push(`  <i>+ ${hiddenCount} more blocked</i>`);
    lines.push('');
  }

  // ── New companies detected ────────────────────────────────────────────────
  // Filter out any that appear to be known companies (name match) — avoids
  // false positives when entry.company ID differs from landscape ID (e.g. "jump" vs "jump-ai")
  const genuinelyNew = (newCompanies || []).filter(c => {
    const n = (c.name || '').toLowerCase();
    // Skip obvious noise: generic words, single words that are common terms
    if (['financial', 'planning', 'advisors', 'management', 'capital', 'wealth'].includes(n)) return false;
    return true;
  });
  if (genuinelyNew.length > 0) {
    lines.push(`<b>🆕 New companies — not in landscape (${genuinelyNew.length})</b>`);
    lines.push(`  <i>Consider adding to data/competitors/ to track these firms</i>`);
    genuinelyNew.forEach(c => {
      lines.push(`  → <b>${c.name}</b>`);
      if (c.headline) lines.push(`    ${c.headline}`);
    });
    lines.push('');
  }

  // ── Thought leadership candidates — top 3 only ────────────────────────────
  if (tlCandidates && tlCandidates.length > 0) {
    // Prefer known authors; skip anything that looks like a company blog or news article
    const goodTL = tlCandidates
      .filter(c => c.via === 'layer2_authors' || (c.title && c.title.length > 20))
      .slice(0, 3);
    if (goodTL.length > 0) {
      lines.push(`<b>📚 Thought Leadership (${tlCandidates.length} found, showing ${goodTL.length})</b>`);
      goodTL.forEach(c => {
        const badge = c.via === 'layer2_authors' ? ' · known author' : '';
        lines.push(`  → <a href="${c.url}">${c.title}</a>${badge}`);
      });
      lines.push('');
    }
  }

  // ── Errors ────────────────────────────────────────────────────────────────
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

export async function sendDigest({
  published    = [],
  pending      = [],
  blocked      = [],
  errors       = [],
  newCompanies = [],
  tlCandidates = [],
}) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.warn('[notifier] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skipping digest');
    return;
  }

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const text  = buildMessage({ published, pending, blocked, errors, newCompanies, tlCandidates, date: today });

  await sendTelegram(text);
  console.log(`[notifier] Digest sent to Telegram chat ${process.env.TELEGRAM_CHAT_ID}`);
}
