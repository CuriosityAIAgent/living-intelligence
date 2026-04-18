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
import { join } from 'path';
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import { REPO_ROOT, COMPETITORS_DIR, STATE_DIR } from './config.js';

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
  const atMax           = currentIdx === MATURITY_ORDER.length - 1;

  const client = new Anthropic();

  const systemPrompt = `You audit landscape capability profiles for a premium wealth management AI intelligence platform.
Maturity levels (ascending): no_activity → announced → piloting → deployed → scaled.
Definitions:
- announced: publicly committed to building, not yet in production
- piloting: live with select users, not broadly available
- deployed: live in production, partial/regional/limited adoption
- scaled: widely deployed across the firm, measurably impacting business outcomes

Your job: determine whether a new intelligence entry warrants updating this company's landscape profile.
Two types of updates:
1. MATURITY UPGRADE — the new evidence moves the company to a higher maturity level. Be conservative.
2. EVIDENCE UPDATE — the company stays at the same maturity, but the new entry is a significant development (new product, new metric, expanded deployment) that should update the headline and evidence list. This is common for companies already at "deployed" or "scaled" that ship something new.`;

  const userPrompt = `COMPANY: ${data.name}
CAPABILITY: ${capability}
CURRENT MATURITY: ${currentMaturity}
CURRENT HEADLINE: ${cap.headline}
CURRENT EVIDENCE:
${JSON.stringify(cap.evidence, null, 2)}

NEW INTELLIGENCE ENTRY:
Headline: ${entry.headline}
Summary: ${entry.summary}
Key stat: ${entry.key_stat ? `${entry.key_stat.number} — ${entry.key_stat.label}` : 'none'}
Capability evidence: ${entry.capability_evidence ? `${entry.capability_evidence.stage} — ${entry.capability_evidence.evidence}` : 'none'}
Date: ${entry.date}

Decide:
- If the entry warrants a maturity UPGRADE, set update_type to "maturity_upgrade"
- If the entry is a significant new development at the SAME maturity level (new product, new metric, expanded deployment), set update_type to "evidence_update"
- If the entry adds nothing significant beyond what's already in the evidence list, set update_type to "none"

${atMax ? 'NOTE: This company is already at "scaled" (highest level), so maturity_upgrade is not possible. Focus on evidence_update.' : ''}

Respond with JSON only — no markdown fences:
{
  "update_type": "maturity_upgrade" | "evidence_update" | "none",
  "suggested_maturity": "${currentMaturity}",
  "suggested_headline": "updated one-line headline for this capability (only if update_type != none)",
  "new_evidence_line": "one evidence bullet to add, citing the specific fact and date from the entry (only if update_type != none)",
  "reason": "one sentence explaining why this warrants an update"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const text = response.content[0].text.trim()
      .replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const result = JSON.parse(text);

    if (result.update_type === 'none') return;

    // Validate maturity upgrade is genuine
    if (result.update_type === 'maturity_upgrade') {
      const suggestedIdx = MATURITY_ORDER.indexOf(result.suggested_maturity);
      if (suggestedIdx <= currentIdx) return;
    }

    const suggestions = loadSuggestions();
    const suggestionId = `${data.id}__${capability}__${Date.now()}`;
    suggestions[suggestionId] = {
      id:                      suggestionId,
      company_id:              data.id,
      company_name:            data.name,
      capability,
      update_type:             result.update_type,
      current_maturity:        currentMaturity,
      suggested_maturity:      result.suggested_maturity || currentMaturity,
      suggested_headline:      result.suggested_headline || null,
      new_evidence_line:       result.new_evidence_line || null,
      reason:                  result.reason,
      triggered_by_entry_id:   entry.id,
      triggered_by_headline:   entry.headline,
      triggered_by_date:       entry.date,
      competitor_filepath:     filepath,
      created_at:              new Date().toISOString(),
      status:                  'pending',
    };
    saveSuggestions(suggestions);

    console.log(`[landscape-trigger] Suggestion (${result.update_type}): ${data.name} · ${capability} · ${result.reason?.slice(0, 80)}`);
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

  // Apply maturity change (if upgrade)
  if (s.update_type === 'maturity_upgrade' && s.suggested_maturity) {
    cap.maturity = s.suggested_maturity;
  }

  // Apply headline update
  if (s.suggested_headline) {
    cap.headline = s.suggested_headline;
  }

  // Add new evidence line
  if (s.new_evidence_line) {
    cap.evidence = [...(cap.evidence || []), s.new_evidence_line];
  } else {
    // Fallback: generic evidence line
    const label = s.update_type === 'maturity_upgrade'
      ? `maturity upgraded from ${s.current_maturity} to ${s.suggested_maturity}`
      : 'evidence updated';
    cap.evidence = [...(cap.evidence || []), `${s.triggered_by_headline} (${s.triggered_by_date}) — ${label}`];
  }

  cap.date_assessed = new Date().toISOString().split('T')[0];
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
  const portalDir = process.env.PORTAL_DIR || REPO_ROOT;

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
    execSync(`git -C "${portalDir}" push origin feature/landing-page`, { stdio: 'pipe' });
    console.log(`[landscape-trigger] Committed + pushed: ${message}`);
  } catch (err) {
    console.warn('[landscape-trigger] git commit failed (non-fatal):', err.message);
  }
}
