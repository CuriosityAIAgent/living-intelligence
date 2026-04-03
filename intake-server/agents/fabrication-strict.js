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

const client = new Anthropic();

export async function checkFabrication({ entry, sourceMarkdown }) {
  const sourceSnippet = (sourceMarkdown || '').slice(0, SOURCE_WINDOW);

  const keyStat = entry.key_stat
    ? `${entry.key_stat.number} — ${entry.key_stat.label}`
    : 'none';

  const prompt = `You are a fabrication-detection agent for a premium financial intelligence platform.

Your job is STRICTLY different from general fact-checking: you verify that key facts in the entry are supported by the source. You check numbers, names, and quoted phrases.

IMPORTANT — what counts as a match:
- Exact numbers: "5,000" matches "5,000" → PASS
- Equivalent expressions: "120M+" matches "more than 100 million" → PASS (same order of magnitude, consistent direction)
- Rounded numbers: "~5,000" matches "nearly 5,000" or "approximately 5,000" → PASS
- Abbreviation vs full: "$45M" matches "$45 million" → PASS
- Different numbers for the same metric: "$50M" in entry but "$30M" in source → FAIL (genuine contradiction)

Only FAIL on genuine contradictions — where the entry states a specific number and the source states a DIFFERENT number for the same thing.

ENTRY TO CHECK:
---
Headline: ${entry.headline}
Summary: ${entry.summary}
Key stat: ${keyStat}
Company name: ${entry.company_name}
Date: ${entry.date}
---

NOTE: The entry has a "the_so_what" field but it is EXCLUDED from this check. It contains intentional editorial analysis and interpretation — not claims from the source article. Do NOT check it.

SOURCE ARTICLE (first ${SOURCE_WINDOW.toLocaleString()} chars — may be truncated):
---
${sourceSnippet}
---

Answer each of the following six checks precisely:

1. NUMBERS IN HEADLINE — Extract every digit sequence from the headline (e.g. "150", "2.5", "$4B"). For each: does the source contain the same number or an equivalent expression (e.g. "$45M" = "$45 million", "5,000+" = "more than 5,000", "120M" = "more than 100 million")? If equivalent → PASS. If the source has a DIFFERENT number for the same metric → FAIL. If not found at all (possible truncation) → not_found_truncation.

2. COMPANY NAME SPELLING — Is "${entry.company_name}" spelled exactly as it appears in the source? Check the source for the company name and report the exact spelling found. If the source uses a different form (e.g. "JPMorgan Chase" vs "JPMorgan"), flag it only if the forms are substantively different (not just abbreviation vs full name).

3. DATE VERIFICATION — Does the year "${entry.date.slice(0, 4)}" appear in the source text? (We check year only — exact date in article body is unreliable.) If the source contains a clearly different year for the same events, flag it.

4. KEY STAT VERBATIM — ${entry.key_stat ? `The key stat is "${entry.key_stat.number}". Does this exact number appear literally in the source text? If not: is it contradicted by a different number in the source, or simply absent (possible truncation)?` : 'No key stat to check.'}

5. QUOTED PHRASES IN SUMMARY — Identify any phrase in the summary enclosed in quotation marks or attributed with "said", "noted", "announced", "stated". For each: find the verbatim match in the source. Flag any that cannot be found.

After checking all five, return a JSON object in exactly this format:
{
  "verdict": "CLEAN" | "SUSPECT" | "FAIL",
  "issues": ["list of specific problems found — empty array if CLEAN"],
  "check_details": {
    "numbers_in_headline": "pass | fail | not_found_truncation | none",
    "company_name": "pass | fail",
    "date_year": "pass | fail | not_found_truncation",
    "key_stat": "pass | fail | not_found_truncation | no_stat",
    "quoted_phrases": "pass | fail | none"
  }
}

Verdict rules (strict):
- CLEAN: All checks pass. No contradictions.
- SUSPECT: 1-2 checks returned "not_found_truncation" — item absent but not contradicted (source may be cut off). No outright contradictions.
- FAIL: ANY of the following: a digit sequence in the headline or key stat CONTRADICTS the source (different number present for the same metric); the company name is substantively wrong; a quoted phrase cannot be found and appears to be invented.

Critical distinction: "not found because source is truncated" = SUSPECT. "Found but wrong" = FAIL.

Return only valid JSON. No explanation outside the JSON.`;

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
  // Build combined source text from ALL sources (FULL TEXT)
  const sourceTexts = [
    `=== PRIMARY: ${researchBrief.primary_source.name} ===\n${researchBrief.primary_source.content.slice(0, 8000)}`,
    ...(researchBrief.additional_sources || []).map(s =>
      `=== ${s.name} (${s.type}) ===\n${s.content.slice(0, 4000)}`
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

  const prompt = `You are a fabrication-detection agent for a premium financial intelligence platform that charges $5,000/year. Your job: verify every factual claim in the entry against the source material below.

CURRENT DRAFT:
Headline: ${draft.headline}
Summary: ${draft.summary}
the_so_what: ${draft.the_so_what}
Key stat: ${keyStat}
Company: ${draft.company_name}

SOURCE MATERIAL (${researchBrief.source_count} sources):
${sourceTexts}
${driftSection}
RULES:
1. Check EVERY factual claim in headline, summary, AND the_so_what against the sources.
2. the_so_what HANDLING: editorial interpretation is ALLOWED ("the gap is widening", "this sets a benchmark"). But specific factual claims WITHIN the_so_what must be sourced. Example:
   - ALLOWED (editorial): "This makes BofA the competitive benchmark for meeting automation"
   - MUST BE SOURCED: "Morgan Stanley's 98% adoption rate" — this is a specific fact that needs a source
3. Match rules: exact numbers pass, equivalent expressions pass (e.g., "$45M" = "$45 million"), rounded numbers pass. FAIL only on genuine contradictions.
4. For EACH claim, identify which specific source supports it.

Return ONLY valid JSON:
{
  "verdict": "CLEAN" | "SUSPECT" | "FAIL",
  "claims_checked": <number>,
  "claims_verified": <number>,
  "claims_unverified": <number>,
  "claims_fabricated": <number>,
  "details": [
    { "claim": "specific claim text", "source": "source name that verifies it or 'NONE'", "status": "verified" | "unverified" | "fabricated" | "editorial" }
  ],
  "cross_source_conflicts": [
    { "claim": "what differs", "source_a": "name", "source_b": "name", "note": "how they differ" }
  ],
  "drift_from_previous": [
    { "claim": "what was added or changed", "in_previous": false, "in_sources": false, "note": "..." }
  ],
  "issues": ["any problems found — empty if CLEAN"]
}

Verdict rules:
- CLEAN: All factual claims verified. No contradictions. No drift issues.
- SUSPECT: 1-2 claims not found (source may be truncated). No contradictions. Flag but don't block.
- FAIL: Any claim contradicted by a source. Any number that conflicts. Any drift that introduced unsourced facts.`;

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
