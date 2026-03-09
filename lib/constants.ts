// Pure constants — no Node.js built-ins, safe to import from client components

export const TYPE_LABELS: Record<string, string> = {
  partnership: 'Partnership',
  product_launch: 'Product Launch',
  milestone: 'Milestone',
  strategy_move: 'Strategy',
  market_signal: 'Market Signal',
};

export const FORMAT_LABELS: Record<string, string> = {
  essay: 'Essay',
  report: 'Report',
  speech: 'Speech',
  interview: 'Interview',
  research: 'Research Paper',
};

export const SEGMENT_LABELS: Record<string, string> = {
  global_bank: 'Global Bank',
  regional_champion: 'Regional Champion',
  digital_disruptor: 'Digital Disruptor',
  ria_independent: 'RIA / Independent',
  retail_digital: 'Retail Digital',
  uhnw_digital: 'UHNW Digital',
  boutique: 'Boutique',
  ai_native: 'AI-Native',
};

export const MATURITY_ORDER = ['scaled', 'deployed', 'piloting', 'announced', 'none'];

export const REGION_LABELS: Record<string, string> = {
  us: 'United States',
  emea: 'EMEA',
  asia: 'Asia Pacific',
  latam: 'Latin America',
};
