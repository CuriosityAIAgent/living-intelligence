/**
 * gov-store.js — Persistent governance state
 *
 * Two stores, both file-backed so state survives server restarts:
 *   .governance-pending.json  — REVIEW entries waiting for human sign-off
 *   .governance-blocked.json  — FAIL entries permanently blocked by URL
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_DIR = join(process.env.DATA_DIR || join(__dirname, '..', '..'), 'data');
const PENDING_FILE = join(STORE_DIR, '.governance-pending.json');
const BLOCKED_FILE = join(STORE_DIR, '.governance-blocked.json');

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

export function addPending(entry, governance) {
  const store = readStore(PENDING_FILE);
  store[entry.id] = {
    entry,
    governance,
    queued_at: new Date().toISOString(),
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
