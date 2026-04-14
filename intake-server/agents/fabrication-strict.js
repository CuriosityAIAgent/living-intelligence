/**
 * fabrication-strict.js — Exact-text fabrication detection
 *
 * Single responsibility: verify that specific numbers, names, statistics,
 * and quoted phrases in the entry appear VERBATIM in the source text.
 * This is complementary to governance.js (which checks logical support).
 *
 * Called AFTER governance.js. Both use a 12k source window.
 *
 * Checked fields: headline · summary · key_stat (the_so_what excluded — editorial analysis)
 *
 * Returns: { verdict: "CLEAN" | "SUSPECT" | "FAIL", issues: string[], checked_at: ISO string }
 *
 *   CLEAN   — all explicit numbers, names, stats, quotes verified verbatim in source
 *   SUSPECT — item not found but source may be truncated (not contradicted) — flag, don't block
 *   FAIL    — a specific number or quote is demonstrably contradicted by the source → HARD BLOCK
 */

import Anthropic from '@anthropic-ai/sdk';
import { SOURCE_WINDOW } from './config.js';
import { build as buildFabV1Prompt, VERSION as FAB_V1_VERSION } from '../prompts/fabrication-v1.js';
import { build as buildFabV2Prompt, VERSION as FAB_V2_VERSION } from '../prompts/fabrication-v2.js';

const client = new Anthropic();

export async function checkFabrication({ entry, sourceMarkdown }) {
  const sourceSnippet = (sourceMarkdown || '').slice(0, SOURCE_WINDOW);

  const keyStat = entry.key_stat
    ? `${entry.key_stat.number} — ${entry.key_stat.label}`
    : 'none';

  const prompt = buildFabV1Prompt({
    headline: entry.headline,
    summary: entry.summary,
    keyStat,
    company_name: entry.company_name,
    date: entry.date,
    sourceMarkdown: sourceSnippet,
    sourceWindow: SOURCE_WINDOW,
  });

  let raw;
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });
    raw = response.content[0].text.trim();
  } catch (err) {
    return {
      verdict: 'SUSPECT',
      issues: [`Fabrication check API call failed: ${err.message}`],
      checked_at: new Date().toISOString(),
    };
  }

  // Extract JSON from response — Claude occasionally adds a brief preamble
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      verdict: 'SUSPECT',
      issues: [`Fabrication check returned non-JSON response — manual review required. Raw: ${raw.slice(0, 200)}`],
      checked_at: new Date().toISOString(),
    };
  }

  let result;
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    return {
      verdict: 'SUSPECT',
      issues: [`Fabrication check JSON parse error: ${parseErr.message}. Raw snippet: ${raw.slice(0, 200)}`],
      checked_at: new Date().toISOString(),
    };
  }

  // Normalise and guard against unexpected model responses
  const verdict = ['CLEAN', 'SUSPECT', 'FAIL'].includes(result.verdict)
    ? result.verdict
    : 'SUSPECT';

  const issues = Array.isArray(result.issues) ? result.issues : [];

  return {
    verdict,
    issues,
    check_details: result.check_details || null,
    checked_at: new Date().toISOString(),
  };
}

// ── v2 Fabrication Check — Multi-source, drift detection ──────────────────────

/**
 * Enhanced fabrication check for v2 pipeline.
 * - Checks claims against ALL sources (not just primary)
 * - Detects drift between iterations (claims added during refinement)
 * - Handles the_so_what: editorial insight OK, factual claims must be sourced
 *
 * @param {Object} params
 * @param {Object} params.draft - Current draft entry
 * @param {Object} params.researchBrief - Full research brief with source texts
 * @param {Object} [params.previousDraft] - Previous draft (for drift detection)
 * @returns {Object} Fabrication report
 */
export async function checkFabricationV2({ draft, researchBrief, previousDraft }) {
  // Build combined source text from ALL sources — use full raw Jina markdown
  // Opus handles 200K context; truncation loses evidence and degrades verification quality
  const sourceTexts = [
    `=== PRIMARY: ${researchBrief.primary_source.name} ===\n${researchBrief.primary_source.content}`,
    ...(researchBrief.additional_sources || []).map(s =>
      `=== ${s.name} (${s.type}) ===\n${s.content}`
    ),
  ].join('\n\n');

  const keyStat = draft.key_stat
    ? `${draft.key_stat.number} — ${draft.key_stat.label}`
    : 'none';

  // Build drift section if we have a previous draft
  let driftSection = '';
  if (previousDraft) {
    driftSection = `
DRIFT DETECTION — Compare current draft against previous version. Flag any claims that:
- Appear in the current draft but NOT in the previous draft AND NOT in any source
- Changed a qualifier (e.g., "potentially 4 hours" became "4 hours")
- Strengthened a claim (e.g., "piloting" became "deployed")

PREVIOUS DRAFT:
Headline: ${previousDraft.headline}
Summary: ${previousDraft.summary}
the_so_what: ${previousDraft.the_so_what}
Key stat: ${previousDraft.key_stat ? `${previousDraft.key_stat.number} — ${previousDraft.key_stat.label}` : 'none'}
`;
  }

  const prompt = buildFabV2Prompt({
    headline: draft.headline,
    summary: draft.summary,
    the_so_what: draft.the_so_what,
    keyStat,
    company_name: draft.company_name,
    sourceTexts,
    source_count: researchBrief.source_count,
    driftSection,
  });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        verdict: 'SUSPECT',
        claims_checked: 0, claims_verified: 0, claims_unverified: 0, claims_fabricated: 0,
        details: [], cross_source_conflicts: [], drift_from_previous: [],
        issues: ['Fabrication v2: no JSON in response'],
        checked_at: new Date().toISOString(),
      };
    }

    const result = JSON.parse(jsonMatch[0]);

    // Normalise verdict
    const verdict = ['CLEAN', 'SUSPECT', 'FAIL'].includes(result.verdict) ? result.verdict : 'SUSPECT';

    return {
      verdict,
      claims_checked: result.claims_checked || 0,
      claims_verified: result.claims_verified || 0,
      claims_unverified: result.claims_unverified || 0,
      claims_fabricated: result.claims_fabricated || 0,
      details: Array.isArray(result.details) ? result.details : [],
      cross_source_conflicts: Array.isArray(result.cross_source_conflicts) ? result.cross_source_conflicts : [],
      drift_from_previous: Array.isArray(result.drift_from_previous) ? result.drift_from_previous : [],
      issues: Array.isArray(result.issues) ? result.issues : [],
      checked_at: new Date().toISOString(),
    };
  } catch (err) {
    return {
      verdict: 'SUSPECT',
      claims_checked: 0, claims_verified: 0, claims_unverified: 0, claims_fabricated: 0,
      details: [], cross_source_conflicts: [], drift_from_previous: [],
      issues: [`Fabrication v2 API error: ${err.message}`],
      checked_at: new Date().toISOString(),
    };
  }
}
