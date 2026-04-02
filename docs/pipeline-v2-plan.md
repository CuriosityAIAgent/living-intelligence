# Content Pipeline v2 — Detailed Plan

## The Problem

Today you review raw material and approve it before the real work happens. The enrichment, multi-source research, and quality refinement happen partially, inconsistently, and sometimes after you've already approved. The result: 23% of entries are weak, and you're not reviewing the finished product.

## The New Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1: DISCOVERY + TRIAGE (automated, 5am daily)         │
│                                                              │
│  Auto-discover → URL dedup → Initial score (is this worth   │
│  spending compute on?) → candidates ranked                   │
│                                                              │
│  Score threshold: 40+ = proceed to Stage 2                   │
│  This is a TRIAGE score, not a quality score.                │
│  Fast, cheap, one API call per candidate.                    │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  STAGE 2: DEEP RESEARCH (automated, per candidate)          │
│                                                              │
│  Research Agent:                                             │
│  ├── Fetch primary source (Jina)                            │
│  ├── Search 5-10 additional sources (DFS + Jina + NewsAPI)  │
│  ├── Fetch and read each source                             │
│  ├── Pull our landscape data for this company               │
│  ├── Pull our past entries about this company               │
│  ├── Pull peer competitor data (same segment + capability)  │
│  ├── Identify: what's new here vs what we already know      │
│  └── Output: RESEARCH BRIEF (all sources, all context)      │
│                                                              │
│  Cost: ~$0.10-0.20 per candidate (1-2 Claude calls + APIs)  │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  STAGE 3: WRITE + REFINE (automated, 3 iterations)          │
│                                                              │
│  Iteration 1:                                                │
│  ├── Writer Agent: research brief → draft v1                │
│  │   (consulting persona, McKinsey voice)                    │
│  ├── Fabrication Agent: verify every claim in v1 against     │
│  │   ALL source documents (not just primary)                 │
│  ├── Evaluator Agent: rate against McKinsey Test checklist   │
│  │   (specificity, so-what, source, substance, stat,         │
│  │    competitor context). Returns specific feedback.         │
│  └── Output: draft v1 + fabrication report + evaluation      │
│                                                              │
│  Iteration 2:                                                │
│  ├── Writer Agent: draft v1 + feedback → draft v2           │
│  ├── Fabrication Agent: re-verify (refinement can drift)     │
│  └── Output: draft v2 + fabrication report                   │
│                                                              │
│  Iteration 3:                                                │
│  ├── Writer Agent: draft v2 + feedback → draft v3 (final)   │
│  ├── Fabrication Agent: final verification                   │
│  └── Output: FINAL ENTRY (verified, refined, consulting-quality)
│                                                              │
│  Cost: ~$0.60-1.00 per entry (6-8 Claude calls)             │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  STAGE 4: FINAL SCORING (automated)                         │
│                                                              │
│  Score the FINISHED entry, not the raw candidate.            │
│  Same 5 dimensions but now with full context:                │
│  ├── Dim A: Source Quality (now across ALL sources)          │
│  ├── Dim B: Claims (from fabrication report, multi-source)   │
│  ├── Dim C: Freshness                                        │
│  ├── Dim D: Capability Impact (enriched with landscape)      │
│  ├── Dim E: CXO Relevance (after 3 iterations of refining)  │
│  └── Multi-source bonus (based on actual verified sources)   │
│                                                              │
│  This score reflects the QUALITY of the finished product.    │
│  A raw URL that scored 45 in Stage 1 might score 82 here    │
│  after deep research reveals a compelling multi-source story.│
│  Or it might score 35 because research found nothing new.    │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  STAGE 5: EDITORIAL INBOX (you review the finished product) │
│                                                              │
│  What you see for each entry:                                │
│                                                              │
│  ┌─ ENTRY CARD ──────────────────────────────────────────┐  │
│  │ Headline (consulting-quality, capability-led)          │  │
│  │ Summary (analytical, not press-release restatement)    │  │
│  │ Why It Matters (3x refined, fabrication-checked)       │  │
│  │ Key Stat (decision-grade)                              │  │
│  │ Score: 84/100 (final score, not triage score)          │  │
│  │ Sources: 4 verified (BofA Newsroom · Reuters · ...)    │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ RESEARCH BRIEF (expandable)                            │  │
│  │ - 8 sources found, 4 verified, 2 paywalled, 2 thin    │  │
│  │ - Company history: 3 past entries on our platform      │  │
│  │ - Peer context: Morgan Stanley at "scaled", this firm  │  │
│  │   moving from "piloting" to "deployed"                 │  │
│  │ - What's new: first production deployment, was pilot   │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ FABRICATION REPORT (expandable)                        │  │
│  │ - 8 claims verified across 4 sources                   │  │
│  │ - 0 fabricated, 1 unverified (source truncated)        │  │
│  │ - Confidence: HIGH                                     │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ ITERATION HISTORY (expandable)                         │  │
│  │ - v1: "Generic so-what, missing peer context"          │  │
│  │ - v2: "Added Morgan Stanley comparison, tightened"     │  │
│  │ - v3: "Final — all checks pass"                        │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ [APPROVE]  [NEEDS WORK (add note)]  [REJECT]          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  You are reviewing the FINAL PRODUCT.                        │
│  All research, writing, verification already done.           │
│  Your job: approve, tweak a line, or send back.              │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  STAGE 6: PUBLISH + LANDSCAPE UPDATE                        │
│                                                              │
│  Approve → write JSON → git push main → portal rebuilds     │
│  Landscape trigger: check if this changes capability matrix  │
│  If yes → landscape suggestion for your review               │
└─────────────────────────────────────────────────────────────┘
```

---

## Two-Stage Scoring — Explained

### Stage 1 Score: "Is this worth researching?"
- Runs on the raw URL + title + snippet from discovery
- Fast: one evaluation, no Claude call, pure rules
- Dimensions: source tier + tracked company + keyword density + freshness
- Threshold: 40+ = proceed to deep research
- Purpose: filter noise cheaply. Don't spend $1 researching a blog post about "AI in general"

### Stage 4 Score: "How strong is this finished entry?"
- Runs on the fully researched, 3x-refined, fabrication-checked entry
- Uses ALL sources (not just the discovery URL)
- Uses the fabrication report (multi-source verification, not single-source)
- Uses the enriched landscape context
- This is the score you see in the Editorial Inbox
- A raw URL that triaged at 45 might final-score at 85 after deep research
- Or a promising URL might final-score at 30 because research found nothing substantive

**The key insight:** The initial score tells us where to spend compute. The final score tells us the quality of what we built. They measure different things.

---

## Agent Specifications

### Research Agent
**Input:** URL + title + source name + our landscape data + our past entries
**What it does:**
1. Fetch primary source via Jina
2. Extract key entities: company name, people named, metrics mentioned, capability area
3. Search for additional sources using extracted entities (not generic keywords):
   - "{Company Name} + {key topic}" via Jina
   - "{Company Name} AI {year}" via DFS News
   - "{Person named} + {Company}" via Jina (find interviews, quotes)
   - Headline keywords via NewsAPI.ai
4. Fetch and read each found source (up to 10)
5. Load our landscape file for this company (capabilities, maturity, evidence)
6. Load our last 3 published entries about this company
7. Load peer competitors (same segment, same capability)
8. Compile: what's genuinely new vs what we already know
9. Classify each source: primary (press release/newsroom) / coverage (journalism) / discovery (how we found it)

**Output:** Research Brief JSON
```json
{
  "primary_source": { "url": "...", "content": "...", "word_count": N },
  "additional_sources": [
    { "url": "...", "name": "...", "type": "primary|coverage", "key_facts": [...], "content_preview": "..." }
  ],
  "our_landscape": {
    "company": "...", "segment": "...",
    "current_capabilities": { "advisor_productivity": "deployed", ... },
    "last_updated": "2026-03-15"
  },
  "our_past_entries": [
    { "id": "...", "headline": "...", "date": "...", "the_so_what": "..." }
  ],
  "peer_context": [
    { "company": "...", "capability": "...", "maturity": "...", "headline": "..." }
  ],
  "whats_new": "This is the first production deployment — was in pilot since Q3 2025. Scale: 15,000 advisors.",
  "cross_source_conflicts": [],
  "source_count": N,
  "research_confidence": "high|medium|low"
}
```

### Writer Agent
**Input:** Research Brief + Editorial Voice Guide
**Persona:** Senior engagement manager at a top-3 strategy firm. Briefing a Head of Wealth Management. 90 seconds of attention. You have a point of view. Every claim backed by evidence.
**What it produces:**
- `headline`: Capability-led, specific, under 120 chars
- `summary`: Lead with capability + evidence, then event trigger. Analytical, not press-release restatement. Must add value beyond what any single source says.
- `the_so_what`: Falsifiable competitive claim. Must connect to peer landscape. Must answer "what should I do with this?"
- `key_stat`: Decision-grade number with named source
- `sources`: Verified array with type classification

**Rules:**
- Every claim must trace to a specific source in the research brief
- No analogies unless they illuminate something the reader didn't see
- No generic phrases (see editorial voice guide in docs/content-quality-audit.md)
- Must reference at least one peer competitor or landscape trend

### Evaluator Agent
**Input:** Draft entry + Research Brief + McKinsey Test Checklist
**What it does:** Rates the draft against the 6-point McKinsey Test:
1. Specificity: headline has specific capability/metric?
2. So-what: falsifiable claim that survives removing company name?
3. Source: all key numbers traceable to named source?
4. Substance: summary adds value beyond headline?
5. Stat: key_stat is decision-grade?
6. Competitor: connects to at least one peer?

**Output:** Pass/fail per check + specific improvement instructions
```json
{
  "checks": {
    "specificity": { "pass": true },
    "so_what": { "pass": false, "feedback": "Generic — 'growing importance of AI' could describe any story. Connect to Morgan Stanley's 98% adoption as benchmark." },
    "source": { "pass": true },
    "substance": { "pass": false, "feedback": "Summary restates press release. Add: what does this mean for firms still in pilot?" },
    "stat": { "pass": true },
    "competitor": { "pass": false, "feedback": "No peer mentioned. Add context: where does this place them vs UBS and Goldman?" }
  },
  "overall": "NEEDS_WORK",
  "priority_fix": "the_so_what needs competitive benchmark"
}
```

### Fabrication Agent
**Input:** Draft entry + ALL source documents (not just primary)
**What it does:** For every claim in headline, summary, the_so_what, key_stat:
1. Find the exact source document that supports it
2. Check: is the number exact, equivalent, or contradicted?
3. Check: is the attribution correct (right person said this)?
4. Check: did refinement introduce any claims not in any source?
5. Cross-source check: do sources agree or conflict on key facts?

**Output:** Fabrication Report
```json
{
  "verdict": "CLEAN|SUSPECT|FAIL",
  "claims_checked": 12,
  "claims_verified": 11,
  "claims_unverified": 1,
  "claims_fabricated": 0,
  "details": [
    { "claim": "15,000 advisors", "source": "BofA Newsroom", "status": "verified" },
    { "claim": "4 hours saved", "source": "American Banker", "status": "verified" },
    ...
  ],
  "cross_source_conflicts": [],
  "drift_from_v1": [] // claims added during refinement that need checking
}
```

---

## Execution Model: Hybrid Approach

The pipeline runs in two phases, using two different compute sources:

```
5:00 AM — Railway cron (API tokens, always-on server)
  │
  ├── Auto-discover: L1 News + L1 Caps + L2 Companies + L3 NewsAPI
  ├── URL dedup, semantic dedup
  ├── Stage 1 triage scoring (rule-based, no Claude calls)
  ├── Triaged candidates written to .pipeline-candidates.json
  └── Cost: ~$5/month (existing discovery APIs)

