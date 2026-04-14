/**
 * entity-extraction-v1.js — Entity extraction prompt for research-agent.js
 * Version: entity-extraction-v1 (2026-04-06)
 *
 * Extracts companies, people, metrics, and capability classification from article text.
 */

export const VERSION = 'entity-extraction-v1';

export function build({ url, markdown }) {
  return `Extract key entities from this article. Be thorough — every person quoted and every number mentioned matters.

ARTICLE URL: ${url}
ARTICLE TEXT (first 5000 chars):
${markdown.slice(0, 5000)}

Return JSON only. Do NOT leave arrays empty — if people are quoted or named, list them. If numbers appear, list them:
{
  "company_name": "Full company name mentioned most prominently",
  "company_slug": "lowercase-hyphenated (e.g. bank-of-america, morgan-stanley, bofa-merrill)",
  "people": ["Full Name — Title, Organization (e.g. 'Jed Finn — Head of Wealth Management, Morgan Stanley')"],
  "metrics": ["Every number: $80M, 15,000 advisors, 98% adoption, 4 hours saved, 30 billion interactions — list ALL numbers from the article"],
  "capability_area": "advisor_productivity | client_personalization | investment_portfolio | research_content | client_acquisition | operations_compliance | new_business_models | unknown",
  "key_topic": "2-5 word description of what happened (e.g. 'AI meeting automation rollout')",
  "event_type": "funding | acquisition | regulatory | partnership | product_launch | milestone | strategy_move | market_signal"
}`;
}
