import fs from 'fs';
import path from 'path';

export interface CapabilityEntry {
  maturity: 'announced' | 'piloting' | 'deployed' | 'scaled' | 'none';
  headline: string;
  detail: string;
  evidence: string[];
  jpm_implication: string;
  jpm_segments_affected: string[];
  date_assessed: string;
}

export interface Competitor {
  id: string;
  name: string;
  segment: string;
  regions: string[];
  color: string;
  ai_strategy_summary: string;
  head_of_ai: { name: string; title: string } | null;
  headline_metric: string;
  headline_initiative: string;
  overall_maturity: string;
  capabilities: Record<string, CapabilityEntry>;
  last_updated: string;
}

export interface PulseCard {
  id: string;
  competitor_id: string;
  competitor_name: string;
  headline: string;
  detail: string;
  implication: string;
  source_url: string;
  region: string;
  segment: string;
  impact: 'high' | 'medium' | 'low';
  date: string;
}

export interface Pulse {
  date: string;
  headline_cards: PulseCard[];
  talking_points: string[];
  stat_of_the_week: { number: string; label: string; context: string };
  total_developments_tracked: number;
}

export interface Capability {
  id: string;
  label: string;
  description: string;
}

const dataDir = path.join(process.cwd(), 'data');

export function getAllCompetitors(): Competitor[] {
  const dir = path.join(dataDir, 'competitors');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
    return JSON.parse(raw) as Competitor;
  });
}

export function getCompetitor(id: string): Competitor | null {
  const filePath = path.join(dataDir, 'competitors', `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Competitor;
}

export function getLatestPulse(): Pulse {
  const dir = path.join(dataDir, 'pulse');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse();
  const raw = fs.readFileSync(path.join(dir, files[0]), 'utf-8');
  return JSON.parse(raw) as Pulse;
}

export function getCapabilities(): Capability[] {
  const raw = fs.readFileSync(path.join(dataDir, 'capabilities', 'index.json'), 'utf-8');
  return JSON.parse(raw).capabilities as Capability[];
}

export const SEGMENT_LABELS: Record<string, string> = {
  global_bank: 'Global Bank',
  regional_champion: 'Regional Champion',
  digital_disruptor: 'Digital Disruptor',
  ria_independent: 'RIA / Independent',
  boutique: 'Boutique',
  ai_native: 'AI-Native',
};

export const MATURITY_ORDER = ['scaled', 'deployed', 'piloting', 'announced', 'none'];

export const REGION_LABELS: Record<string, string> = {
  us: 'United States',
  emea: 'EMEA',
  asia: 'Asia',
  latam: 'Latin America',
};
