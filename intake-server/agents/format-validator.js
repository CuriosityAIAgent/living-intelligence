// format-validator.js — pure schema validation, no Claude calls
// Returns { valid: true } or { valid: false, errors: ["field X is missing", ...] }

const VALID_TYPES = new Set([
  'funding', 'acquisition', 'regulatory', 'partnership',
  'product_launch', 'milestone', 'strategy_move', 'market_signal',
]);

const VALID_CAPABILITIES = new Set([
  'advisor_productivity', 'client_personalization', 'investment_portfolio',
  'research_content', 'client_acquisition', 'operations_compliance', 'new_business_models',
]);

const VALID_REGIONS = new Set(['us', 'emea', 'asia', 'latam', 'global']);

const VALID_SEGMENTS = new Set([
  'wirehouse', 'global_private_bank', 'regional_champion', 'digital_disruptor',
  'ai_native', 'ria_independent', 'advisor_tools',
]);

// Count sentences by looking for period/!/?  followed by a space or end-of-string.
// Decimal numbers like "14.00" or "2.5x" are not sentence boundaries.
function countSentences(text) {
  if (!text) return 0;
  // Match sentence-ending punctuation NOT preceded by a digit and followed by digit
  // i.e. split on [.!?] that are followed by whitespace or end-of-string,
  // but only when the period is NOT surrounded by digits (avoids 14.00, 2.5x, etc.)
  const matches = text.match(/(?<!\d)[.!?](?=\s|$)/g);
  return matches ? matches.length : 0;
}

