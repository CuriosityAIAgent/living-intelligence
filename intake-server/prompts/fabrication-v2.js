/**
 * fabrication-v2.js — Multi-source fabrication check for fabrication-strict.js
 * Version: fabrication-v2 (2026-04-06)
 *
 * Verifies every factual claim against multiple source documents.
 * Includes drift detection (claims added during refinement).
 */

export const VERSION = 'fabrication-v2';

export function build({ headline, summary, the_so_what, keyStat, company_name, sourceTexts, source_count, driftSection }) {
  return `You are a fabrication-detection agent for a premium financial intelligence platform that charges $5,000/year. Your job: verify every factual claim in the entry against the source material below.

CURRENT DRAFT:
Headline: ${headline}
Summary: ${summary}
the_so_what: ${the_so_what}
Key stat: ${keyStat}
Company: ${company_name}

SOURCE MATERIAL (${source_count} sources):
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
}
