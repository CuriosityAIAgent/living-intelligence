/**
 * landscape-sweep.js — Phase 6b
 *
 * Staleness sweep: reads all 37 competitor files, finds capabilities with
 * date_assessed > STALE_DAYS, searches for recent news on each, and asks
 * Claude whether the evidence warrants a maturity change.
 *
 * Suggestions are written to .landscape-suggestions.json (same store as
 * landscape-trigger.js) with source: 'staleness_sweep'.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_ROOT       = process.env.DATA_DIR || join(__dirname, '..', '..');
const COMPETITORS_DIR = join(DATA_ROOT, 'data', 'competitors');
const SUGGESTIONS_FILE = join(DATA_ROOT, 'data', '.landscape-suggestions.json');

const STALE_DAYS = 45;
const MATURITY_ORDER = ['no_activity', 'announced', 'piloting', 'deployed', 'scaled'];

// ── Suggestion store (shared with landscape-trigger.js) ──────────────────────

function loadSuggestions() {
  if (!existsSync(SUGGESTIONS_FILE)) return {};
  try { return JSON.parse(readFileSync(SUGGESTIONS_FILE, 'utf-8')); } catch { return {}; }
}

function saveSuggestions(s) {
  writeFileSync(SUGGESTIONS_FILE, JSON.stringify(s, null, 2), 'utf-8');
}

// ── Staleness check ───────────────────────────────────────────────────────────

function daysSince(dateStr) {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 999;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function getStaleCapabilities() {
  if (!existsSync(COMPETITORS_DIR)) return [];
  const stale = [];
  const files = readdirSync(COMPETITORS_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    try {
      const data = JSON.parse(readFileSync(join(COMPETITORS_DIR, f), 'utf-8'));
      for (const [capId, cap] of Object.entries(data.capabilities || {})) {
        if (!cap || cap.maturity === 'no_activity') continue; // skip inactive
        const age = daysSince(cap.date_assessed);
        if (age > STALE_DAYS) {
          stale.push({
            company_id:   data.id,
            company_name: data.name,
            segment:      data.segment,
            capability:   capId,
            current_maturity: cap.maturity,
            days_stale:   age,
            date_assessed: cap.date_assessed || null,
            filepath:     join(COMPETITORS_DIR, f),
            current_evidence: cap.evidence || [],
          });
        }
      }
    } catch { /* skip malformed */ }
  }
  // Sort by most stale first
  return stale.sort((a, b) => b.days_stale - a.days_stale);
}

// ── Jina search ───────────────────────────────────────────────────────────────

const CAPABILITY_LABELS = {
  advisor_productivity:    'AI advisor productivity tools',
  client_personalization:  'AI client personalization wealth',
  investment_portfolio:    'AI investment portfolio management',
  research_content:        'AI research content generation',
  client_acquisition:      'AI client acquisition digital',
  operations_compliance:   'AI operations compliance automation',
  new_business_models:     'AI new business models platform',
};

