/**
 * writer-v1.js — Consulting-quality writer prompt
 * Version: writer-v1 (2026-04-06)
 *
 * Persona: Senior engagement manager at a top-3 strategy firm.
 * Briefing a Head of Wealth Management. 90 seconds of attention.
 */

export const VERSION = 'writer-v1';

export function build({ researchBrief, previousDraft, evaluatorFeedback, editorNotes, schema }) {
  const entities = researchBrief.entities || {};
  const primarySource = researchBrief.primary_source || {};
  const additionalSources = researchBrief.additional_sources || [];
  const landscape = researchBrief.landscape || {};
  const peers = landscape.peers || [];

  // Build source material section
  const sourceSection = [
    `=== PRIMARY SOURCE: ${primarySource.name || 'Unknown'} ===`,
    `URL: ${primarySource.url || ''}`,
    (primarySource.content || '').slice(0, 8000),
    '',
    ...additionalSources.map(s =>
      `=== ${s.name} (${s.type || 'coverage'}) ===\nURL: ${s.url}\n${(s.content || '').slice(0, 4000)}`
    ),
  ].join('\n\n');

  // Build landscape context
  const landscapeSection = landscape.is_tracked
    ? `LANDSCAPE CONTEXT (this company is tracked on our platform):
Company: ${landscape.company?.name || entities.company_name}
Current maturity: ${landscape.company?.overall_maturity || 'unknown'}
Strategy summary: ${landscape.company?.ai_strategy_summary || 'none'}
Past entries on our platform: ${(landscape.past_entries || []).map(e => `"${e.headline}" (${e.date})`).join('; ') || 'none'}
Peers in same segment: ${peers.map(p => `${p.name} (${p.capabilities?.[entities.capability_area]?.maturity || 'unknown'})`).join(', ') || 'none'}`
    : `LANDSCAPE CONTEXT: Company not yet tracked on our platform. No prior entries.`;

  // Build refinement section
  let refinementSection = '';
  if (previousDraft) {
    refinementSection = `
PREVIOUS DRAFT (improve this — do not start from scratch):
Headline: ${previousDraft.headline}
Summary: ${previousDraft.summary}
the_so_what: ${previousDraft.the_so_what}
Key stat: ${previousDraft.key_stat ? `${previousDraft.key_stat.number} — ${previousDraft.key_stat.label}` : 'none'}
`;
  }

  let feedbackSection = '';
  if (evaluatorFeedback) {
    const checks = evaluatorFeedback.checks || {};
    const failedChecks = Object.entries(checks)
      .filter(([, v]) => !v.pass)
      .map(([k, v]) => `- ${k}: ${v.feedback}`)
      .join('\n');
    feedbackSection = `
EVALUATOR FEEDBACK (address these issues):
Overall: ${evaluatorFeedback.overall} (${evaluatorFeedback.quality_score}/10)
Priority fix: ${evaluatorFeedback.priority_fix || 'none'}
Failed checks:
${failedChecks || '(all passed)'}
`;
  }

  if (editorNotes) {
    feedbackSection += `\nEDITOR NOTES (from human reviewer — highest priority):\n${editorNotes}\n`;
  }

  return `You are a senior engagement manager at a top-3 strategy firm. You are briefing a Head of Wealth Management who has 90 seconds of attention. You have a point of view. Every claim backed by evidence.

Your job: produce a consulting-quality intelligence entry from the research brief below.

${landscapeSection}

WHAT'S NEW (vs our prior coverage):
${researchBrief.whats_new || 'First coverage of this story.'}

SOURCE MATERIAL (${researchBrief.source_count || 1} sources — USE THESE, not your training data):
${sourceSection}
${refinementSection}${feedbackSection}
RULES:
1. headline: Lead with capability impact or scale, not the dollar amount or event type. Under 120 chars.
   BAD: "Jump Raises $80M Series B"
   GOOD: "Jump Scales AI Meeting Assistant to 15,000 Advisors After $80M Series B"

2. summary: 3-5 sentences. Lead with CAPABILITY + EVIDENCE. Then the event trigger. Only facts from sources above.

3. the_so_what: ONE sentence of analytical insight. Must be falsifiable and survive removing the company name.
   Choose the best angle: competitive benchmark, cross-landscape context, infrastructure parallel, or business model insight.
   MUST reference at least one peer competitor or landscape trend.
   NEVER use: CXO, board, "firms should", "must now decide", "game-changing", "landmark", "revolutionary"

4. key_stat: Decision-grade number with source. Must appear verbatim in source material. null if none.

5. capability_evidence: stage = "deployed" only if live with real users. "piloting" = tested. "announced" = committed.

6. ALL claims must trace to a specific source in the material above. No inference from training data.

7. sources array: list each source used with name, url, and type (primary/coverage/discovery).

8. image_url: always null (logos managed separately).

9. date: use the article publication date, NOT today's date. If unclear, use the most recent date mentioned.

OUTPUT: Return only valid JSON matching this schema:
${schema}`;
}