// Given a YYYY-MM-DD date string, return the ISO date string of that week's Monday.
// Monday = day 1. Sunday = day 0. Saturday = day 6.
function getMondayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z'); // noon UTC avoids DST edge cases
  if (isNaN(d.getTime())) return null;

  const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - daysToSubtract);

  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const day = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function validateFormat(entry) {
  const errors = [];

  // ── headline ──────────────────────────────────────────────────────────────
  if (!entry.headline || typeof entry.headline !== 'string' || entry.headline.trim() === '') {
    errors.push('headline is missing or empty');
  } else if (entry.headline.length > 120) {
    errors.push(`headline exceeds 120 chars (${entry.headline.length})`);
  }

  // ── summary ───────────────────────────────────────────────────────────────
  if (!entry.summary || typeof entry.summary !== 'string' || entry.summary.trim() === '') {
    errors.push('summary is missing or empty');
  } else {
    const sentenceCount = countSentences(entry.summary);
    if (sentenceCount < 2) {
      errors.push(`summary must have at least 2 sentences (found ${sentenceCount})`);
    }
  }

  // ── the_so_what ───────────────────────────────────────────────────────────
  if (!entry.the_so_what || typeof entry.the_so_what !== 'string' || entry.the_so_what.trim() === '') {
    errors.push('the_so_what is missing or empty');
  }

  // ── company (slug format) ─────────────────────────────────────────────────
  if (!entry.company || typeof entry.company !== 'string' || entry.company.trim() === '') {
    errors.push('company is missing or empty');
  }

  // ── company_name ──────────────────────────────────────────────────────────
  if (!entry.company_name || typeof entry.company_name !== 'string' || entry.company_name.trim() === '') {
    errors.push('company_name is missing or empty');
  }

  // ── date — present, YYYY-MM-DD, not future ────────────────────────────────
  if (!entry.date || typeof entry.date !== 'string') {
    errors.push('date is missing');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
    errors.push(`date must match YYYY-MM-DD format (got "${entry.date}")`);
  } else {
    const articleDate = new Date(entry.date + 'T00:00:00Z');
    if (isNaN(articleDate.getTime())) {
      errors.push(`date "${entry.date}" is not a valid calendar date`);
    } else {
      const todayUTC = new Date();
      todayUTC.setUTCHours(0, 0, 0, 0);
      if (articleDate > todayUTC) {
        errors.push(`date "${entry.date}" is a future date`);
      }
    }
  }

  // ── week — present, YYYY-MM-DD, must be Monday of date's week ────────────
  if (!entry.week || typeof entry.week !== 'string') {
    errors.push('week is missing');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.week)) {
    errors.push(`week must match YYYY-MM-DD format (got "${entry.week}")`);
  } else if (entry.date && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
    const expectedMonday = getMondayOf(entry.date);
    if (expectedMonday && entry.week !== expectedMonday) {
      errors.push(`week "${entry.week}" is not the Monday of date "${entry.date}" (expected "${expectedMonday}")`);
    }
  }

  // ── type ──────────────────────────────────────────────────────────────────
  if (!entry.type || typeof entry.type !== 'string') {
    errors.push('type is missing');
  } else if (!VALID_TYPES.has(entry.type)) {
    errors.push(`type "${entry.type}" is not valid (must be one of: ${[...VALID_TYPES].join(' | ')})`);
  }

  // ── tags ──────────────────────────────────────────────────────────────────
  if (!entry.tags || typeof entry.tags !== 'object' || Array.isArray(entry.tags)) {
    errors.push('tags object is missing');
  } else {
    if (!('capability' in entry.tags)) {
      errors.push('tags.capability is missing');
    } else if (!VALID_CAPABILITIES.has(entry.tags.capability)) {
      errors.push(`tags.capability "${entry.tags.capability}" is not valid (must be one of: ${[...VALID_CAPABILITIES].join(' | ')})`);
    }

    if (!('region' in entry.tags)) {
      errors.push('tags.region is missing');
    } else if (!VALID_REGIONS.has(entry.tags.region)) {
      errors.push(`tags.region "${entry.tags.region}" is not valid (must be one of: ${[...VALID_REGIONS].join(' | ')})`);
    }

    if (!('segment' in entry.tags)) {
      errors.push('tags.segment is missing');
    } else if (!VALID_SEGMENTS.has(entry.tags.segment)) {
      errors.push(`tags.segment "${entry.tags.segment}" is not valid (must be one of: ${[...VALID_SEGMENTS].join(' | ')})`);
    }
  }

  // ── key_stat (optional — validate only if present) ────────────────────────
  if (entry.key_stat !== undefined && entry.key_stat !== null) {
    const ks = entry.key_stat;
    if (typeof ks !== 'object' || Array.isArray(ks)) {
      errors.push('key_stat must be an object if present');
    } else {
      if (
        ks.number === undefined ||
        ks.number === null ||
        typeof ks.number !== 'string' ||
        ks.number.trim() === ''
      ) {
        errors.push('key_stat.number is missing, null, or empty — remove key_stat or provide a valid number string');
      }
      if (
        ks.label === undefined ||
        ks.label === null ||
        typeof ks.label !== 'string' ||
        ks.label.trim() === ''
      ) {
        errors.push('key_stat.label is missing or empty');
      }
    }
  }

  // ── image_url (optional — validate only if present) ───────────────────────
  if (entry.image_url !== undefined && entry.image_url !== null && entry.image_url !== '') {
    if (typeof entry.image_url === 'string' && entry.image_url.includes('unavatar.io')) {
      errors.push('image_url must not use unavatar.io (broken pattern) — use a local logo or remove the field');
    }
  }

  // ── sources array (optional — validate structure if present) ──────────────
  if (entry.sources !== undefined && entry.sources !== null) {
    if (!Array.isArray(entry.sources)) {
      errors.push('sources must be an array if present');
    } else {
      const validTypes = new Set(['primary', 'coverage', 'discovery']);
      for (let i = 0; i < entry.sources.length; i++) {
        const s = entry.sources[i];
        if (!s.name || typeof s.name !== 'string') errors.push(`sources[${i}].name is missing or not a string`);
        if (!s.url || typeof s.url !== 'string' || !s.url.startsWith('http')) errors.push(`sources[${i}].url is missing or invalid`);
        if (!s.type || !validTypes.has(s.type)) errors.push(`sources[${i}].type must be primary, coverage, or discovery (got "${s.type}")`);
      }
      if (entry.source_count !== undefined && entry.source_count !== entry.sources.length) {
        errors.push(`source_count (${entry.source_count}) does not match sources array length (${entry.sources.length})`);
      }
    }
  }

  // ── source_url ────────────────────────────────────────────────────────────
  if (!entry.source_url || typeof entry.source_url !== 'string' || entry.source_url.trim() === '') {
    errors.push('source_url is missing or empty');
  } else if (!entry.source_url.startsWith('http')) {
    errors.push(`source_url must start with "http" (got "${entry.source_url.slice(0, 30)}...")`);
  }

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors };
}
