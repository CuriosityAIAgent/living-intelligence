/**
 * governance.js — Claim supportability verification
 *
 * Single responsibility: verify that every claim in the generated entry
 * is SUPPORTED BY the source article. This agent does NOT detect fabrication
 * (that is fabrication-strict.js's job). It answers one question:
 *   "Does the source article support what we are about to publish?"
 *
 * FAIL = a claim in the entry is CONTRADICTED by the source (wrong direction,
 *        wrong number, wrong company). Not merely absent — contradicted.
 * REVIEW = 1-2 claims are unverified (implied but not explicit). No contradictions.
 * PASS = every claim is clearly supported. Minor paraphrasing is fine.
 *
 * Checked fields: headline · summary · the_so_what · key_stat
 * Fabrication detection (exact text match): see fabrication-strict.js
 */

import Anthropic from '@anthropic-ai/sdk';
import { SOURCE_WINDOW, NEVER_PAYWALLED } from './config.js';
import { build as buildGovernancePrompt, VERSION as GOV_PROMPT_VERSION } from '../prompts/governance-v1.js';

const client = new Anthropic();

function isNeverPaywalled(sourceUrl) {
  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./, '');
    return NEVER_PAYWALLED.has(hostname);
  } catch { return false; }
}

export async function verify({ entry, sourceMarkdown, send }) {
  send('status', { message: 'Running governance verification...' });

  const sourceUrl = entry.source_url || '';
  const neverPaywalled = isNeverPaywalled(sourceUrl);

  // Upfront thin content detection — skip Claude if source is too thin to verify
  const sourceLen = (sourceMarkdown || '').length;
  if (sourceLen < 300 && !neverPaywalled) {
    const result = {
      verdict: 'REVIEW',
      confidence: 30,
      verified_claims: [],
      unverified_claims: ['Source content too thin to verify (likely paywalled or empty)'],
      fabricated_claims: [],
      notes: 'Insufficient source content — paywall or extraction failure suspected.',
      paywall_caveat: true,
      verified_at: new Date().toISOString(),
      human_approved: false,
      approved_at: null,
    };
    send('result', result);
    return result;
  }

  const keyStat = entry.key_stat
    ? `${entry.key_stat.number} — ${entry.key_stat.label}`
    : 'none';

  const prompt = buildGovernancePrompt({
    headline: entry.headline,
    summary: entry.summary,
    keyStat,
    sourceMarkdown,
    sourceWindow: SOURCE_WINDOW,
  });

  let raw;
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });
    raw = response.content[0].text.trim();
  } catch (err) {
    const fallback = {
      verdict: 'REVIEW',
      confidence: 0,
      verified_claims: [],
      unverified_claims: [],
      fabricated_claims: [],
      notes: `Governance API call failed: ${err.message}`,
      paywall_caveat: false,
      verified_at: new Date().toISOString(),
    };
    send('result', fallback);
    return fallback;
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const fallback = {
      verdict: 'REVIEW',
      confidence: 0,
      verified_claims: [],
      unverified_claims: ['Governance returned non-JSON — manual review required'],
      fabricated_claims: [],
      notes: 'Non-JSON response from governance agent.',
      paywall_caveat: false,
      verified_at: new Date().toISOString(),
    };
    send('result', fallback);
    return fallback;
  }

  let result;
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    const fallback = {
      verdict: 'REVIEW',
      confidence: 0,
      verified_claims: [],
      unverified_claims: ['Governance JSON parse error — manual review required'],
      fabricated_claims: [],
      notes: `JSON parse error: ${parseErr.message}`,
      paywall_caveat: false,
      verified_at: new Date().toISOString(),
    };
    send('result', fallback);
    return fallback;
  }

  const output = {
    verdict: ['PASS', 'REVIEW', 'FAIL'].includes(result.verdict) ? result.verdict : 'REVIEW',
    confidence: typeof result.confidence === 'number' ? result.confidence : 50,
    verified_claims: result.verified_claims || [],
    unverified_claims: result.unverified_claims || [],
    fabricated_claims: result.fabricated_claims || [],
    notes: result.notes || '',
    // Never flag press release wires as paywalled, even if Claude thinks so
    paywall_caveat: neverPaywalled ? false : (result.paywall_caveat || false),
    verified_at: new Date().toISOString(),
  };

  send('result', output);
  return output;
}
