/**
 * fetch-briefs.js — Read ready briefs from KB for Claude Code consumption
 *
 * Usage:
 *   node --env-file=.env scripts/fetch-briefs.js              # list ready briefs
 *   node --env-file=.env scripts/fetch-briefs.js --hydrate 3   # hydrate top 3 with source text
 *   node --env-file=.env scripts/fetch-briefs.js --id <uuid>   # hydrate one specific brief
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function listBriefs() {
  const { data, error } = await supabase
    .from('research_briefs')
    .select('id, candidate_url, candidate_source, company_id, source_count, triage_score, research_confidence, created_at')
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) { console.error('Error:', error.message); return; }
  if (!data || data.length === 0) { console.log('No ready briefs.'); return; }

  console.log(`\n${data.length} ready briefs:\n`);
  for (const b of data) {
    console.log(`  ${b.id.slice(0, 8)}  ${(b.company_id || '???').padEnd(20)}  ${b.source_count || '?'} src  score:${b.triage_score || '?'}  ${b.created_at?.slice(0, 10)}  ${b.candidate_url?.slice(0, 60)}`);
  }
}

async function hydrateBrief(id) {
  // Load brief
  const { data: brief, error } = await supabase
    .from('research_briefs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !brief) { console.error(`Brief ${id} not found`); return null; }

  // Load primary source
  if (brief.primary_source_id) {
    const { data } = await supabase
      .from('sources')
      .select('url, title, source_name, content_md, word_count')
      .eq('id', brief.primary_source_id)
      .single();
    if (data) brief._primary_source = data;
  }

  // Load additional sources
  if (brief.additional_source_ids?.length > 0) {
    const { data } = await supabase
      .from('sources')
      .select('id, url, title, source_name, content_md, word_count')
      .in('id', brief.additional_source_ids);
    if (data) brief._additional_sources = data;
  }

  return brief;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--id')) {
    const id = args[args.indexOf('--id') + 1];
    const brief = await hydrateBrief(id);
    if (brief) console.log(JSON.stringify(brief, null, 2));
    return;
  }

  if (args.includes('--hydrate')) {
    const limit = parseInt(args[args.indexOf('--hydrate') + 1], 10) || 3;
    const { data } = await supabase
      .from('research_briefs')
      .select('id')
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data || data.length === 0) { console.log('No ready briefs.'); return; }

    const briefs = [];
    for (const row of data) {
      const b = await hydrateBrief(row.id);
      if (b) briefs.push(b);
    }
    console.log(JSON.stringify(briefs, null, 2));
    return;
  }

  await listBriefs();
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
