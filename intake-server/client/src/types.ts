// ── Governance audit block ────────────────────────────────────────────────────

export interface GovernanceAudit {
  verdict: 'PASS' | 'REVIEW' | 'FAIL';
  confidence: number;
  verified_claims: string[];
  unverified_claims: string[];
  fabricated_claims: string[];
  notes: string;
  paywall_caveat: boolean;
  verified_at: string;
  human_approved: boolean;
  approved_at: string | null;
  fallback_sources?: string[];
}

// ── Intelligence entry ────────────────────────────────────────────────────────

export interface KeyStat {
  number: string;
  label: string;
}

export interface Tags {
  region?: string;
  sector?: string;
  theme?: string;
  [key: string]: string | undefined;
}

export interface IntelligenceEntry {
  id: string;
  headline: string;
  summary: string;
  the_so_what: string;
  company: string;
  company_name: string;
  date: string;
  published_at?: string;
  type: string;
  tags?: Tags;
  key_stat?: KeyStat;
  source_url?: string;
  source_name?: string;
  image_url?: string | null;
  featured?: boolean;
  _governance?: GovernanceAudit;
}

// ── Inbox item (pending queue) ────────────────────────────────────────────────

export interface InboxItem {
  id: string;
  entry: IntelligenceEntry;
  governance: GovernanceAudit;
  queued_at: string;
  discovered_at?: string;
  score?: number;
  score_breakdown?: string;
  governance_verdict?: string;
}

export interface InboxResponse {
  count: number;
  items: InboxItem[];
  archive_count: number;
}

// ── Pipeline status ───────────────────────────────────────────────────────────

export interface BlockedItem {
  url: string;
  title?: string;
  reason: string;
  score?: number;
}

export interface TLCandidate {
  url: string;
  title: string;
  snippet?: string;
  source?: string;
  date?: string;
}

export interface PipelineStatus {
  // New scheduler format
  last_run_at?: string;
  last_run_found?: number;
  last_run_queued?: number;
  last_run_blocked?: number;
  inbox_count?: number;
  published_today?: number;
  rejected_today?: number;
  blocked_total?: number;
  // Legacy scheduler format
  started_at?: string;
  candidates_found?: number;
  queued?: number;
  blocked?: number;
  errors?: number;
  tl_candidates?: number;
  tl_items?: TLCandidate[];
  blocked_items?: BlockedItem[];
}

// ── Activity log ──────────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  action: 'approved' | 'rejected';
  id: string;
  headline: string;
  company_name?: string;
  reason?: string;
  notes?: string;
  timestamp: string;
}

export interface ActivityLogResponse {
  log: ActivityLogEntry[];
}

// ── TL candidates and published ───────────────────────────────────────────────

export interface TLPublishedEntry {
  id: string;
  title: string;
  author: {
    name?: string;
    organization?: string;
  };
  date_published: string;
  format: string;
}

// ── Landscape ─────────────────────────────────────────────────────────────────

export interface LandscapeSuggestion {
  id: string;
  company: string;
  capability: string;
  suggested_maturity: string;
  reason: string;
}

export interface StaleEntry {
  id: string;
  company: string;
  capability: string;
  last_assessed: string;
  current_maturity: string;
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export interface AuditIssue {
  id: string;
  field: string;
  issue: string;
  severity: 'error' | 'warning' | 'info';
}

export interface AuditReport {
  total: number;
  issues: AuditIssue[];
  checked_at: string;
}

// ── Blocked URLs ──────────────────────────────────────────────────────────────

export interface BlockedUrl {
  url: string;
  entry_id?: string;
  reason: string;
  blocked_at?: string;
}
