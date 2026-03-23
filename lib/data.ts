import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntelligenceEntry {
  id: string;
  type: 'funding' | 'acquisition' | 'regulatory' | 'partnership' | 'product_launch' | 'milestone' | 'strategy_move' | 'market_signal';
  headline: string;
  the_so_what?: string;
  company: string;
  company_name: string;
  date: string;
  published_at?: string;
  source_name: string;
  source_url: string;
  source_verified: boolean;
  additional_sources?: { name: string; url: string }[];
  image_url: string;
  summary: string;
  key_stat: { number: string; label: string } | null;
  capability_evidence?: {
    capability: string;
    stage: 'deployed' | 'piloting' | 'announced';
    evidence: string;
    metric: string | null;
  };
  tags: {
    capability: string;
    region: string;
    segment: string;
    theme: string[];
  };
  week: string;
  featured: boolean;
}

export interface ThoughtLeadershipEntry {
  id: string;
  type: string;
  title: string;
  author: {
    name: string;
    title: string;
    organization: string;
    photo_url: string;
  };
  publication: string;
  source_url: string;
  date_published: string;
  format: 'essay' | 'report' | 'speech' | 'interview' | 'research';
  executive_summary: string[];
  the_one_insight: string;
  key_quotes: { text: string; context: string }[];
  tags: string[];
  week: string;
  featured: boolean;
  has_document: boolean;
  document_url: string | null;
}

export interface WeeklyDigest {
  week: string;
  display_date: string;
  lead_story_id: string;
  featured_intelligence: string[];
  featured_thought_leadership: string;
  by_the_numbers: { number: string; label: string }[];
  editors_note: string;
}

export interface CapabilityEntry {
  maturity: 'announced' | 'piloting' | 'deployed' | 'scaled' | 'none';
  headline: string;
  detail: string;
  evidence: string[];
  sources?: { name: string; url: string }[];
  date_assessed: string;
  jpm_implication?: string;
  jpm_segments_affected?: string[];
}

export interface Competitor {
  id: string;
  name: string;
  segment: string;
  regions: string[];
  color?: string;
  ai_strategy_summary: string;
  head_of_ai?: { name: string; title: string } | null;
  headline_metric: string;
  headline_initiative: string;
  overall_maturity: 'announced' | 'piloting' | 'deployed' | 'scaled';
  capabilities: Record<string, CapabilityEntry>;
  last_updated: string;
}

export interface Capability {
  id: string;
  label: string;
  description: string;
}

// ─── Intelligence ─────────────────────────────────────────────────────────────

export function getAllIntelligence(): IntelligenceEntry[] {
  const dir = path.join(dataDir, 'intelligence');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const entries = files.map(f => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
    return JSON.parse(raw) as IntelligenceEntry;
  });
  // Sort by published_at (when we added it to portal) — falls back to date for legacy entries
  return entries.sort((a, b) => {
    const aTime = new Date(a.published_at || a.date).getTime();
    const bTime = new Date(b.published_at || b.date).getTime();
    return bTime - aTime;
  });
}

export function getIntelligenceEntry(id: string): IntelligenceEntry | null {
  const filepath = path.join(dataDir, 'intelligence', `${id}.json`);
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, 'utf-8')) as IntelligenceEntry;
}

// ─── Thought Leadership ───────────────────────────────────────────────────────

export function getAllThoughtLeadership(): ThoughtLeadershipEntry[] {
  const dir = path.join(dataDir, 'thought-leadership');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const entries = files.map(f => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
    return JSON.parse(raw) as ThoughtLeadershipEntry;
  });
  return entries.sort((a, b) => new Date(b.date_published).getTime() - new Date(a.date_published).getTime());
}

export function getThoughtLeadershipEntry(id: string): ThoughtLeadershipEntry | null {
  const filepath = path.join(dataDir, 'thought-leadership', `${id}.json`);
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, 'utf-8')) as ThoughtLeadershipEntry;
}

// ─── Weekly Digest ────────────────────────────────────────────────────────────

export function getLatestWeek(): WeeklyDigest | null {
  const dir = path.join(dataDir, 'weeks');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  if (files.length === 0) return null;
  files.sort().reverse();
  return JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf-8')) as WeeklyDigest;
}

export function getWeek(date: string): WeeklyDigest | null {
  const filepath = path.join(dataDir, 'weeks', `${date}.json`);
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, 'utf-8')) as WeeklyDigest;
}

// ─── Competitors / Landscape ──────────────────────────────────────────────────

export function getAllCompetitors(): Competitor[] {
  const dir = path.join(dataDir, 'competitors');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Competitor);
}

export function getCompetitor(id: string): Competitor | null {
  const filePath = path.join(dataDir, 'competitors', `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Competitor;
}

// ─── Capabilities ─────────────────────────────────────────────────────────────

export function getCapabilities(): Capability[] {
  const raw = fs.readFileSync(path.join(dataDir, 'capabilities', 'index.json'), 'utf-8');
  const parsed = JSON.parse(raw);
  return (parsed.capabilities || parsed) as Capability[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Re-export constants from the client-safe constants module
export { TYPE_LABELS, FORMAT_LABELS, SEGMENT_LABELS, MATURITY_ORDER, REGION_LABELS } from './constants';

