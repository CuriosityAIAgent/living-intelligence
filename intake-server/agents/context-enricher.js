/**
 * context-enricher.js — Regenerates the_so_what with full landscape context
 *
 * This is the most important quality gate. Without it, the_so_what is written
 * blind — no knowledge of what we've published about this company, where they
 * sit in our maturity landscape, or how competitors compare.
 *
 * Inputs to Claude:
 *   - Article content (from intake)
 *   - Last 3 published entries for this company
 *   - Company's current landscape maturity (capabilities object)
 *   - Top 2 competitors in the same segment + same capability dimension
 *
 * Output:
 *   - Enriched the_so_what (replaces the blind version from intake)
 *   - what_changed: how this differs from our previous coverage
 *   - landscape_context: maturity change + competitor gap (for the review card)
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { INTEL_DIR, COMPETITORS_DIR } from './config.js';

const client = new Anthropic();

// ── Data loading helpers ──────────────────────────────────────────────────────
// Content files (intelligence, competitors) live in the repo clone — paths from config.js.

function loadPublishedEntriesForCompany(companySlug, limit = 3) {
  try {
    const files = readdirSync(INTEL_DIR).filter(f => f.endsWith('.json'));
    const entries = [];
    for (const file of files) {
      try {
        const entry = JSON.parse(readFileSync(join(INTEL_DIR, file), 'utf8'));
        if ((entry.company || '').toLowerCase() === companySlug.toLowerCase()) {
          entries.push(entry);
        }
      } catch (_) {}
    }
    // Sort by date descending, take most recent N
    return entries
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, limit);
  } catch (_) {
    return [];
  }
}

function loadCompetitorFile(companySlug) {
  const competitorDir = COMPETITORS_DIR;
  // Try exact match first, then slug variations
  const candidates = [
    `${companySlug}.json`,
    `${companySlug.replace(/-ai$/, '')}.json`,
    `${companySlug}-ai.json`,
  ];
  for (const fname of candidates) {
    try {
      return JSON.parse(readFileSync(join(competitorDir, fname), 'utf8'));
    } catch (_) {}
  }
  return null;
}

function loadAllCompetitors() {
  const competitorDir = COMPETITORS_DIR;
  try {
    return readdirSync(competitorDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(readFileSync(join(competitorDir, f), 'utf8')); }
        catch (_) { return null; }
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function findTopCompetitorsByCapability(companyData, capabilityId, allCompetitors, limit = 2) {
  if (!companyData || !capabilityId) return [];

  const companySegment = companyData.segment;
  const companyMaturity = companyData.capabilities?.[capabilityId]?.maturity || 'no_activity';

  const MATURITY_RANK = { scaled: 4, deployed: 3, piloting: 2, announced: 1, no_activity: 0 };
  const companyRank = MATURITY_RANK[companyMaturity] ?? 0;

  return allCompetitors
    .filter(c =>
      c.id !== companyData.id &&
      c.segment === companySegment &&
      c.capabilities?.[capabilityId]
    )
    .map(c => ({
      name: c.name,
      maturity: c.capabilities[capabilityId]?.maturity || 'no_activity',
      headline: c.capabilities[capabilityId]?.headline || '',
      rank: MATURITY_RANK[c.capabilities[capabilityId]?.maturity] ?? 0,
    }))
    .sort((a, b) => b.rank - a.rank) // highest maturity first
    .slice(0, limit);
}

// ── Cross-reference: is this story already covered in our landscape? ──────────

const MATURITY_RANK = { scaled: 4, deployed: 3, piloting: 2, announced: 1, no_activity: 0 };

function EVIDENCE_STAGE_TO_MATURITY(stage) {
  // Maps capability_evidence.stage (from intake.js) to landscape maturity levels
  if (!stage) return 'no_activity';
  const s = stage.toLowerCase();
  if (s === 'deployed' || s === 'live' || s === 'scaled') return 'deployed';
  if (s === 'piloting' || s === 'beta' || s === 'pilot') return 'piloting';
  if (s === 'announced') return 'announced';
  return 'no_activity';
}

function crossReferenceCheck(competitorData, capabilityId, entry) {
  if (!competitorData || !capabilityId) {
    return { landscape_already_covered: false, landscape_match_notes: null };
  }

  const landscapeCapability = competitorData.capabilities?.[capabilityId];
  if (!landscapeCapability) {
    return { landscape_already_covered: false, landscape_match_notes: `${capabilityId} not yet in landscape for this company` };
  }

  const landscapeMaturity = landscapeCapability.maturity || 'no_activity';
  const landscapeRank = MATURITY_RANK[landscapeMaturity] ?? 0;

  // What maturity does this story's evidence suggest?
  const storyStage = entry.capability_evidence?.stage;
  const storyMaturity = EVIDENCE_STAGE_TO_MATURITY(storyStage);
  const storyRank = MATURITY_RANK[storyMaturity] ?? 0;

  if (storyRank <= landscapeRank && landscapeRank >= 2) {
    // Story doesn't advance the maturity — landscape already at this level or higher
    return {
      landscape_already_covered: true,
      landscape_match_notes: `Landscape already shows ${landscapeMaturity.toUpperCase()} for ${capabilityId} — story may not advance our coverage`,
    };
  }

  if (storyRank > landscapeRank) {
    return {
      landscape_already_covered: false,
      landscape_match_notes: `Story advances maturity: ${landscapeMaturity.toUpperCase()} → ${storyMaturity.toUpperCase()} — landscape update may be warranted`,
    };
  }

  return { landscape_already_covered: false, landscape_match_notes: null };
}

// ── Main enricher ─────────────────────────────────────────────────────────────

// ── Exported pure functions (used by tests) ───────────────────────────────────

export { crossReferenceCheck, EVIDENCE_STAGE_TO_MATURITY, MATURITY_RANK };

export async function enrichContext({ entry, articleMarkdown }) {
  const companySlug = entry.company || '';
  const capabilityId = entry.tags?.capability || entry.capability_evidence?.capability || null;

  // ── Load context data ──────────────────────────────────────────────────────
  const previousEntries = loadPublishedEntriesForCompany(companySlug);
  const competitorData = loadCompetitorFile(companySlug);
  const allCompetitors = loadAllCompetitors();
  const peerCompetitors = findTopCompetitorsByCapability(competitorData, capabilityId, allCompetitors);

  // Cross-reference uses already-loaded competitorData — no extra I/O
  const crossRef = crossReferenceCheck(competitorData, capabilityId, entry);

  // ── Build context blocks for Claude ──────────────────────────────────────
  const previousCoverageBlock = previousEntries.length > 0
    ? previousEntries.map((e, i) =>
        `[${i + 1}] ${e.date} — ${e.headline}\n    the_so_what: ${e.the_so_what || '(none)'}`
      ).join('\n\n')
    : 'No previous coverage of this company.';

  const landscapeBlock = competitorData?.capabilities?.[capabilityId]
    ? `${competitorData.name} — ${capabilityId} capability:
  Current maturity: ${competitorData.capabilities[capabilityId].maturity?.toUpperCase()}
  Summary: ${competitorData.capabilities[capabilityId].headline || '(no headline)'}
  Key evidence: ${(competitorData.capabilities[capabilityId].evidence || []).slice(0, 3).join('; ')}`
    : competitorData
      ? `${competitorData.name} is in our landscape (segment: ${competitorData.segment}) but no specific data for capability: ${capabilityId || 'unknown'}.`
      : `${entry.company_name} is not in our landscape yet — treat as first-time coverage.`;

  const peersBlock = peerCompetitors.length > 0
    ? peerCompetitors.map(p =>
        `${p.name}: ${p.maturity?.toUpperCase()} — ${p.headline}`
      ).join('\n')
    : 'No peer comparison data available for this capability in this segment.';

  // ── Build the enrichment prompt ────────────────────────────────────────────
  const prompt = `You are the editorial intelligence layer for "AI in Wealth Management" — a premium analytical platform tracking AI adoption across wealth management.

Your task: rewrite the "the_so_what" field for the intelligence entry below, using the full context provided.

The_so_what rules:
- ONE sentence only — never more
- Must be analytical insight. Choose the best angle for this story:
  * Competitive benchmark: scale economics, compounding data advantages, cost-to-serve gaps
  * Cross-landscape context: connect to what peers/competitors are doing, show the pattern
  * Infrastructure parallel: compare to historic technology shifts (electronic trading, Salesforce CRM, Bloomberg terminals)
  * Business model insight: why the model matters more than the technology
- Must reference the SPECIFIC company and capability dimension — not generic AI commentary
- Must use the competitive context to add weight — are competitors ahead, behind, or level?
- Must use our previous coverage to show what has CHANGED — is this an update, acceleration, or reversal?
- Do NOT restate what happened (that's the summary). State the strategic implication.
- NEVER use: CXO, board, "firms should", "must now decide", "this signals", "this suggests", "wealth managers should consider", "game-changing", "landmark", "revolutionary", "paradigm shift", "It remains to be seen"

BAD: "Jump's growth in advisor productivity tools highlights the increasing importance of AI in wealth management."
BAD: "This signals that AI adoption is accelerating among independent advisors."
BAD: "Any wealth CXO still treating meeting workflow as a roadmap item is falling behind."
GOOD: "Jump has crossed the threshold where it is no longer a point solution — at 27,000 advisors and $105M raised, it is the default productivity infrastructure for the independent channel, establishing a per-advisor cost advantage that compounds with every client interaction."
GOOD: "The independent channel adopting AI faster than the institutional channel is a structural reversal of the historic adoption curve, following the same pattern as discount brokerage adoption in the 1990s."

---

ARTICLE BEING PROCESSED:
Headline: ${entry.headline}
Summary: ${entry.summary}
Current the_so_what (written without context, replace this): ${entry.the_so_what}
Type: ${entry.type}
Key stat: ${entry.key_stat ? `${entry.key_stat.number} — ${entry.key_stat.label}` : 'none'}

---

OUR PREVIOUS COVERAGE OF ${entry.company_name?.toUpperCase()}:
${previousCoverageBlock}

---

LANDSCAPE DATA FOR ${entry.company_name?.toUpperCase()}:
${landscapeBlock}

---

PEER COMPETITORS IN SAME SEGMENT (${capabilityId || 'same capability'}):
${peersBlock}

---

Article excerpt (for context, do not fabricate from this):
${(articleMarkdown || '').slice(0, 4000)}

---

Return a JSON object in exactly this format:
{
  "the_so_what": "One sentence — the enriched, context-aware analytical insight (competitive benchmark, cross-landscape context, infrastructure parallel, or business model insight)",
  "what_changed": "One sentence — how this differs from our previous coverage, or 'First coverage of this company' if no prior entries",
  "landscape_context": {
    "current_maturity": "the company's current maturity level in this capability, or null if unknown",
    "maturity_direction": "up | down | stable | unknown",
    "competitor_gap": "One phrase: how this company compares to the leading peer — e.g. 'Morgan Stanley 6 months behind' or 'No peers at this maturity level yet' or null"
  },
  "enrichment_confidence": "high | medium | low",
  "enrichment_notes": "Brief note if context was limited (e.g. 'Company not in landscape') — or null"
}

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
    return {
      the_so_what: entry.the_so_what, // fall back to original
      what_changed: null,
      landscape_context: null,
      enrichment_confidence: 'low',
      enrichment_notes: `Enrichment API call failed: ${err.message}`,
      landscape_already_covered: crossRef.landscape_already_covered,
      landscape_match_notes: crossRef.landscape_match_notes,
    };
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      the_so_what: entry.the_so_what,
      what_changed: null,
      landscape_context: null,
      enrichment_confidence: 'low',
      enrichment_notes: 'Enrichment returned non-JSON — using original the_so_what',
      landscape_already_covered: crossRef.landscape_already_covered,
      landscape_match_notes: crossRef.landscape_match_notes,
    };
  }

  try {
    const result = JSON.parse(jsonMatch[0]);
    return {
      the_so_what: result.the_so_what || entry.the_so_what,
      what_changed: result.what_changed || null,
      landscape_context: result.landscape_context || null,
      enrichment_confidence: result.enrichment_confidence || 'medium',
      enrichment_notes: result.enrichment_notes || null,
      // Cross-reference — uses already-loaded landscape data, no extra API call
      landscape_already_covered: crossRef.landscape_already_covered,
      landscape_match_notes: crossRef.landscape_match_notes,
    };
  } catch (_) {
    return {
      the_so_what: entry.the_so_what,
      what_changed: null,
      landscape_context: null,
      enrichment_confidence: 'low',
      enrichment_notes: 'JSON parse error — using original the_so_what',
      landscape_already_covered: crossRef.landscape_already_covered,
      landscape_match_notes: crossRef.landscape_match_notes,
    };
  }
}
