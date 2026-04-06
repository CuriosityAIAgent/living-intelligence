/**
 * generate-embeddings.js — Batch embed all sources missing embeddings
 *
 * Uses Jina embeddings-v3 (512 dims, text-matching task).
 * Processes in batches of 20, with 1s delay between batches.
 * Resumable: only processes rows where embedding IS NULL.
 *
 * Usage:
 *   node --env-file=.env scripts/generate-embeddings.js
 *   node --env-file=.env scripts/generate-embeddings.js --limit 50
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const BATCH_SIZE = 20;
const DELAY_MS = 1000;
const DIMENSIONS = 512;
const MAX_CHARS = 8000; // truncate content for embedding (Jina limit ~8K tokens)

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function getEmbeddings(texts) {
  const res = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'jina-embeddings-v3',
      task: 'text-matching',
      dimensions: DIMENSIONS,
      input: texts,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jina API ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.data.map(d => d.embedding);
}

function buildEmbeddingText(source) {
  // Combine title + content for richer embedding
  const parts = [];
  if (source.title) parts.push(source.title);
  if (source.content_md) parts.push(source.content_md.slice(0, MAX_CHARS));
  return parts.join('\n\n') || '';
}

async function main() {
  const limitArg = process.argv.includes('--limit')
    ? parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10)
    : null;

  // Count total needing embeddings
  const { count: totalNull } = await supabase
    .from('sources')
    .select('id', { count: 'exact', head: true })
    .is('embedding', null);

  const { count: totalAll } = await supabase
    .from('sources')
    .select('id', { count: 'exact', head: true });

  console.log(`Sources: ${totalAll} total, ${totalNull} missing embeddings`);

  if (totalNull === 0) {
    console.log('All sources already have embeddings. Nothing to do.');
    return;
  }

  const limit = limitArg || totalNull;
  console.log(`Processing ${limit} sources in batches of ${BATCH_SIZE}...\n`);

  let processed = 0;
  let errors = 0;
  let offset = 0;

  while (processed < limit) {
    // Fetch batch of sources without embeddings
    const { data: batch, error } = await supabase
      .from('sources')
      .select('id, title, content_md')
      .is('embedding', null)
      .order('fetched_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('DB fetch error:', error.message);
      break;
    }
    if (!batch || batch.length === 0) break;

    // Build texts for embedding
    const texts = batch.map(buildEmbeddingText).map(t => t || 'empty');

    try {
      const embeddings = await getEmbeddings(texts);

      // Update each source with its embedding
      for (let i = 0; i < batch.length; i++) {
        const { error: updateError } = await supabase
          .from('sources')
          .update({ embedding: JSON.stringify(embeddings[i]) })
          .eq('id', batch[i].id);

        if (updateError) {
          console.error(`  ✗ ${batch[i].id}: ${updateError.message}`);
          errors++;
        } else {
          processed++;
        }
      }

      console.log(`  ✓ Batch ${Math.ceil((processed) / BATCH_SIZE)}: ${processed}/${limit} embedded (${errors} errors)`);
    } catch (err) {
      console.error(`  ✗ Batch failed: ${err.message}`);
      errors += batch.length;
      offset += BATCH_SIZE; // skip failed batch
    }

    // Rate limit
    if (processed < limit) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\nDone. ${processed} embedded, ${errors} errors.`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
