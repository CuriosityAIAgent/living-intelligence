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

const client = new Anthropic();
const SOURCE_WINDOW = 12_000;

export async function verify({ entry, sourceMarkdown, send }) {
  send('status', { message: 'Running governance verification...' });

  // Upfront paywall detection — skip Claude if source is too thin to verify anything
  const sourceLen = (sourceMarkdown || '').length;
  if (sourceLen < 300) {
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

  const prompt = `You are a claim-verification agent for a premium AI in wealth management publication.

Your ONLY job: determine whether each claim in the GENERATED ENTRY is supported by the SOURCE ARTICLE.

This is NOT a fabrication check — do not try to detect exact text matches. You are checking logical support: does the source article, taken as a whole, support what the entry claims?

GENERATED ENTRY (what we plan to publish):
---
Headline: ${entry.headline}
Summary: ${entry.summary}
The so what: ${entry.the_so_what || 'none'}
Key stat: ${keyStat}
---

SOURCE ARTICLE (ground truth — first ${SOURCE_WINDOW.toLocaleString()} chars):
---
${(sourceMarkdown || '').slice(0, SOURCE_WINDOW)}
---

For each distinct factual claim in the entry, categorise it as:
- verified_claim: the source clearly supports this (exact or paraphrased)
- unverified_claim: the source does not explicitly state this, but does not contradict it either
- fabricated_claim: the source DIRECTLY CONTRADICTS this (e.g. entry says "raised $50M" but source says "$30M"; entry attributes a quote to the wrong person; entry states the wrong company name)

Important: "fabricated_claim" means CONTRADICTED, not merely absent. If the source is thin or paywalled and a claim simply cannot be found, that is an unverified_claim, not fabricated. Reserve fabricated_claim for direct contradictions only.

Return a JSON object in exactly this format:
{
  "verdict": "PASS" | "REVIEW" | "FAIL",
  "confidence": 0-100,
  "verified_claims": ["claims clearly supported by source"],
  "unverified_claims": ["claims not found but not contradicted — may be in paywalled section"],
  "fabricated_claims": ["claims that DIRECTLY CONTRADICT the source"],
  "notes": "One sentence explaining your verdict",
  "paywall_caveat": true | false
}

Verdict rules:
- PASS: All claims supported. No contradictions. Minor paraphrasing is fine.
- REVIEW: 1-2 claims unverified (source thin or paywalled). No contradictions.
- FAIL: Any claim is directly contradicted by the source — wrong number, wrong name, wrong direction.
- Set paywall_caveat: true if the source appears paywalled or truncated (< 500 meaningful words).

Return only valid JSON. No explanation outside the JSON.`;

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
    paywall_caveat: result.paywall_caveat || false,
    verified_at: new Date().toISOString(),
  };

  send('result', output);
  return output;
}
