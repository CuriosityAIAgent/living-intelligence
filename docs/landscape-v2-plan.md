# Landscape v2 Pipeline — Architecture & Plan

## What We're Building

A formal multi-agent pipeline for enriching landscape company profiles to consulting quality. Same rigor as the intelligence v2 pipeline (Sessions 14-16), adapted for the different structure of landscape profiles.

## Key Differences from Intelligence Pipeline

| | Intelligence Entry | Landscape Profile |
|---|---|---|
| **Input** | One article URL | Company slug (all available info) |
| **Sources** | 1 article + enrichment | Our intel entries + TL + web research + company newsroom |
| **Output** | Single entry (headline, summary, the_so_what) | Full company profile (strategy, 7 capabilities, evidence) |
| **Peer context** | Named in the_so_what | Named in ai_strategy_summary + capability comparisons |
| **Iteration** | 2 passes (write → evaluate → refine) | 2 passes (same structure) |

## The Pipeline

```
1. LANDSCAPE RESEARCH AGENT (landscape-research-agent.js)
   ├── Load ALL our intelligence entries about this company
   ├── Load TL entries that mention this company
   ├── Load current landscape profile (what we already have)
   ├── Load peer companies in same segment (for competitive benchmarks)
   ├── Search Jina for latest AI strategy coverage (2 queries)
   ├── Fetch top 3 search results (full text via Jina Reader)
   └── Output: Landscape Research Brief

2. LANDSCAPE WRITER AGENT (landscape-writer-agent.js)
   ├── Takes research brief + (optional) previous draft + evaluator feedback
   ├── Opus 4.6, McKinsey partner persona
   ├── Writes: ai_strategy_summary, headline_metric, headline_initiative
   ├── Assesses ALL 7 capability dimensions (including no_activity)
   ├── Every claim must trace to a named source
   ├── Peer competitors named in strategy summary
   └── Output: Complete profile JSON fields

3. LANDSCAPE EVALUATOR AGENT (landscape-evaluator-agent.js)
   ├── Takes draft profile + research brief
   ├── Checks against landscape-specific quality criteria:
   │   1. Strategy names ≥2 peer competitors?
   │   2. ≥4 capabilities assessed (including no_activity)?
   │   3. Every maturity level has supporting evidence?
   │   4. Every evidence line has source attribution?
   │   5. ai_strategy_summary is analytical (not a feature list)?
   │   6. Would a Head of Strategy at a competitor find this useful?
   └── Output: Pass/fail per check + improvement instructions

4. LANDSCAPE FABRICATION AGENT (reuse checkFabricationV2 from fabrication-strict.js)
   ├── Takes profile + all source texts from research brief
   ├── Verifies every metric against sources
   ├── Checks maturity claims against evidence
   ├── Drift detection on refinement iterations
   └── Output: Fabrication report

5. LANDSCAPE PRODUCER (landscape-producer.js)
   ├── Orchestrates: Research → Write → Fabrication → Evaluate
   ├── If NEEDS_WORK → Writer refines with feedback → Fabrication re-check
   ├── Max 2 iterations, early exit if iteration 1 passes
   ├── Merges output with existing profile fields (id, segment, regions, color)
   ├── Sets last_updated to today
   └── Output: Complete competitor JSON ready to write to data/competitors/
```

## Agents to Build

| Agent | File | New or Reuse |
|-------|------|-------------|
| Landscape Research Agent | `agents/landscape-research-agent.js` | **NEW** (already started) |
| Landscape Writer Agent | `agents/landscape-writer-agent.js` | **NEW** (already started) |
| Landscape Evaluator Agent | `agents/landscape-evaluator-agent.js` | **NEW** |
| Fabrication Check | `agents/fabrication-strict.js` | **REUSE** checkFabricationV2 |
| Landscape Producer | `agents/landscape-producer.js` | **NEW** |
| Batch Script | `scripts/batch-landscape-upgrade.js` | **NEW** |

## Quality Criteria (Landscape McKinsey Test)

Every profile must pass ALL:

1. **Strategy depth**: ai_strategy_summary ≥400 chars, names ≥2 peers
2. **Capability coverage**: ≥4 of 7 capabilities assessed (no_activity counts)
3. **Evidence sourced**: Every evidence bullet attributes a named source
4. **Maturity justified**: scaled requires adoption metrics, deployed requires user count, piloting requires scope, announced requires source
5. **Competitive context**: Strategy summary includes competitive positioning relative to segment peers
6. **Decision-grade**: A Head of AI at a competing firm would learn something new

## Iteration Process

```
Iteration 1:
  Research → Write v1 → Fabrication check → Evaluate
  → If ALL PASS: done
  → If NEEDS_WORK: continue

Iteration 2:
  Writer refines with evaluator feedback → Fabrication re-check → Evaluate
  → Accept result (max 2 iterations)
```

## Testing Plan

1. **Syntax check**: All agent files pass `node --check`
2. **Unit test**: Run on 3 diverse companies (1 wirehouse, 1 GPB, 1 advisor tool)
3. **Quality comparison**: Before vs after for each test company
4. **Fabrication test**: Feed it a company with known metrics, verify they're preserved
5. **Full batch**: Run all 37 companies, save to /tmp/landscape-v2/
6. **Visual review**: Start dev server, browse landscape pages on localhost:3002
7. **Only then push to main**

## Implementation Order

1. Complete landscape-research-agent.js (started)
2. Complete landscape-writer-agent.js (started)
3. Build landscape-evaluator-agent.js (new)
4. Build landscape-producer.js (orchestrator)
5. Build batch-landscape-upgrade.js (batch script)
6. Test on 3 companies
7. Run full batch (37 companies)
8. Visual review on localhost
9. Push to main

## Cost Considerations

- Research Agent: 0 API calls (reads local files + Jina search)
- Writer Agent: 1 Opus call per iteration (~$0.15)
- Evaluator Agent: 1 Opus call per iteration (~$0.10)
- Fabrication: 1 Sonnet call per iteration (~$0.05)
- Per company: ~$0.30-0.60 (1-2 iterations)
- All 37 companies: ~$11-22 total
- Via Claude Code (Max tokens): $0
