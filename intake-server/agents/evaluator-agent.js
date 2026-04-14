/**
 * evaluator-agent.js — McKinsey 6-check quality test (Opus)
 *
 * Rates a draft entry against 6 quality dimensions:
 *   1. Specificity — headline has specific capability/metric?
 *   2. So-what — falsifiable claim surviving company name removal?
 *   3. Source — all numbers traceable to named source?
 *   4. Substance — summary adds value beyond headline?
 *   5. Stat — key_stat is decision-grade?
 *   6. Competitor — connects to at least one peer?
 *
 * Returns PASS / NEEDS_WORK with specific improvement instructions.
 */

import Anthropic from '@anthropic-ai/sdk';
import { build as buildEvaluatorPrompt, VERSION as EVAL_PROMPT_VERSION } from '../prompts/evaluator-v1.js';

const client = new Anthropic();

/**
 * Evaluate a draft entry against the McKinsey 6-check test.
 *
 * @param {Object} params
 * @param {Object} params.draft - Draft entry from writer-agent
 * @param {Object} params.researchBrief - Research brief for context
 * @returns {Object} { checks, overall, quality_score, priority_fix }
 */
export async function evaluate({ draft, researchBrief }) {
  const prompt = buildEvaluatorPrompt({ draft, researchBrief });

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      checks: {},
      overall: 'NEEDS_WORK',
      quality_score: 5,
      priority_fix: 'Evaluator returned no JSON',
      _prompt_version: EVAL_PROMPT_VERSION,
    };
  }

  const result = JSON.parse(jsonMatch[0]);

  // Normalise overall
  const overall = ['PASS', 'NEEDS_WORK'].includes(result.overall) ? result.overall : 'NEEDS_WORK';

  return {
    checks: result.checks || {},
    overall,
    quality_score: result.quality_score || 5,
    priority_fix: result.priority_fix || null,
    _prompt_version: EVAL_PROMPT_VERSION,
  };
}

export { EVAL_PROMPT_VERSION };
