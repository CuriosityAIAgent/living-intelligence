/**
 * intake-v1.js — Structuring prompt for intake.js
 * Version: intake-v1 (2026-04-06)
 *
 * Converts raw article markdown into typed IntelligenceEntry JSON.
 */

export const VERSION = 'intake-v1';

export function build({ url, source_name, needs_enrichment, enrichment_sources, markdown, schema, today }) {
  const hasEnrichment = enrichment_sources && enrichment_sources.length > 0;

  return `You are an editorial analyst for a premium wealth management intelligence publication.

Your job is NOT to summarise what happened. Every entry must answer three questions:
1. Which AI capability is advancing and what is the concrete evidence? (the intelligence)
2. What does this mean across the wealth management landscape? (the_so_what — analytical insight)
3. What was the triggering event? (context only — funding, launch, partnership)

The event is never the story. The story is always the capability advancing and the strategic insight.

SOURCE ARTICLE URL: ${url}
SOURCE NAME: ${source_name}
${needs_enrichment ? '⚠ Original article had limited content (paywall or thin). Enrichment sources have been added below.' : ''}
${hasEnrichment ? `\nENRICHMENT SOURCES USED:\n${enrichment_sources.map(s => `- ${s}`).join('\n')}\n` : ''}

ARTICLE CONTENT (markdown):
---
${markdown.slice(0, 10000)}
---

Structure this into the following JSON schema.

CRITICAL RULES:
1. the_so_what: One sentence of analytical insight. Choose the best angle for this story:
   - Competitive benchmark: scale economics, compounding data advantages, cost-to-serve gaps
   - Cross-landscape context: connect to what peers/competitors are doing, show the pattern
   - Infrastructure parallel: compare to historic technology shifts (electronic trading, Salesforce CRM, Bloomberg terminals)
   - Business model insight: why the model matters more than the technology
   NEVER use: CXO, board, "firms should", "must now decide", "game-changing", "landmark", "revolutionary", "paradigm shift", "It remains to be seen"
   BAD: "Jump raised $80M to expand its AI meeting assistant platform." (just a summary)
   BAD: "Any wealth CXO still treating meeting workflow as a roadmap item is falling behind." (directive)
   GOOD: "Advisor productivity tools are now a funded, scaling category — 15,000 advisors already have an AI meeting workflow, establishing a per-advisor cost advantage that compounds with every client interaction."
   GOOD: "The independent channel adopting AI faster than the institutional channel is a structural reversal of the historic adoption curve, following the same pattern as discount brokerage adoption in the 1990s."

2. summary: Lead with the CAPABILITY and its EVIDENCE. Then explain the event trigger. Only facts from the source.
   BAD: "Jump raises $80M Series B to expand its AI platform."
   GOOD: "Jump's AI assistant automates meeting notes and CRM updates, saving advisors 6 hours per week. Currently used by 3,000 advisors, the company raised $80M to scale to 15,000. Lead investor Insight Partners cited advisor time savings as primary investment thesis."

3. headline: Lead with the capability impact or scale, not the dollar amount or event type.
   BAD: "Jump Raises $80M Series B"
   GOOD: "Jump Scales AI Meeting Assistant to 15,000 Advisors After $80M Series B"

4. key_stat: The single most significant number for a CXO — advisors reached, AUM affected, time saved, cost reduced. Must be explicitly stated in the source. If no meaningful number, set to null.

5. capability_evidence: Populate ALL fields if evidence exists. stage = "deployed" only if live with real users. "piloting" = being tested. "announced" = committed but not live. metric = null if no quantified impact stated.

6. If the article has no identifiable AI capability dimension for wealth management, set type to "market_signal".
7. If the article is not about AI in wealth management or financial services at all, set type to null.
8. All summary content must come ONLY from the source article above. No inference from training data.
9. For image_url: always set to null — logos are managed separately via local files
10. If multiple sources cover the same story, synthesize the most complete version. Prefer primary sources.

Event type definitions:
- funding: capital raise (seed, Series A/B/C, debt, IPO)
- acquisition: M&A — company acquiring or being acquired
- regulatory: regulatory guidance, compliance requirements, enforcement, government AI policy for financial services
- partnership: strategic partnership, integration, or distribution agreement between named institutions
- product_launch: new AI product, feature, or platform going live or announced
- milestone: user count, AUM, deployment scale achievement
- strategy_move: strategic direction, firm-wide AI policy, executive statement of intent
- market_signal: survey data, industry report, analyst opinion, general trend — no specific company action

Today's date: ${today}

OUTPUT: Return only valid JSON matching this schema exactly:
${schema}`;
}
