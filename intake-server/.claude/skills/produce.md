---
description: "Produce consulting-quality intelligence entries from ready research briefs in the KB. Uses Claude Code Max tokens (free) for Opus-quality writing and evaluation."
user-invocable: true
---

# /produce — V2 Content Production Pipeline

Run the full v2 pipeline: read ready briefs from KB → write consulting-quality entries → evaluate against McKinsey test → refine if needed → add to editorial inbox.

**This runs inside Claude Code — all writing and evaluation uses your Max tokens (free). No API costs.**

## Steps

### 1. Fetch ready briefs from KB

Run this command to see what's available:

```bash
export PATH="$HOME/.fnm/node-versions/v20.20.0/installation/bin:$PATH"
cd ~/Desktop/Living\ Intelligence/living-intelligence/intake-server
node --env-file=.env scripts/fetch-briefs.js
```

If ARGUMENTS contains a number (e.g., `/produce 3`), hydrate that many briefs:
```bash
node --env-file=.env scripts/fetch-briefs.js --hydrate ${ARGUMENTS || 3}
```

If ARGUMENTS contains a UUID, hydrate that specific brief:
```bash
node --env-file=.env scripts/fetch-briefs.js --id ${ARGUMENTS}
```

### 2. For each hydrated brief, produce an entry

For each brief, you ARE the writer agent. Follow these rules exactly:

**READ the source material** from the hydrated brief (`_primary_source.content_md` and `_additional_sources[].content_md`).

**WRITE the entry** as a senior engagement manager at a top-3 strategy firm. Briefing a Head of Wealth Management. 90 seconds of attention. Every claim backed by evidence from the sources.

Required fields:
- `id`: URL-slug style (e.g., `morgan-stanley-ai-meeting-assistant`)
- `type`: funding / acquisition / regulatory / partnership / product_launch / milestone / strategy_move / market_signal
- `headline`: Under 120 chars. Lead with capability impact, not the event.
- `summary`: 3-5 sentences. Capability + evidence first, then event trigger. Only facts from sources.
- `the_so_what`: ONE falsifiable analytical sentence. Must reference a peer or landscape trend. NEVER use: CXO, board, "firms should", "game-changing", "landmark".
- `key_stat`: Decision-grade number from the source. `{ "number": "X", "label": "..." }` or null.
- `company`, `company_name`, `date`, `source_name`, `source_url`
- `capability_evidence`: `{ capability, stage, evidence, metric }`
- `tags`: `{ capability, region, segment, theme }`
- `sources`: Array of `{ name, url, type }` for each source used
- `source_verified`: true
- `image_url`: null (always)
- `week`: Monday of the article's week (YYYY-MM-DD)

### 3. Evaluate against McKinsey 6-check test

After writing, evaluate your own draft against these 6 checks:

1. **Specificity** — Does the headline have a specific capability or metric?
2. **So-what** — Is `the_so_what` falsifiable and does it survive removing the company name?
3. **Source** — Are all key numbers traceable to a named source?
4. **Substance** — Does the summary add value beyond restating the headline?
5. **Stat** — Is key_stat decision-grade (would a CXO cite this in a board presentation)?
6. **Competitor** — Does the entry connect to at least one peer?

If any check fails, **refine the entry** before proceeding. Max 1 refinement pass.

### 4. Fabrication check

Verify every factual claim in the entry against the source material:
- Every number must appear in a source
- Every attribution must be correct
- `the_so_what` editorial interpretation is allowed, but factual claims within it must be sourced

### 5. Save to editorial inbox

Use the intake server API to add the entry to the inbox:

```bash
curl -X POST http://localhost:3003/api/process-url \
  -H "Content-Type: application/json" \
  -d '{"url": "<source_url>", "entry": <the_entry_json>}'
```

Or write the entry JSON directly to the pending queue by calling:
```bash
node --env-file=.env -e "
import { addPending } from './agents/gov-store.js';
const entry = JSON.parse(process.argv[1]);
const govAudit = { verdict: 'PASS', confidence: 90, verified_claims: [], unverified_claims: [], fabricated_claims: [], notes: 'v2 pipeline — Claude Code Max', paywall_caveat: false, verified_at: new Date().toISOString(), human_approved: false };
addPending(entry, govAudit, { score: 85, score_breakdown: 'v2 pipeline' });
console.log('Added to inbox:', entry.id);
" '<entry_json_here>'
```

### 6. Report results

After processing all briefs, report:
- How many entries produced
- Headlines + scores
- Any that were skipped and why

## Key principles

- **You ARE Opus** — no API calls needed for writing or evaluation
- **Every claim must trace to source text** you read from the brief
- **Read the landscape file** for the company (`data/competitors/{slug}.json`) to get peer context
- **the_so_what must reference a competitor** or landscape trend
- **date is the article's publication date**, NOT today