async function searchRecent(companyName, capability) {
  const topic  = CAPABILITY_LABELS[capability] || capability.replace(/_/g, ' ');
  const query  = `${companyName} ${topic} 2025 2026`;
  const jinaUrl = `https://s.jina.ai/${encodeURIComponent(query)}`;
  const headers = { 'Accept': 'text/plain' };
  if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;

  try {
    const res = await fetch(jinaUrl, { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 4000);
  } catch {
    return null;
  }
}

// ── Claude assessment ─────────────────────────────────────────────────────────

const client = new Anthropic();

async function assessMaturity(staleEntry, searchResults) {
  if (!searchResults) return null;

  const { company_name, capability, current_maturity, current_evidence } = staleEntry;
  const currentIdx = MATURITY_ORDER.indexOf(current_maturity);
  if (currentIdx === MATURITY_ORDER.length - 1) return null; // already scaled

  const prompt = `You are auditing a landscape maturity rating for a wealth management AI tracking platform.

COMPANY: ${company_name}
CAPABILITY: ${capability}
CURRENT MATURITY: ${current_maturity} (last assessed ${staleEntry.date_assessed || 'unknown'})
CURRENT EVIDENCE:
${JSON.stringify(current_evidence)}

RECENT SEARCH RESULTS (2025-2026):
${searchResults}

MATURITY LEVELS (ascending): no_activity → announced → piloting → deployed → scaled
- announced: publicly committed, not in production
- piloting: live with select users, not broadly available
- deployed: live in production, partial/limited adoption
- scaled: widely deployed, measurable business impact

Based ONLY on the search results above:
1. Is there clear evidence of a HIGHER maturity level than ${current_maturity}?
2. Only flag an upgrade if you found a specific named product, deployment announcement, or measurable outcome.

Return JSON only (no fences):
{
  "should_update": true | false,
  "suggested_maturity": "${current_maturity}",
  "evidence_found": "one sentence describing what specifically was found in the search results",
  "source_hint": "brief URL or publication name from the results"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].text.trim()
      .replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const result = JSON.parse(text);

    if (!result.should_update) return null;

    const suggestedIdx = MATURITY_ORDER.indexOf(result.suggested_maturity);
    if (suggestedIdx <= currentIdx) return null; // not an upgrade

    return result;
  } catch {
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runLandscapeSweep({ send }) {
  send('status', { message: 'Scanning competitor files for stale capabilities...' });

  const stale = getStaleCapabilities();
  send('status', { message: `Found ${stale.length} stale capabilities (>${STALE_DAYS} days)` });

  if (stale.length === 0) {
    send('done', { checked: 0, suggestions: 0 });
    return;
  }

  let checked = 0;
  let newSuggestions = 0;
  const existing = loadSuggestions();

  for (const entry of stale) {
    const { company_name, capability, current_maturity } = entry;

    // Skip if a pending suggestion already exists for this company+capability
    const alreadyPending = Object.values(existing).some(
      s => s.company_id === entry.company_id &&
           s.capability === capability &&
           s.status === 'pending'
    );
    if (alreadyPending) {
      send('status', { message: `Skip ${company_name} · ${capability} — suggestion already pending` });
      continue;
    }

    send('status', { message: `Searching: ${company_name} · ${capability} (${current_maturity}, ${entry.days_stale}d stale)` });

    const results = await searchRecent(company_name, capability);
    if (!results) {
      send('status', { message: `  No results for ${company_name} · ${capability}` });
      checked++;
      continue;
    }

    const assessment = await assessMaturity(entry, results);
    checked++;

    if (!assessment) {
      send('status', { message: `  ${company_name} · ${capability}: no change needed` });
      continue;
    }

    // Write suggestion
    const suggestionId = `${entry.company_id}__${capability}__sweep__${Date.now()}`;
    existing[suggestionId] = {
      id:                  suggestionId,
      company_id:          entry.company_id,
      company_name,
      capability,
      current_maturity,
      suggested_maturity:  assessment.suggested_maturity,
      reason:              assessment.evidence_found,
      source_hint:         assessment.source_hint || null,
      days_stale:          entry.days_stale,
      competitor_filepath: entry.filepath,
      source:              'staleness_sweep',
      created_at:          new Date().toISOString(),
      status:              'pending',
    };
    saveSuggestions(existing);
    newSuggestions++;

    send('status', { message: `  ✓ Suggestion: ${company_name} · ${capability} · ${current_maturity} → ${assessment.suggested_maturity}` });

    // Small delay between Claude calls to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  send('done', { checked, suggestions: newSuggestions });
}

// ── Export stale list (for UI display without running full sweep) ─────────────

export function getStaleList() {
  return getStaleCapabilities().map(s => ({
    company_id:      s.company_id,
    company_name:    s.company_name,
    capability:      s.capability,
    current_maturity: s.current_maturity,
    days_stale:      s.days_stale,
    date_assessed:   s.date_assessed,
  }));
}
