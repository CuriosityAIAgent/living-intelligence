#!/usr/bin/env node
/**
 * Creates a test research brief in Supabase for e2e pipeline testing.
 * Uses a real article URL, fetches via Jina, stores source + brief.
 *
 * Usage: node --env-file=.env scripts/create-test-brief.js [url]
 */

import { storeBrief, upsertSource } from '../agents/kb-client.js';

const DEFAULT_URL = 'https://www.wealthmanagement.com/technology/morgan-stanley-expands-ai-tools-financial-advisors';

const url = process.argv[2] || DEFAULT_URL;

async function main() {
  console.log(`[test-brief] Fetching article: ${url}`);

  // Fetch via Jina
  const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
  const resp = await fetch(jinaUrl, {
    headers: {
      'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
      'Accept': 'text/markdown',
    },
  });

  if (!resp.ok) {
    console.error(`[test-brief] Jina fetch failed: ${resp.status}`);
    process.exit(1);
  }

  const markdown = await resp.text();
  const wordCount = markdown.split(/\s+/).length;
  console.log(`[test-brief] Fetched ${wordCount} words`);

  // Store source in KB
  const sourceId = await upsertSource({
    url,
    title: 'Test article for e2e pipeline',
    source_name: new URL(url).hostname.replace('www.', ''),
    source_type: 'article',
    content_md: markdown,
    company_id: 'morgan-stanley',
    vertical_id: 'wealth',
    fetched_by: 'test-brief-script',
    word_count: wordCount,
  });

  console.log(`[test-brief] Source stored: ${sourceId}`);

  // Create brief
  const briefId = await storeBrief({
    candidate_url: url,
    company_id: 'morgan-stanley',
    vertical_id: 'wealth',
    entities: {
      company_name: 'Morgan Stanley',
      company_slug: 'morgan-stanley',
      capability_area: 'advisor_productivity',
      key_topic: 'Morgan Stanley AI tools for financial advisors',
      event_type: 'product_launch',
    },
    primary_source_id: sourceId,
    triage_score: 72,
    source_count: 1,
    status: 'ready',
  });

  if (briefId) {
    console.log(`[test-brief] ✅ Brief created: ${briefId}`);
    console.log(`[test-brief] Status: ready — Remote Trigger will pick this up`);
  } else {
    console.error(`[test-brief] ❌ Failed to create brief`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[test-brief] Fatal:', err.message);
  process.exit(1);
});
