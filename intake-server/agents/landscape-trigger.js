/**
 * landscape-trigger.js
 *
 * Post-publish hook: when an intelligence entry is approved and published,
 * this runs (non-blocking) and checks whether the new evidence warrants
 * a maturity rating upgrade in the landscape competitor file.
 *
 * Only suggests UPGRADES — downgrades require human editorial judgment.
 * All suggestions require Haresh's one-click approval in Editorial Studio.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Content files (competitors) live in the repo clone — always repo-relative.
// State files (.landscape-suggestions.json) go to the persistent volume if available.
const CONTENT_ROOT    = join(__dirname, '..', '..', 'data');
const STATE_DIR       = (process.env.STATE_DIR || process.env.DATA_DIR) ? join(process.env.STATE_DIR || process.env.DATA_DIR, 'data') : CONTENT_ROOT;
const COMPETITORS_DIR = join(CONTENT_ROOT, 'competitors');
const SUGGESTIONS_FILE = join(STATE_DIR, '.landscape-suggestions.json');

const MATURITY_ORDER = ['no_activity', 'announced', 'piloting', 'deployed', 'scaled'];

// ── File helpers ──────────────────────────────────────────────────────────────

function loadSuggestions() {
  if (!existsSync(SUGGESTIONS_FILE)) return {};
  try { return JSON.parse(readFileSync(SUGGESTIONS_FILE, 'utf-8')); } catch { return {}; }
}

function saveSuggestions(suggestions) {
  writeFileSync(SUGGESTIONS_FILE, JSON.stringify(suggestions, null, 2), 'utf-8');
}

function findCompetitorFile(companyName) {
  if (!existsSync(COMPETITORS_DIR)) return null;
  const norm = companyName?.toLowerCase().trim();
  const files = readdirSync(COMPETITORS_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    try {
      const data = JSON.parse(readFileSync(join(COMPETITORS_DIR, f), 'utf-8'));
      if (data.name?.toLowerCase().trim() === norm) {
        return { filepath: join(COMPETITORS_DIR, f), data };
      }
    } catch { /* skip malformed */ }
  }
  return null;
}

// ── Core: check whether a published entry warrants a maturity upgrade ─────────

