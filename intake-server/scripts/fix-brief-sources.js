#!/usr/bin/env node
/**
 * Fix research briefs that have no primary_source_id.
 * Looks up the source by candidate_url and links it.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Get all ready briefs with no primary source
  const { data: briefs } = await supabase
    .from('research_briefs')
    .select('id, candidate_url, company_id, primary_source_id')
    .eq('status', 'ready')
    .is('primary_source_id', null);

  if (!briefs?.length) {
    console.log('No briefs need fixing');
    return;
  }

  console.log(`Found ${briefs.length} briefs without primary_source_id`);

  for (const brief of briefs) {
    // Look up source by URL
    const { data: source } = await supabase
      .from('sources')
      .select('id, url, word_count')
      .eq('url', brief.candidate_url)
      .single();

    if (source) {
      await supabase
        .from('research_briefs')
        .update({ primary_source_id: source.id })
        .eq('id', brief.id);
      console.log(`✅ ${brief.company_id}: linked source ${source.id} (${source.word_count} words)`);
    } else {
      // Try to find any source for this company
      const { data: companySources } = await supabase
        .from('sources')
        .select('id, url, word_count')
        .eq('company_id', brief.company_id)
        .order('word_count', { ascending: false })
        .limit(5);

      if (companySources?.length) {
        // Link the richest source as primary, rest as additional
        const primary = companySources[0];
        const additional = companySources.slice(1).map(s => s.id);
        await supabase
          .from('research_briefs')
          .update({
            primary_source_id: primary.id,
            additional_source_ids: additional,
            source_count: companySources.length,
          })
          .eq('id', brief.id);
        console.log(`✅ ${brief.company_id}: linked ${companySources.length} sources (primary: ${primary.word_count} words)`);
      } else {
        console.log(`⚠️  ${brief.company_id}: no sources found for URL or company`);
      }
    }
  }

  console.log('\nDone. Re-check hydration endpoint.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
