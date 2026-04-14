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

// ── Fabrication check result ─────────────────────────────────────────────────

export interface FabricationResult {
  verdict: 'CLEAN' | 'SUSPECT' | 'FAIL';
  issues: string[];
  check_details?: Record<string, string>;
  checked_at: string;
}

// ── Context enrichment result ─────────────────────────────────────────────────

export interface LandscapeContext {
  current_maturity: string | null;
  maturity_direction: 'up' | 'down' | 'stable' | 'unknown';
  competitor_gap: string | null;
}

export interface EnrichmentResult {
  the_so_what: string;
  what_changed: string | null;
  landscape_context: LandscapeContext | null;
  enrichment_confidence: 'high' | 'medium' | 'low';
  enrichment_notes: string | null;
  landscape_already_covered: boolean;
  landscape_match_notes: string | null;
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
  // Session 8 — new pipeline agent outputs
  fabrication_verdict?: 'CLEAN' | 'SUSPECT' | 'FAIL';
  fabrication_issues?: string[];
  format_errors?: string[];
  enrichment?: EnrichmentResult;
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

export interface PipelineRun {
  started_at: string;
  candidates_found: number;
  queued: number;
  blocked: number;
  errors: number;
  tl_candidates: number;
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
  title?: string;
  score?: number;
  reason: string;
  blocked_at?: string;
}

// ── V2 Pipeline Types ────────────────────────────────────────────────────────

export interface V2Source {
  url: string;
  name?: string;
  type?: 'primary' | 'coverage' | 'discovery';
  key_facts?: string[];
}

export interface V2Evaluation {
  checks?: Record<string, { pass: boolean; feedback?: string }>;
  overall?: string;
  score?: number;
}

export interface V2Entry {
  headline: string;
  summary: string;
  the_so_what: string;
  key_stat?: KeyStat;
  company: string;
  company_name: string;
  date: string;
  type: string;
  source_url?: string;
  source_name?: string;
  sources?: V2Source[];
  _research?: {
    source_count?: number;
    research_confidence?: string;
    whats_new?: string;
    peer_context?: Array<{ company: string; capability: string; maturity: string }>;
  };
  _iterations?: Array<{ version: number; score?: number; feedback?: string }>;
  _fabrication?: {
    verdict: string;
    claims_checked?: number;
    claims_verified?: number;
    claims_fabricated?: number;
    details?: Array<{ claim: string; source?: string; status: string }>;
  };
}

export interface V2Brief {
  id: string;
  headline: string;
  source_url: string;
  source_name?: string;
  company_name?: string;
  company_id?: string;
  status: 'ready' | 'processing' | 'produced' | 'held' | 'duplicate' | 'development' | 'approved' | 'rejected';
  created_at: string;
  processed_at?: string;
  v2_entry?: V2Entry;
  v2_score?: number;
  v2_fabrication_verdict?: string;
  v2_evaluation?: V2Evaluation;
  decision?: string;
  decision_reason?: string;
  decided_by?: string;
  decided_at?: string;
  similarity_match?: { type: string; match_id?: string; similarity?: number };
}

export interface V2InboxResponse {
  entries: V2Brief[];
  count: number;
}

export interface V2HeldResponse {
  entries: V2Brief[];
  count: number;
}

export interface EditorialDecision {
  id: string;
  brief_id?: string;
  entry_id?: string;
  decision: string;
  reason?: string;
  editor_notes?: string;
  decided_by?: string;
  decided_at: string;
  pipeline_score?: number;
  evaluator_score?: number;
  capability?: string;
  entry_type?: string;
  draft_snapshot?: V2Entry;
}

export interface V2HistoryResponse {
  decisions: EditorialDecision[];
  count: number;
}

export interface V2BatchResult {
  produced: number;
  held: number;
  duplicates: number;
  developments: number;
  errors: number;
}
