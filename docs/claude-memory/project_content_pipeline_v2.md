---
name: Living Intelligence — Multi-Agent Content Pipeline v2
description: Haresh's vision for premium content quality. Multi-agent pipeline with research, writing, evaluation, fabrication checking, and iterative refinement. The foundation of the premium product.
type: project
---

# Multi-Agent Content Pipeline v2

## The Problem
Current pipeline is one-shot: discover → fetch → Claude structures → governance checks → publish. This produces 37% STRONG, 40% ADEQUATE, 23% WEAK content. A $4,500/year premium product cannot have ANY weak entries. The quality must match what a McKinsey engagement would produce.

## Haresh's Vision (2026-04-02)

### The Pipeline

```
RESEARCH AGENT
  ├── Fetch primary source (article URL)
  ├── Search for 10+ related sources (other coverage, press releases, analyst notes)
  ├── Pull historical context from our landscape (what do we already know about this company?)
  ├── Pull recent entries about this company (what have we written before?)
  ├── Pull peer context (what are competitors doing in the same capability?)
  ├── Connect dots across the landscape
  └── Output: RAW RESEARCH BRIEF (all sources, all context, all connections)
          ↓
WRITER AGENT (consulting persona)
  ├── Takes the research brief
  ├── Writes in McKinsey/BCG consulting tone
  ├── Produces: headline, summary, the_so_what, key_stat
  ├── Follows editorial voice guide (see docs/content-quality-audit.md)
  └── Output: DRAFT v1
          ↓
EVALUATOR AGENT (iteration 1)
  ├── Takes draft v1 + research brief
  ├── Checks: Does the_so_what make a falsifiable claim?
  ├── Checks: Does the summary add value beyond the press release?
  ├── Checks: Is the key_stat decision-grade?
  ├── Checks: Is there competitive context?
  ├── Asks specific improvement questions
  └── Output: FEEDBACK v1
          ↓
WRITER AGENT (refinement 1)
  ├── Takes draft v1 + feedback v1
  └── Output: DRAFT v2
          ↓
FABRICATION AGENT
  ├── Takes draft v2 + ALL original sources
  ├── Verifies every claim against source material
  ├── Flags anything not directly supported
  ├── NO TOLERANCE for unsourced claims, regardless of how well-written
  └── Output: VERIFIED DRAFT v2 (with fabrication report)
          ↓
EVALUATOR AGENT (iteration 2)
  ├── Takes verified draft v2 + research brief
  ├── Final quality pass
  └── Output: FEEDBACK v2
          ↓
WRITER AGENT (refinement 2)
  └── Output: DRAFT v3 (final)
          ↓
FABRICATION AGENT (final check)
  ├── Final verification against sources
  └── Output: FINAL ENTRY (verified, refined, consulting-quality)
```

### Key Principles

1. **Research first, writing second.** The research agent does the heavy lifting. If the research is thin, the writing will be thin. No amount of good writing fixes bad research.

2. **3 iterations minimum.** One-shot = 37% STRONG. Three iterations with evaluation = target 90%+ STRONG.

3. **Fabrication check at every refinement.** Each time the writer refines, the fabrication agent re-checks. Good writing can introduce subtle fabrication (smoothing numbers, generalizing claims). The fabrication agent catches drift.

4. **Connect dots across the landscape.** The research agent doesn't just fetch the article — it pulls what we already know about the company, what peers are doing, what the historical pattern is. This is what makes it intelligence, not aggregation.

5. **Consulting persona, not AI summary.** The writer agent has a specific persona: senior engagement manager at a top-3 strategy firm, briefing a Head of Wealth Management. Point of view required. Generic observations banned.

## What This Replaces
- Current: `intake.js` → one Claude call → `governance.js` → one verification call → done
- New: Research → Write → Evaluate → Refine → Fabrication Check → Evaluate → Refine → Final Check
- Current pipeline becomes the "discovery + scoring" layer. The multi-agent pipeline is the "content production" layer.

## Status
- **Detailed plan written and DECISIONS LOCKED** at `docs/pipeline-v2-plan.md`
- Full architecture: 6 stages, 4 agent specs, hybrid cost model, UI mockup, 6 sprints
- All 5 open questions answered by Haresh:
  1. Automated pipeline + visible triage (ignored items shown for manual override)
  2. 2 iterations (not 3) — skip second if McKinsey test passes first time
  3. "Needs work" goes back to Writer Agent with Haresh's notes
  4. Retrofit existing 43 entries FIRST, then launch v2 for new entries
  5. TL goes through pipeline but preserve author's voice — no dilution

## Execution: Phased Approach (REVISED after architecture review)

### Key findings from CLI research:
- Claude Code CLI `-p` works for multi-step workflows BUT skills don't work in -p mode
- Claude Code Desktop has scheduled tasks (better than CLI cron)
- Agent SDK exists for fully server-side autonomous workflows
- Opus 4.6 produces significantly better writing than Sonnet — use Opus for Writer + Evaluator

### The phased plan:
- **Phase 1 (NOW): Manual-first.** Build agents, test in interactive Claude Code sessions. Retrofit 43 entries. Validate quality. No automation infrastructure.
- **Phase 2: Claude Code Desktop scheduled tasks.** After agents proven. Mac must be on. Max tokens + Opus.
- **Phase 3: Agent SDK on server.** When paying customers need reliability. API tokens, ~$40/mo.

### Full architecture review at `docs/pipeline-v2-architecture-review.md`

## Key Numbers
- ~$0.05 per entry (Jina fetches only, Claude via Max tokens)
- At 3 entries/day = ~$5-10/month total
- 6 sprints, ~15-20 days of work
- Two-stage scoring: triage (worth researching?) vs final (quality of finished product)