5:30 AM — Claude Code CLI on Haresh's Mac (Max tokens, zero API cost)
  │
  ├── Triggered by macOS launchd cron job
  ├── claude --prompt "Run /process-candidates"
  ├── Reads .pipeline-candidates.json
  ├── For each candidate above triage threshold:
  │   ├── Stage 2: Deep Research (multi-source, landscape context)
  │   ├── Stage 3: Write + Refine (3 iterations with fabrication checks)
  │   └── Stage 4: Final scoring
  ├── Writes finished entries to .governance-pending.json
  └── Cost: $0 (Max subscription tokens)

6:00 AM — Haresh opens Editorial Studio
  │
  ├── Sees finished, verified, 3x-refined entries
  ├── Research brief, fabrication report, iteration history all visible
  ├── Reviews, approves/rejects
  └── Approved entries → git push main → portal rebuilds
```

**Why hybrid:**
- Discovery stays on Railway (always-on, cheap, API tokens)
- Content production uses Max tokens (zero additional cost)
- Mac must be running at 5:30am (lid open or set to not sleep)
- If Mac is off, candidates queue until next run — no data loss

**Requirement:** Haresh's Mac needs to be on at 5:30am. `caffeinate` or Energy Saver settings can prevent sleep. If this becomes unreliable, fall back to API tokens (~$75-90/month).

## Cost Model (Hybrid)

| Component | Where it runs | Cost |
|-----------|--------------|------|
| Discovery + triage | Railway (API) | ~$5/month (existing) |
| Deep research | Claude Code (Max) | $0 |
| Write + refine (3 iterations) | Claude Code (Max) | $0 |
| Fabrication checks | Claude Code (Max) | $0 |
| Final scoring | Claude Code (rule-based) | $0 |
| Jina fetches (10 sources/entry) | API | ~$0.05/entry |
| **Total per entry** | | **~$0.05** |
| **Monthly (3 entries/day)** | | **~$5-10** |

Compared to full API approach ($75-90/month), the hybrid saves ~$70-80/month.

---

## Retrofitting Existing Entries

The 43 existing entries need to be brought up to standard. Approach:

### Phase 1: Delete/Remove (immediate)
- Delete 3 entries: dbs-worlds-best-ai-bank (duplicate), arta-ai-chief-of-staff (empty), betterment-ai-account-recommender (trivial)
- Unpublish 2: goldman-sachs-gs-ai-platform (unverified), vanguard-client-summaries (empty)

### Phase 2: Reprocess WEAK entries through v2 pipeline
- Run the 5 remaining weak entries through the full Research → Write → Refine pipeline
- Use the existing source_url as the starting point for deep research
- Replace the entry JSON entirely with the v2 output

### Phase 3: Upgrade ADEQUATE entries
- Run the 17 adequate entries through the Evaluator + Writer refinement loop only (skip research if sources are already good)
- Focus on: tightening the_so_what, adding peer context, upgrading key_stat

### Phase 4: Verify STRONG entries
- Run the 16 strong entries through the Fabrication Agent only (verify claims are still current)
- No rewriting needed unless fabrication issues found

---

## Editorial Studio UI Changes

### Current inbox card:
```
[Company] [Type badge] [Score]
Headline
[Approve] [Reject]
```

### New inbox card:
```
[Company] [Type badge] [Final Score: 84/100] [4 sources]
Headline (consulting-quality, capability-led)

