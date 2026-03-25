/**
 * gov-store.js — Persistent governance state
 *
 * Two stores, both file-backed so state survives server restarts:
 *   .governance-pending.json  — REVIEW entries waiting for human sign-off
 *   .governance-blocked.json  — FAIL entries permanently blocked by URL
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_DIR = process.env.STATE_DIR || join(process.env.DATA_DIR || join(__dirname, '..', '..'), 'data');
const PENDING_FILE  = join(STORE_DIR, '.governance-pending.json');
const BLOCKED_FILE  = join(STORE_DIR, '.governance-blocked.json');
const ARCHIVE_FILE  = join(STORE_DIR, '.governance-archive.json');
const REJECTION_LOG = join(STORE_DIR, '.rejection-log.json');
const PIPELINE_STATUS_FILE = join(STORE_DIR, '.pipeline-status.json');
const SUPPRESSED_FILE      = join(STORE_DIR, '.suppressed-companies.json');

// One-time migration: if STATE_DIR is set and files exist at the old DATA_DIR/data path, copy them over.
// This handles the transition from DATA_DIR=/data → STATE_DIR=/data where old files lived at /data/data/.
if (process.env.STATE_DIR) {
  const oldDir = join(process.env.DATA_DIR || join(__dirname, '..', '..'), 'data');
  if (oldDir !== STORE_DIR && existsSync(oldDir)) {
    if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
    for (const fname of ['.governance-pending.json', '.governance-blocked.json', '.governance-archive.json', '.rejection-log.json', '.pipeline-status.json']) {
      const src = join(oldDir, fname);
      const dst = join(STORE_DIR, fname);
      if (existsSync(src) && !existsSync(dst)) {
        try { copyFileSync(src, dst); } catch {}
      }
    }
  }
}

function readStore(file) {
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, 'utf-8')); } catch { return {}; }
}

function writeStore(file, data) {
  if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Pending queue (REVIEW verdicts awaiting human approval) ─────────────────

export function getPending() {
  return readStore(PENDING_FILE);
}

// metadata: optional { score, score_breakdown } from scorer
export function addPending(entry, governance, metadata = {}) {
  const store = readStore(PENDING_FILE);
  const now = new Date().toISOString();
  store[entry.id] = {
    entry,
    governance,
    queued_at: now,
    discovered_at: now,
    score: metadata.score ?? null,
    score_breakdown: metadata.score_breakdown ?? null,
  };
  writeStore(PENDING_FILE, store);
}

export function approvePending(id) {
  const store = readStore(PENDING_FILE);
  if (!store[id]) return null;
  const item = store[id];
  // Attach human approval to governance audit
  item.entry._governance = {
    ...item.governance,
    human_approved: true,
    approved_at: new Date().toISOString(),
  };
  delete store[id];
  writeStore(PENDING_FILE, store);
  return item.entry;
}

export function rejectPending(id) {
  const store = readStore(PENDING_FILE);
  if (!store[id]) return false;
  const item = store[id];
  addBlocked(item.entry.source_url, item.entry.id, 'Human rejected REVIEW entry');
  delete store[id];
  writeStore(PENDING_FILE, store);
  return true;
}

// ─── Blocked list (FAIL verdicts — permanently blocked by source URL) ─────────

export function getBlocked() {
  return readStore(BLOCKED_FILE);
}

export function addBlocked(url, id, reason) {
  const store = readStore(BLOCKED_FILE);
  store[url] = { id, reason, blocked_at: new Date().toISOString() };
  writeStore(BLOCKED_FILE, store);
}

export function isBlocked(url) {
  return !!readStore(BLOCKED_FILE)[url];
}

export function removeBlocked(url) {
  const store = readStore(BLOCKED_FILE);
  delete store[url];
  writeStore(BLOCKED_FILE, store);
}

// ─── Rejection log (editorial feedback for algorithm tuning) ──────────────────

export function getRejectionLog() {
  if (!existsSync(REJECTION_LOG)) return [];
  try { return JSON.parse(readFileSync(REJECTION_LOG, 'utf-8')); } catch { return []; }
}

export function addRejectionLog(entry) {
  const log = getRejectionLog();
  log.push({ ...entry, rejected_at: entry.rejected_at || new Date().toISOString() });
  if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(REJECTION_LOG, JSON.stringify(log, null, 2), 'utf-8');
}

// ─── Pipeline status (last run timestamp + summary) ───────────────────────────

export function writePipelineStatus(status) {
  if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(PIPELINE_STATUS_FILE, JSON.stringify({ ...status, written_at: new Date().toISOString() }, null, 2), 'utf-8');
}

export function readPipelineStatus() {
  if (!existsSync(PIPELINE_STATUS_FILE)) return null;
  try { return JSON.parse(readFileSync(PIPELINE_STATUS_FILE, 'utf-8')); } catch { return null; }
}

// ─── Archive (items > 7 days old from pending) ───────────────────────────────

export function getArchive() {
  return readStore(ARCHIVE_FILE);
}

// Move pending items older than 7 days into .governance-archive.json
export function archiveStaleItems() {
  const store = readStore(PENDING_FILE);
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const archive = readStore(ARCHIVE_FILE);
  let changed = false;
  for (const [id, item] of Object.entries(store)) {
    const ts = item.discovered_at || item.queued_at || '';
    if (ts && ts < cutoff) {
      archive[id] = item;
      delete store[id];
      changed = true;
    }
  }
  if (changed) {
    writeStore(PENDING_FILE, store);
    writeStore(ARCHIVE_FILE, archive);
  }
}

// ─── Topic suppression (company + entry_type level — smarter than company-wide) ─
//
// When the same company:type combination is rejected ≥2 times, suppress that
// specific topic for 60 days. A different entry type for the same company still
// gets through: Jump funding → suppressed, Jump product_launch → allowed.
//
// Key: "{companyId}:{entryType}"  e.g. "jump-ai:funding"

export function isTopicSuppressed(companyId, entryType) {
  if (!companyId || !entryType) return false;
  const key = `${companyId.toLowerCase()}:${entryType.toLowerCase()}`;
  const store = readStore(SUPPRESSED_FILE);
  const entry = store[key];
  if (!entry) return false;
  return new Date(entry.suppressed_until) > new Date();
}

export function suppressTopic(companyId, entryType, companyName, reason, days = 60) {
  if (!companyId || !entryType) return;
  const key = `${companyId.toLowerCase()}:${entryType.toLowerCase()}`;
  const store = readStore(SUPPRESSED_FILE);
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  store[key] = { company_name: companyName, entry_type: entryType, reason, suppressed_until: until, suppressed_at: new Date().toISOString() };
  writeStore(SUPPRESSED_FILE, store);
}

export function getSuppressedTopics() {
  const store = readStore(SUPPRESSED_FILE);
  const now = new Date();
  return Object.fromEntries(Object.entries(store).filter(([, v]) => new Date(v.suppressed_until) > now));
}

// Legacy alias — keep scheduler import working
export const isCompanySuppressed = isTopicSuppressed;