export async function checkLandscapeImpact(entry) {
  const companyName = entry.company_name;
  const capability  = entry.tags?.capability;

  if (!companyName || !capability) return; // needs both to match

  const competitor = findCompetitorFile(companyName);
  if (!competitor) return; // company not tracked in landscape

  const { filepath, data } = competitor;
  const cap = data.capabilities?.[capability];
  if (!cap) return; // capability not tracked for this company

  const currentMaturity = cap.maturity;
  const currentIdx      = MATURITY_ORDER.indexOf(currentMaturity);
  if (currentIdx === MATURITY_ORDER.length - 1) return; // already scaled — nothing higher

  const client = new Anthropic();

  const systemPrompt = `You audit landscape maturity ratings for a premium wealth management AI intelligence platform.
Maturity levels (ascending): no_activity → announced → piloting → deployed → scaled.
Definitions:
- announced: publicly committed to building, not yet in production
- piloting: live with select users, not broadly available
- deployed: live in production, partial/regional/limited adoption
- scaled: widely deployed across the firm, measurably impacting business outcomes
Be conservative. Only suggest an upgrade when the new evidence is unambiguous — a launch announcement ≠ deployed; a pilot ≠ deployed; a press release ≠ scaled.`;

  const userPrompt = `COMPANY: ${data.name}
CAPABILITY: ${capability}
CURRENT MATURITY: ${currentMaturity}
CURRENT EVIDENCE:
${JSON.stringify(cap.evidence, null, 2)}

NEW INTELLIGENCE ENTRY:
Headline: ${entry.headline}
Summary: ${entry.summary}
Key stat: ${entry.key_stat ? `${entry.key_stat.number} — ${entry.key_stat.label}` : 'none'}
Date: ${entry.date}

Does this new entry provide clear evidence to UPGRADE the maturity rating?
Respond with JSON only — no markdown fences:
{
  "should_update": true | false,
  "suggested_maturity": "${currentMaturity}",
  "reason": "one sentence citing specific evidence from the entry"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const text = response.content[0].text.trim()
      .replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const result = JSON.parse(text);

    if (!result.should_update) return;

    // Validate: only accept genuine upgrades
    const suggestedIdx = MATURITY_ORDER.indexOf(result.suggested_maturity);
    if (suggestedIdx <= currentIdx) return;

    const suggestions = loadSuggestions();
    const suggestionId = `${data.id}__${capability}__${Date.now()}`;
    suggestions[suggestionId] = {
      id:                      suggestionId,
      company_id:              data.id,
      company_name:            data.name,
      capability,
      current_maturity:        currentMaturity,
      suggested_maturity:      result.suggested_maturity,
      reason:                  result.reason,
      triggered_by_entry_id:   entry.id,
      triggered_by_headline:   entry.headline,
      triggered_by_date:       entry.date,
      competitor_filepath:     filepath,
      created_at:              new Date().toISOString(),
      status:                  'pending',
    };
    saveSuggestions(suggestions);

    console.log(`[landscape-trigger] Suggestion: ${data.name} · ${capability} · ${currentMaturity} → ${result.suggested_maturity}`);
  } catch (err) {
    // Non-fatal — the publish already succeeded
    console.warn('[landscape-trigger] check failed (non-fatal):', err.message);
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────

export function getLandscapeSuggestions() {
  const all = loadSuggestions();
  return Object.values(all).filter(s => s.status === 'pending');
}

export function applyLandscapeSuggestion(suggestionId) {
  const suggestions = loadSuggestions();
  const s = suggestions[suggestionId];
  if (!s || s.status !== 'pending') return null;

  // Load and mutate the competitor file
  const data = JSON.parse(readFileSync(s.competitor_filepath, 'utf-8'));
  const cap  = data.capabilities?.[s.capability];
  if (!cap) return null;

  cap.maturity      = s.suggested_maturity;
  cap.date_assessed = new Date().toISOString().split('T')[0];
  cap.evidence      = [
    ...(cap.evidence || []),
    `${s.triggered_by_headline} (${s.triggered_by_date}) — maturity upgraded from ${s.current_maturity} to ${s.suggested_maturity}`,
  ];
  data.last_updated = new Date().toISOString().split('T')[0];

  writeFileSync(s.competitor_filepath, JSON.stringify(data, null, 2), 'utf-8');

  // Mark suggestion applied
  s.status     = 'applied';
  s.applied_at = new Date().toISOString();
  saveSuggestions(suggestions);

  // Git commit + push to main
  _commitCompetitorUpdate({
    filepath: s.competitor_filepath,
    message: `Landscape: ${s.company_name} ${s.capability} ${s.current_maturity} → ${s.suggested_maturity}`,
  });

  return { company_id: data.id, capability: s.capability, new_maturity: s.suggested_maturity };
}

export function dismissLandscapeSuggestion(suggestionId) {
  const suggestions = loadSuggestions();
  if (!suggestions[suggestionId]) return false;
  suggestions[suggestionId].status       = 'dismissed';
  suggestions[suggestionId].dismissed_at = new Date().toISOString();
  saveSuggestions(suggestions);
  return true;
}

// ── Git ───────────────────────────────────────────────────────────────────────

function _commitCompetitorUpdate({ filepath, message }) {
  const gitToken = process.env.GIT_TOKEN;
  const repo     = process.env.GITHUB_REPO || 'CuriosityAIAgent/living-intelligence';
  const portalDir = process.env.PORTAL_DIR || join(__dirname, '..', '..');

  try {
    execSync(`git config --global --add safe.directory "${portalDir}"`, { stdio: 'pipe' });
    execSync(`git -C "${portalDir}" config user.email "intake-bot@portal.ai"`, { stdio: 'pipe' });
    execSync(`git -C "${portalDir}" config user.name "AI Portal Intake"`, { stdio: 'pipe' });

    if (gitToken) {
      execSync(
        `git -C "${portalDir}" remote set-url origin "https://${gitToken}@github.com/${repo}.git"`,
        { stdio: 'pipe' }
      );
    }

    execSync(`git -C "${portalDir}" add "${filepath}"`, { stdio: 'pipe' });

    // Exit if nothing staged (file unchanged)
    try {
      execSync(`git -C "${portalDir}" diff --cached --quiet`, { stdio: 'pipe' });
      return; // nothing to commit
    } catch { /* changes staged — proceed */ }

    execSync(
      `git -C "${portalDir}" commit -m "${message}\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`,
      { stdio: 'pipe' }
    );
    execSync(`git -C "${portalDir}" push origin main`, { stdio: 'pipe' });
    console.log(`[landscape-trigger] Committed + pushed: ${message}`);
  } catch (err) {
    console.warn('[landscape-trigger] git commit failed (non-fatal):', err.message);
  }
}
