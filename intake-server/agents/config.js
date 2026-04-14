/**
 * config.js — Single source of truth for all paths, thresholds, and constants.
 *
 * Every agent imports from here. No agent defines its own paths.
 *
 * Two path types:
 *   CONTENT — data that lives in the git repo (intelligence, competitors, TL, capabilities, logos)
 *             Always resolved relative to the repo root. Never from env vars.
 *   STATE   — runtime files that live on Railway's persistent volume (pending, blocked, pipeline status)
 *             Uses STATE_DIR env var on Railway, falls back to repo data/ locally.
 *
 * On Railway:
 *   Repo clone lives at /app/ → content at /app/data/
 *   Persistent volume at /data → state at /data/ (STATE_DIR=/data)
 *
 * Locally:
 *   Repo at working directory → content at ./data/
 *   State also at ./data/ (no volume, same directory)
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Content paths (always repo-relative) ─────────────────────────────────────
// These are git-tracked files: intelligence entries, competitor profiles,
// thought leadership, capabilities, logos.

export const REPO_ROOT      = join(__dirname, '..', '..');
export const CONTENT_DIR    = join(REPO_ROOT, 'data');
export const INTEL_DIR      = join(CONTENT_DIR, 'intelligence');
export const COMPETITORS_DIR = join(CONTENT_DIR, 'competitors');
export const TL_DIR         = join(CONTENT_DIR, 'thought-leadership');
export const CAPABILITIES_DIR = join(CONTENT_DIR, 'capabilities');
export const LOGOS_DIR      = join(REPO_ROOT, 'public', 'logos');

// ── State paths (Railway volume or fallback to repo) ─────────────────────────
// These are runtime files: governance pending/blocked, pipeline status,
// TL candidates, landscape suggestions. NOT git-tracked in production.

export const STATE_DIR = process.env.STATE_DIR
  || (process.env.DATA_DIR ? join(process.env.DATA_DIR, 'data') : CONTENT_DIR);

// ── Scoring thresholds ───────────────────────────────────────────────────────

export const THRESHOLDS = {
  PUBLISH: 75,         // Score ≥ 75 → queued for editorial sign-off
  REVIEW: 45,          // Score 45-74 → queued for human decision
  BLOCK: 45,           // Score < 45 → permanently blocked
  FRESHNESS_LIMIT: 90, // Articles > 90 days old → auto-block
  STALENESS_DAYS: 45,  // Landscape entries > 45 days → flagged as stale
};

// ── Source classification ────────────────────────────────────────────────────

export const PRESS_RELEASE_DOMAINS = new Set([
  'businesswire.com', 'prnewswire.com', 'globenewswire.com', 'accesswire.com',
]);

export const TIER1_MEDIA = new Set([
  'bloomberg.com', 'reuters.com', 'ft.com', 'wsj.com', 'cnbc.com',
  'fortune.com', 'businessinsider.com', 'axios.com', 'nytimes.com',
]);

export const PAYWALLED_DOMAINS = new Set([
  'ft.com', 'wsj.com', 'bloomberg.com', 'barrons.com',
  'economist.com', 'hbr.org', 'morningstar.com',
]);

// Domains that are never paywalled — even if Jina extracts thin content
export const NEVER_PAYWALLED = new Set([
  'businesswire.com', 'prnewswire.com', 'globenewswire.com', 'accesswire.com',
]);

// ── Capability dimensions ────────────────────────────────────────────────────

export const VALID_CAPABILITIES = new Set([
  'advisor_productivity', 'client_personalization', 'investment_portfolio',
  'research_content', 'client_acquisition', 'operations_compliance', 'new_business_models',
]);

// ── AI model ─────────────────────────────────────────────────────────────────

export const MODEL = 'claude-sonnet-4-6';
export const SOURCE_WINDOW = 12_000;
export const THIN_CONTENT_THRESHOLD = 500;