Summary (2-3 lines, analytical)

Why It Matters
"The so_what text — falsifiable, competitive, connected to landscape"

Key Stat: 15,000 advisors (BofA Newsroom, Mar 2026)

▸ Research Brief (expandable)
▸ Fabrication Report: CLEAN — 12/12 claims verified (expandable)
▸ Iteration History: v1 → v2 → v3 (expandable)
▸ Sources: BofA Newsroom (primary) · Reuters (coverage) · American Banker (coverage) · Fortune (discovery)

[APPROVE]  [NEEDS WORK + note]  [REJECT + reason]
```

---

## Implementation Sequence

### Sprint 1: Research Agent (3-4 days)
- New file: `agents/research-agent.js`
- Multi-source search (entity-based, not keyword-based)
- Landscape context loading
- Past entries loading
- Research brief output format
- Tests for research brief completeness

### Sprint 2: Writer + Evaluator + Fabrication Agents (3-4 days)
- New file: `agents/writer-agent.js` (consulting persona prompt)
- New file: `agents/evaluator-agent.js` (McKinsey test checklist)
- Enhance: `agents/fabrication-strict.js` (multi-source, drift detection)
- 3-iteration loop orchestration
- Tests for each agent

### Sprint 3: Pipeline Orchestration — Hybrid (3-4 days)
- Modify `scheduler.js`: Stage 1 triage only, write candidates to `.pipeline-candidates.json`
- New file: `agents/content-producer.js` — orchestrates Stage 2-4 (Research → Write → Refine → Score)
- New Claude Code skill: `/process-candidates` — reads candidates, runs content-producer, writes to inbox
- macOS launchd job: triggers `claude --prompt "Run /process-candidates"` at 5:30am
- Two-stage scoring (triage score in scheduler, final score in content-producer)
- Store research brief + fabrication report + iteration history in entry JSON

### Sprint 4: Editorial Studio UI (2-3 days)
- Rich inbox card with expandable sections
- Research brief display
- Fabrication report display
- Iteration history display
- "Needs work" flow with notes

### Sprint 5: Retrofit Existing Entries (2-3 days)
- Delete/unpublish weak entries
- Reprocess through v2 pipeline
- Verify all entries pass McKinsey test

### Sprint 6: Testing + Hardening (2 days)
- End-to-end pipeline test (cron → Claude Code → finished entry in inbox)
- Test Mac sleep/wake scenarios
- Error handling for failed iterations
- Fallback to current pipeline if v2 fails
- `caffeinate` or Energy Saver setup for Mac

**Total: ~15-20 days of work, broken into 6 sprints.**

---

## What Doesn't Change

- Discovery layer (auto-discover.js) — stays as-is
- Landscape data model — stays as-is
- Portal UI — stays as-is (entries just get better)
- Git workflow — stays as-is
- Railway deployment — stays as-is

## Decisions (confirmed by Haresh, 2026-04-02)

1. **Automated + visible triage:** Full v2 pipeline runs automatically for every candidate that passes triage. But triage results (including ignored/blocked candidates) must be visible in the Editorial Studio so Haresh can spot-check and manually initiate any missed stories through the intake.

2. **2 iterations, not 3.** Write → Evaluate → Refine → Fabrication check → Evaluate → Final. If it passes all McKinsey tests after iteration 1, skip to final fabrication check. Saves cost and avoids over-processing strong stories.

3. **"Needs work" goes back to Writer Agent.** Haresh adds notes, the Writer Agent takes those notes + the current draft + research brief and produces a new version. Haresh does not edit manually. The system does the work.

4. **Retrofit existing entries FIRST, then launch v2.** Build the agents and prompts, then run all 43 entries through the pipeline to bring the platform to consulting quality. Once the platform is at standard, the v2 pipeline handles new entries going forward. Sequence: build agents → retrofit → launch.

5. **TL entries go through the pipeline — with a careful constraint.** The multi-agent pipeline applies to TL, but the Writer Agent must preserve the author's voice and argument. No dilution, no unnecessary connections to other TL pieces. The pipeline enriches the editorial framing (executive_summary, the_one_insight) but does NOT rewrite what the author said. Cross-TL connections ("you should also read X") can be surfaced as suggestions, but the core entry must stand on its own as a faithful representation of that author's thinking.
