/**
 * writer-agent.js — Consulting-quality entry writer (Opus)
 *
 * Takes a research brief and produces a structured IntelligenceEntry.
 * Supports refinement: pass previousDraft + evaluatorFeedback for iteration.
 * Supports editor re-work: pass editorNotes for human-guided revision.
 *
 * Uses Opus for maximum quality — this is the flagship content agent.
 */

import Anthropic from '@anthropic-ai/sdk';
import { build as buildWriterPrompt, VERSION as WRITER_PROMPT_VERSION } from '../prompts/writer-v1.js';

const client = new Anthropic();

const ENTRY_SCHEMA = `{
  "id": "url-slug-style-id",
  "type": "funding | acquisition | regulatory | partnership | product_launch | milestone | strategy_move | market_signal",
  "headline": "Under 120 chars — capability/impact led",
  "summary": "3-5 sentences. Capability + evidence first, then event trigger.",
  "the_so_what": "One falsifiable analytical sentence. Must reference a peer or landscape trend.",
  "company": "company-slug",
  "company_name": "Full Company Name",
  "date": "YYYY-MM-DD (article publication date, NOT today)",
  "source_name": "Publication Name",
  "source_url": "primary URL",
  "source_verified": true,
  "image_url": null,
  "key_stat": { "number": "X", "label": "what it measures" },
  "capability_evidence": {
    "capability": "advisor_productivity | client_personalization | investment_portfolio | research_content | client_acquisition | operations_compliance | new_business_models",
    "stage": "deployed | piloting | announced",
    "evidence": "One sentence proof from source",
    "metric": "Quantified impact or null"
  },
  "tags": {
    "capability": "...",
    "region": "us | emea | asia | latam | global",
    "segment": "wirehouse | global_private_bank | regional_champion | digital_disruptor | ai_native | ria_independent | advisor_tools",
    "theme": ["2-4 tags"]
  },
  "sources": [{ "name": "Source Name", "url": "https://...", "type": "primary | coverage | discovery" }],
  "week": "YYYY-MM-DD (monday of article week)",
  "featured": false
}`;

/**
 * Write or refine an intelligence entry from a research brief.
 *
 * @param {Object} params
 * @param {Object} params.researchBrief - From research-agent.js
 * @param {Object} [params.previousDraft] - Previous draft for refinement
 * @param {Object} [params.evaluatorFeedback] - From evaluator-agent.js
 * @param {string} [params.editorNotes] - Human editor feedback
 * @returns {Object} Structured entry (parsed JSON)
 */
export async function write({ researchBrief, previousDraft, evaluatorFeedback, editorNotes }) {
  const prompt = buildWriterPrompt({
    researchBrief,
    previousDraft,
    evaluatorFeedback,
    editorNotes,
    schema: ENTRY_SCHEMA,
  });

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Writer agent returned no JSON');
  }

  const entry = JSON.parse(jsonMatch[0]);

  // Attach prompt version for observability
  entry._prompt_version = WRITER_PROMPT_VERSION;

  return entry;
}

export { WRITER_PROMPT_VERSION };
