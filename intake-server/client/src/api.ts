// Central API layer — all fetch calls to the intake server
// In dev: proxied to localhost:3003 via Vite proxy
// In production: same origin (Express serves the built app)

import type {
  InboxResponse,
  PipelineStatus,
  PipelineRun,
  ActivityLogResponse,
  TLCandidate,
  TLPublishedEntry,
  LandscapeSuggestion,
  StaleEntry,
  AuditReport,
  BlockedUrl,
} from './types';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Inbox ─────────────────────────────────────────────────────────────────────

export const fetchInbox = (): Promise<InboxResponse> =>
  apiFetch('/api/inbox');

export const fetchArchive = (): Promise<InboxResponse> =>
  apiFetch('/api/inbox/archive');

export const rejectItem = (id: string, reason: string, notes: string): Promise<void> =>
  apiFetch(`/api/inbox/${id}/reject-with-reason`, {
    method: 'POST',
    body: JSON.stringify({ reason, notes }),
  });

// Approve returns an SSE stream — handled inline in the component
export const approveUrl = (id: string): string =>
  `/api/inbox/${id}/approve-and-publish`;

// ── Pipeline ──────────────────────────────────────────────────────────────────

export const fetchPipelineStatus = (): Promise<PipelineStatus> =>
  apiFetch('/api/pipeline-status');

export const fetchPipelineHistory = (): Promise<{ runs: PipelineRun[] }> =>
  apiFetch('/api/pipeline-history');

export const runPipeline = (): Promise<void> =>
  apiFetch('/api/run-pipeline', { method: 'POST' });

// ── Activity log ──────────────────────────────────────────────────────────────

export const fetchActivityLog = (): Promise<ActivityLogResponse> =>
  apiFetch('/api/activity-log');

// ── Discover (manual URL processing) ─────────────────────────────────────────

export const processUrl = (url: string, sourceName?: string): Promise<unknown> =>
  apiFetch('/api/process-url', {
    method: 'POST',
    body: JSON.stringify({ url, source_name: sourceName || 'Manual' }),
  });

export const autoDiscover = (): Promise<unknown> =>
  apiFetch('/api/auto-discover', { method: 'POST' });

// ── Thought Leadership ────────────────────────────────────────────────────────

export const fetchTLCandidates = (): Promise<{ candidates: TLCandidate[] }> =>
  apiFetch('/api/tl-candidates');

export const fetchTLPublished = (): Promise<{ entries: TLPublishedEntry[] }> =>
  apiFetch('/api/tl-published');

export const dismissTLCandidate = (url: string): Promise<void> =>
  apiFetch('/api/tl-candidates/dismiss', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });

export const runTLDiscover = (): Promise<void> =>
  apiFetch('/api/tl-discover', { method: 'POST' });

// ── Landscape ─────────────────────────────────────────────────────────────────

export const fetchLandscapeSuggestions = (): Promise<{ suggestions: LandscapeSuggestion[] }> =>
  apiFetch('/api/landscape-suggestions');

export const fetchLandscapeStale = (): Promise<{ stale: StaleEntry[] }> =>
  apiFetch('/api/landscape-stale');

export const applyLandscapeSuggestion = (id: string): Promise<void> =>
  apiFetch(`/api/landscape-suggestions/${id}/apply`, { method: 'POST' });

export const dismissLandscapeSuggestion = (id: string): Promise<void> =>
  apiFetch(`/api/landscape-suggestions/${id}/dismiss`, { method: 'POST' });

export const runLandscapeSweep = (): Promise<void> =>
  apiFetch('/api/landscape-sweep', { method: 'POST' });

// ── Audit ─────────────────────────────────────────────────────────────────────

export const fetchAuditReport = (): Promise<AuditReport> =>
  apiFetch('/api/audit/report');

export const runAuditFast = (): Promise<unknown> =>
  apiFetch('/api/audit');

export const runAuditDeep = (): Promise<unknown> =>
  apiFetch('/api/audit/deep');

// ── Blocked URLs ──────────────────────────────────────────────────────────────

export const fetchBlocked = (): Promise<{ blocked: BlockedUrl[] }> =>
  apiFetch('/api/blocked');

export const unblockUrl = (url: string): Promise<{ ok: boolean }> =>
  apiFetch('/api/blocked/unblock', { method: 'POST', body: JSON.stringify({ url }) });

// ── Health ────────────────────────────────────────────────────────────────────

export const fetchHealth = (): Promise<{ status: string; queue: number; blocked: number }> =>
  apiFetch('/api/health');
