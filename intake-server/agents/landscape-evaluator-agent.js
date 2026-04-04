/**
 * landscape-evaluator-agent.js — Quality gate for landscape profiles
 *
 * Evaluates a draft landscape profile against the Landscape McKinsey Test.
 * Returns pass/fail per check with specific improvement instructions.
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

/**
 * @param {Object} params
 * @param {Object} params.draft — Draft profile from landscape-writer-agent.js
 * @param {Object} params.researchBrief — Research brief for context
 * @returns {Object} Evaluation result
 */
export async function evaluateLandscape({ draft, researchBrief }) {
  const { company, peers } = researchBrief;
  const capCount = Object.keys(draft.capabilities || {}).length;
  const peerNames = peers.map(p => p.name).join(', ');

  const prompt = `You are a senior partner at McKinsey reviewing a competitive intelligence profile before it goes to a wealth management client paying $5,000/year. Be strict.

COMPANY: ${company.name} (${company.segment})
STRATEGY SUMMARY: ${draft.ai_strategy_summary}
HEADLINE METRIC: ${draft.headline_metric}
CAPABILITIES ASSESSED: ${capCount} of 7
PEERS IN SEGMENT: ${peerNames}

CAPABILITIES:
${Object.entries(draft.capabilities || {}).map(([k, v]) =>
  `${k}: ${v.maturity} — "${v.headline}" | Evidence: ${v.evidence?.length || 0} items | Sources: ${v.sources?.length || 0}`
).join('\n')}

Rate against EACH check:

CHECK 1 — STRATEGY DEPTH: Is ai_strategy_summary ≥400 chars and does it name ≥2 peer competitors? Not a feature list?

CHECK 2 — CAPABILITY COVERAGE: Are ≥4 of 7 capabilities assessed? (no_activity counts — it's valuable to know what they're NOT doing)

CHECK 3 — EVIDENCE SOURCED: Does every capability have evidence bullets with source attribution?

CHECK 4 — MATURITY JUSTIFIED: For each capability:
  - scaled: requires adoption metrics (user count, % adoption)
  - deployed: requires user count or scope detail
  - piloting: requires pilot scope or timeline
  - announced: requires announcement source
  - no_activity: requires explanation of what's missing and why it matters

CHECK 5 — COMPETITIVE CONTEXT: Does the strategy summary position this company relative to peers? Not just "they have AI" but "they're ahead/behind on X compared to Y"

CHECK 6 — DECISION GRADE: Would a Head of AI at a competing firm read this and learn something specific they didn't know?

Return ONLY valid JSON:
{
  "checks": {
    "strategy_depth": { "pass": true/false, "feedback": "..." },
    "capability_coverage": { "pass": true/false, "feedback": "..." },
    "evidence_sourced": { "pass": true/false, "feedback": "..." },
    "maturity_justified": { "pass": true/false, "feedback": "..." },
    "competitive_context": { "pass": true/false, "feedback": "..." },
    "decision_grade": { "pass": true/false, "feedback": "..." }
  },
  "overall": "PASS" or "NEEDS_WORK",
  "priority_fix": "The single most important thing to fix, or null if PASS",
  "quality_score": 1-10
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Landscape Evaluator: no JSON in response');

  const evaluation = JSON.parse(match[0]);

  // Ensure overall matches individual checks
  const allPass = Object.values(evaluation.checks || {}).every(c => c.pass === true);
  if (allPass) evaluation.overall = 'PASS';
  if (!allPass) evaluation.overall = 'NEEDS_WORK';

  return evaluation;
}
