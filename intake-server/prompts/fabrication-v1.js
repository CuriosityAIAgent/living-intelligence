/**
 * fabrication-v1.js — Single-source fabrication check for fabrication-strict.js
 * Version: fabrication-v1 (2026-04-06)
 *
 * Checks key facts (numbers, names, dates, quotes) against a single source article.
 */

export const VERSION = 'fabrication-v1';

export function build({ headline, summary, keyStat, company_name, date, sourceMarkdown, sourceWindow }) {
  return `You are a fabrication-detection agent for a premium financial intelligence platform.

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
Headline: ${headline}
Summary: ${summary}
Key stat: ${keyStat}
Company name: ${company_name}
Date: ${date}
---

NOTE: The entry has a "the_so_what" field but it is EXCLUDED from this check. It contains intentional editorial analysis and interpretation — not claims from the source article. Do NOT check it.

SOURCE ARTICLE (first ${sourceWindow.toLocaleString()} chars — may be truncated):
---
${sourceMarkdown}
---

Answer each of the following six checks precisely:

1. NUMBERS IN HEADLINE — Extract every digit sequence from the headline (e.g. "150", "2.5", "$4B"). For each: does the source contain the same number or an equivalent expression (e.g. "$45M" = "$45 million", "5,000+" = "more than 5,000", "120M" = "more than 100 million")? If equivalent → PASS. If the source has a DIFFERENT number for the same metric → FAIL. If not found at all (possible truncation) → not_found_truncation.

2. COMPANY NAME SPELLING — Is "${company_name}" spelled exactly as it appears in the source? Check the source for the company name and report the exact spelling found. If the source uses a different form (e.g. "JPMorgan Chase" vs "JPMorgan"), flag it only if the forms are substantively different (not just abbreviation vs full name).

3. DATE VERIFICATION — Does the year "${date.slice(0, 4)}" appear in the source text? (We check year only — exact date in article body is unreliable.) If the source contains a clearly different year for the same events, flag it.

4. KEY STAT VERBATIM — ${keyStat !== 'none' ? `The key stat is "${keyStat}". Does this exact number appear literally in the source text? If not: is it contradicted by a different number in the source, or simply absent (possible truncation)?` : 'No key stat to check.'}

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
}
