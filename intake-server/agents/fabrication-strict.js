// fabrication-strict.js — dedicated second Claude verification pass
// Stricter than governance.js: looks for EXACT text matches, not general claim support.
// Called AFTER governance.js with the same sourceMarkdown.
//
// Returns: { verdict: "CLEAN" | "SUSPECT" | "FAIL", issues: string[], checked_at: ISO string }
//
//   CLEAN  — all numbers, names, dates, stats verified as verbatim matches in source
//   SUSPECT — 1-2 items couldn't be confirmed (may be in truncated text) — flag but don't block
//   FAIL   — any number or name demonstrably contradicts source, OR key stat absent from source

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SOURCE_WINDOW = 12_000; // chars — wider than governance.js (6,000) for better coverage

export async function checkFabrication({ entry, sourceMarkdown }) {
  const sourceSnippet = (sourceMarkdown || '').slice(0, SOURCE_WINDOW);

  const keyStat = entry.key_stat
    ? `${entry.key_stat.number} — ${entry.key_stat.label}`
    : 'none';

  const prompt = `You are a fabrication-detection agent for a premium financial intelligence platform.

Your job is STRICTLY different from general fact-checking: you are looking for EXACT TEXT MATCHES, not plausible support or paraphrasing. Every number, company name, date, and quoted phrase must appear VERBATIM (or near-verbatim with only minor grammatical inflection) in the source text below.

ENTRY TO CHECK:
---
Headline: ${entry.headline}
Summary: ${entry.summary}
Key stat: ${keyStat}
Company name: ${entry.company_name}
Date: ${entry.date}
---

SOURCE ARTICLE (first ${SOURCE_WINDOW.toLocaleString()} chars — may be truncated):
---
${sourceSnippet}
---

Answer each of the following five checks precisely:

1. NUMBERS IN HEADLINE — Extract every digit sequence from the headline (e.g. "150", "2.5", "$4B"). For each: does it appear verbatim or near-verbatim in the source text? If the source text is truncated and the number simply isn't present (not contradicted), note it as "not found — possible truncation".

2. COMPANY NAME SPELLING — Is "${entry.company_name}" spelled exactly as it appears in the source? Check the source for the company name and report the exact spelling found. If the source uses a different form (e.g. "JPMorgan Chase" vs "JPMorgan"), flag it.

3. DATE VERIFICATION — Is the date "${entry.date}" stated explicitly as a publication or event date somewhere in the BODY of the article (not just implied by a URL slug or byline metadata)? Answer yes/no with evidence.

4. KEY STAT VERBATIM — ${entry.key_stat ? `The key stat is "${entry.key_stat.number}". Does this exact number appear literally in the source text? If not: is it contradicted, or simply absent (possible truncation)?` : 'No key stat to check.'}

5. QUOTED PHRASES — Identify any phrase in the summary that appears to be a direct quote (enclosed in quotation marks or attributed with "said", "noted", "announced", "stated"). For each: find the verbatim match in the source. Flag any that cannot be found.

After checking all five, return a JSON object in exactly this format:
{
  "verdict": "CLEAN" | "SUSPECT" | "FAIL",
  "issues": ["list of specific problems found — empty array if CLEAN"],
  "check_details": {
    "numbers_in_headline": "pass | fail | not_found_truncation",
    "company_name": "pass | fail",
    "date_explicit": "pass | fail | not_found_truncation",
    "key_stat": "pass | fail | not_found_truncation | no_stat",
    "quoted_phrases": "pass | fail | none"
  }
}

Verdict rules (strict):
- CLEAN: All five checks pass. No contradictions. No fabrications.
- SUSPECT: 1-2 checks returned "not_found_truncation" (item absent but not contradicted — source may be cut off). No outright contradictions.
- FAIL: ANY of the following: a digit sequence in the headline contradicts the source; the company name is misspelled relative to the source; a key stat is present in the entry but entirely absent AND contradicted by the source; a quoted phrase cannot be found verbatim.

Important: "not found because source is truncated" is SUSPECT, not FAIL. Only contradiction is FAIL.

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
