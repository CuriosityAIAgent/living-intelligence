/**
 * landscape-writer-agent.js — Consulting-quality landscape profile writer
 *
 * Takes a Landscape Research Brief and produces a complete company profile
 * at the quality level of a McKinsey competitive intelligence engagement.
 *
 * Every claim must trace to a source. Every maturity level must be justified
 * by evidence. Every capability assessment must include "no_activity" where
 * there's genuinely nothing to report — that's valuable intelligence too.
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// ── All 7 capability dimensions ──────────────────────────────────────────────

const CAPABILITIES = [
  'advisor_productivity',
  'client_personalization',
  'investment_portfolio',
  'research_content',
  'client_acquisition',
  'operations_compliance',
  'new_business_models',
];

// ── Build the prompt ─────────────────────────────────────────────────────────

function buildPrompt(brief, previousDraft, evaluatorFeedback) {
  const { company, our_intelligence, our_tl_mentions, peers, articles } = brief;

  // Build intelligence context
  let intelSection = '';
  if (our_intelligence.length > 0) {
    intelSection = '\nOUR PUBLISHED INTELLIGENCE ON THIS COMPANY:\n' +
      our_intelligence.map(e =>
        `- "${e.headline}" (${e.date}) | ${e.type} | Key stat: ${e.key_stat?.number || 'none'} | so_what: ${e.the_so_what?.slice(0, 150)}...`
      ).join('\n');
  }

  // Build TL context
  let tlSection = '';
  if (our_tl_mentions.length > 0) {
    tlSection = '\nTHOUGHT LEADERSHIP MENTIONING THIS COMPANY:\n' +
      our_tl_mentions.map(e => `- "${e.title}" by ${e.author} — insight: ${e.the_one_insight?.slice(0, 100)}...`).join('\n');
  }

  // Build peer context
  let peerSection = '';
  if (peers.length > 0) {
    peerSection = '\nPEER COMPANIES (same segment — for competitive benchmarking):\n' +
      peers.map(p => {
        const caps = Object.entries(p.capabilities || {}).map(([k, v]) => `${k}:${v}`).join(', ');
        return `- ${p.name} (${p.overall_maturity}) | ${p.headline_metric?.slice(0, 80)} | ${caps}`;
      }).join('\n');
  }

  // Build article context
  let articleSection = '';
  if (articles.length > 0) {
    articleSection = '\nFRESH RESEARCH ARTICLES:\n' +
      articles.map((a, i) =>
        `=== ARTICLE ${i + 1}: ${a.title} (${a.hostname}) ===\n${a.content.slice(0, 3000)}`
      ).join('\n\n');
  }

  // Refinement context
  let refinementSection = '';
  if (previousDraft && evaluatorFeedback) {
    refinementSection = `
REFINEMENT INSTRUCTIONS — improve the previous draft based on this feedback:

PREVIOUS STRATEGY SUMMARY:
${previousDraft.ai_strategy_summary}

EVALUATOR FEEDBACK:
${Object.entries(evaluatorFeedback.checks || {}).filter(([_, v]) => !v.pass).map(([k, v]) => `- ${k}: FAILED — ${v.feedback}`).join('\n')}
Priority fix: ${evaluatorFeedback.priority_fix || 'Address all failed checks'}

Fix these issues. Every claim must still trace to a source.
`;
  }

  return `You are a senior partner at McKinsey & Company writing a competitive intelligence profile for a wealth management client. The profile will appear on a platform that charges $5,000/year. The Head of AI at rival firms will read this.

COMPANY: ${company.name}
SEGMENT: ${company.segment}
CURRENT MATURITY: ${company.current_profile.overall_maturity}

CURRENT PROFILE (what we have — improve this):
Strategy: ${company.current_profile.ai_strategy_summary}
Headline: ${company.current_profile.headline_metric}
Initiative: ${company.current_profile.headline_initiative}
Capabilities: ${JSON.stringify(company.current_profile.capabilities, null, 2)}
${intelSection}
${tlSection}
${peerSection}
${articleSection}
${refinementSection}

WRITE a complete landscape profile as JSON. Rules:

1. **ai_strategy_summary** (400-1000 chars): Strategic narrative. NOT a feature list. Must name at least 2 peer competitors for context. Must include specific metrics. Must answer: "Where does this firm stand relative to peers, and what is their strategic direction?"

2. **headline_metric**: The 1-2 numbers a CXO would quote. Decision-grade. From verified sources.

3. **headline_initiative**: The primary AI initiative name(s).

4. **capabilities**: Assess ALL 7 dimensions. For each:
   - **maturity**: scaled | deployed | piloting | announced | no_activity
   - **headline**: Specific metric + capability. Under 120 chars.
   - **detail**: 2-3 analytical sentences. NOT a feature list.
   - **evidence**: 3-5 bullet points with source attribution in parentheses.
   - **sources**: Array of {name, url} — EVERY claim must trace to a source.
   - If no_activity: still write a headline + detail explaining WHAT THE FIRM IS NOT DOING and WHY THAT MATTERS competitively.

5. **Maturity rules** (be strict):
   - **scaled**: ONLY if live across the majority of the firm with measurable business impact. Needs adoption metrics.
   - **deployed**: Live in production but partial scope. Needs user count or scope detail.
   - **piloting**: Being tested. Needs pilot scope or timeline evidence.
   - **announced**: Publicly committed but not in production. Needs announcement source.
   - **no_activity**: No public evidence. This IS intelligence — say what's missing and why it matters.

Return ONLY valid JSON matching this structure:
{
  "ai_strategy_summary": "...",
  "headline_metric": "...",
  "headline_initiative": "...",
  "overall_maturity": "scaled | deployed | piloting | announced",
  "capabilities": {
    "advisor_productivity": { "maturity": "...", "headline": "...", "detail": "...", "evidence": ["..."], "sources": [{"name": "...", "url": "..."}] },
    "client_personalization": { ... },
    "investment_portfolio": { ... },
    "research_content": { ... },
    "client_acquisition": { ... },
    "operations_compliance": { ... },
    "new_business_models": { ... }
  }
}`;
}

// ── Main: Write Landscape Profile ────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {Object} params.researchBrief — from landscape-research-agent.js
 * @param {Object} [params.previousDraft] — previous version for refinement
 * @param {Object} [params.evaluatorFeedback] — evaluator result for refinement
 * @returns {Object} Landscape profile fields (ai_strategy_summary, capabilities, etc.)
 */
export async function writeLandscape({ researchBrief, previousDraft, evaluatorFeedback }) {
  const prompt = buildPrompt(researchBrief, previousDraft, evaluatorFeedback);

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Landscape Writer: no JSON in response');

  return JSON.parse(match[0]);
}
