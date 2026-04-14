# Pipeline v2 — Session-by-Session Execution Plan

---

## Session 14: Research Agent + Data Model

**Goal:** Build the Research Agent and define the v2 data model

### Build
- New file: `agents/research-agent.js`
  - Entity extraction from primary source (company, people, metrics, capability area)
  - Multi-source search using entities (not generic keywords):
    - "{Company} + {topic}" via Jina
    - "{Company} AI {year}" via DFS News
    - "{Person} + {Company}" via Jina
    - Headline keywords via NewsAPI.ai
  - Fetch and read each source (up to 10) — FULL TEXT, not compressed
  - Load landscape file for this company (capabilities, maturity, evidence)
  - Load last 3 published entries about this company
  - Load peer competitors (same segment, same capability dimension)
  - "What's new" determination — compare story against past entries + landscape
  - Source classification: primary (press release/newsroom) / coverage (journalism) / discovery
  - Abort gate: if research confidence "low" AND source_count < 2 → park candidate with note "insufficient source material"
  - Cross-source conflict detection: flag if sources disagree on key facts

### Data Model
- Define the v2 entry JSON schema — all fields that will be stored:
  - Existing fields (headline, summary, the_so_what, key_stat, sources, etc.)
  - `_research`: full research brief (sources found, landscape context, past entries, what's new, confidence)
  - `_fabrication`: fabrication report (claims checked, verified, fabricated, drift, cross-source conflicts)
  - `_iterations`: array of {version, draft, evaluation, fabrication_report}
  - `_triage_score`: initial discovery score
  - `_final_score`: post-pipeline quality score
  - `_editor_notes`: array of notes from "needs work" flow
- Define the Research Brief JSON output format
- This data model is used by ALL subsequent agents — get it right now

### Test
- Run Research Agent on 5 real URLs (mix of tracked companies, new companies, paywalled sources)
- Verify: does the brief contain enough for a consultant to write from?
- Verify: abort gate fires correctly on thin sources
- Verify: cross-source conflicts detected when sources disagree
- Unit tests for entity extraction, source classification, landscape loading

### Not in this session
- No writing, no evaluation, no fabrication checking — just research

---

## Session 15: Writer Agent + Evaluator Agent

**Goal:** Build consulting-quality writing and the quality gate

### Build — Writer Agent
- New file: `agents/writer-agent.js`
- **Opus 4.6 optimised prompt** — this is the most important prompt in the system
- Persona: Senior engagement manager at a top-3 strategy firm. Briefing a Head of Wealth Management. 90 seconds of attention. Point of view required. Every claim backed by evidence.
- Produces: headline, summary, the_so_what, key_stat, capability_evidence, tags
- Rules baked into prompt:
  - Every claim must trace to a specific source in the research brief
  - No analogies unless they illuminate something new (retire Bloomberg terminal comparison)
  - No generic phrases (from editorial voice guide in content-quality-audit.md)
  - Must reference at least one peer competitor or landscape trend
  - the_so_what must be falsifiable — if no one could disagree, it's filler
  - key_stat must be decision-grade — usable in a board presentation
  - summary must add analytical value beyond any single source
- **Separate TL Writer prompt:**
  - Persona: Senior editor at the Financial Times, commissioning a précis for the Wealth Management supplement
  - Must faithfully represent the author's argument — NOT reinterpret
  - the_one_insight must be the AUTHOR'S thesis, not our editorial spin
  - executive_summary must build the author's logical argument, not just list bullets
  - Cross-TL connections surfaced as "Related reading" suggestions only, never merged into the core entry
  - key_quotes must be the author's most quotable lines for a board meeting

### Build — Evaluator Agent
- New file: `agents/evaluator-agent.js`
- Rates draft against 6-point McKinsey Test:
  1. Specificity: headline has specific capability/metric, not just event type?
  2. So-what: falsifiable claim that survives removing company name?
  3. Source: all key numbers traceable to named source in research brief?
  4. Substance: summary adds value beyond headline + any single source?
  5. Stat: key_stat is decision-grade (usable in board presentation)?
  6. Competitor: connects to at least one peer in our landscape?
- Output: pass/fail per check + specific improvement instructions
- Early exit logic: if ALL 6 pass on iteration 1 → skip to fabrication, no refinement needed

### Build — 2-Iteration Loop
- Orchestration logic (will live in content-producer.js, built in Session 16):
  - Write v1 → Evaluate → if all pass → Fabrication → done
  - If any fail → Writer takes feedback → Write v2 → Fabrication → done
  - Max 2 iterations. If v2 still fails evaluation → entry gets parked with "quality gate failed" note, visible in Editorial Studio for manual intervention

### Test
- Run 5 research briefs (from Session 14) through Writer → Evaluator
- Compare v2 output side-by-side with current entries for same stories
- Verify: is the quality genuinely consulting-grade?
- Verify: does the Evaluator catch generic the_so_what?
- Verify: does the TL Writer preserve author voice?
- Test early exit: feed it a strong research brief, confirm it passes on v1
- Unit tests for evaluation logic

---

## Session 16: Fabrication Agent + Content Producer Orchestrator

**Goal:** Wire everything together with fabrication safety and orchestration

### Build — Enhanced Fabrication Agent
- Enhance `agents/fabrication-strict.js` for v2 pipeline:
  - **Multi-source verification**: check claims against ALL sources, not just primary
  - **Full source text input**: no compression — send complete article text for each source
  - **Drift detection**: compare v2 claims against v1 claims. Flag anything in v2 that:
    - Wasn't in v1 AND isn't in any source (introduced during refinement)
    - Changed a qualifier (e.g., "potentially 4 hours" → "4 hours")
    - Strengthened a claim (e.g., "piloting" → "deployed")
  - **Cross-source conflict detection**: if sources disagree on a number, flag it
  - **the_so_what handling**: editorial insight is ALLOWED, but any factual claim within the_so_what must trace to a source. "The advisor productivity gap is widening" (editorial) is fine. "Morgan Stanley's advisors save 30 minutes per meeting" (factual) must be sourced.
  - **Verdict logic**: CLEAN (all verified) / SUSPECT (1-2 not found, no contradictions) / FAIL (any contradiction or invented number)

### Build — Content Producer Orchestrator
- New file: `agents/content-producer.js`
- Orchestrates the full pipeline for one candidate:
  ```
  Input: candidate URL + title + source_name
  1. Research Agent → Research Brief
     → If abort gate fires → park candidate, return
  2. Writer Agent (Opus) → Draft v1
  3. Fabrication Agent → Fabrication Report v1
     → If FAIL → park candidate with "fabrication failed"
  4. Evaluator Agent (Opus) → Evaluation v1
     → If ALL PASS → skip to step 7
  5. Writer Agent (Opus) → Draft v2 (with evaluation feedback)
  6. Fabrication Agent → Fabrication Report v2
     → If FAIL → park candidate
  7. Final Scoring (rule-based, using fabrication report + source count + landscape context)
  8. Store everything in entry JSON: _research, _fabrication, _iterations, _triage_score, _final_score
  9. Write to .governance-pending.json (Editorial Inbox)
  Output: finished entry ready for review
  ```
- **"Needs work" re-entry flow:**
  - Input: existing entry JSON (with _research, _iterations) + editor notes
  - Writer Agent takes: current draft + editor notes + research brief → new draft
  - Fabrication Agent re-verifies
  - Updated entry written back to inbox
- **Error handling:**
  - If Research Agent fails (API timeout, no sources) → park with reason, retry next run
  - If Writer crashes → park with "writer error", retry
  - If Fabrication fails 2x on same entry → park with "could not verify", needs manual review
  - No infinite loops — max 2 Writer iterations, max 2 Fabrication attempts per iteration
- **Candidate limits:** Process top 5 candidates by triage score per run (not all 15)

### Build — Two-Stage Scoring
- Triage score (Stage 1): existing discovery scoring in scheduler.js — stays as-is
- Final score (Stage 4): new scoring function in content-producer.js
  - Same 5 dimensions but calculated from the finished entry:
  - Dim A: Source Quality — averaged across ALL verified sources (not just primary)
  - Dim B: Claims — from fabrication report (verified/total ratio)
  - Dim C: Freshness — same as current
  - Dim D: Capability Impact — same logic but enriched with landscape context
  - Dim E: CXO Relevance — from evaluator result (pass/fail on McKinsey test)
  - Multi-source bonus: same logic (+3 for 2, +5 for 3+, +3 for primary)
  - Both triage_score and final_score stored in entry JSON

### Build — Railway API Endpoint for Candidates
- New endpoint: `GET /api/pipeline-candidates` — returns triaged candidates for external processing
- Modify `scheduler.js`: after triage, write candidates to `.pipeline-candidates.json` AND expose via API
- This is how Claude Code (or Agent SDK later) reads candidates from Railway

### Test
- End-to-end test: take 3 real candidate URLs → Content Producer → finished entries
- Verify: fabrication agent catches intentionally flawed claims
- Verify: drift detection catches qualifier changes between v1 and v2
- Verify: "needs work" re-entry produces improved output
- Verify: abort gate, error handling, candidate limits all work
- Run full test suite (135+ tests must still pass)
- Run smoke tests (7/7 must still pass)

---

## Session 17: Retrofit Existing Entries

**Goal:** Bring all platform content to consulting quality

### Phase 1: Clean up (immediate)
- Delete from main: dbs-worlds-best-ai-bank (duplicate, 0 confidence)
- Delete from main: arta-ai-chief-of-staff (empty, headline-only)
- Delete from main: betterment-ai-account-recommender (trivial feature, not intelligence)
- Unpublish from main: goldman-sachs-gs-ai-platform (all claims unverified, source 403)
- Unpublish from main: vanguard-generative-ai-client-summaries (four sentences of nothing)
- Consolidate: merge two DBS entries into one properly sourced entry
- Consolidate: review 3 JPMorgan entries — merge overlapping content, keep distinct stories separate

### Phase 2: Reprocess WEAK entries (5 remaining after cleanup)
- For each: run through full Content Producer pipeline (Research → Write → Evaluate → Refine → Fabrication)
- Use existing source_url as starting point for Research Agent
- Replace entry JSON entirely with v2 output
- Entries: HSBC Jade AI, LPL Anthropic partnership, DBS (merged), Robinhood Cortex (verify governance notes), Zocks (has SUSPECT fabrication verdict)

### Phase 3: Upgrade ADEQUATE entries (17 entries)
- For each: run through Evaluator → Writer refinement only (skip research if sources already good)
- Focus: tighten the_so_what, add peer context, upgrade key_stat to decision-grade
- Add key_stat to all 12 entries that currently have null
- Retire Bloomberg terminal analogy where it appears (4+ entries)
- Ensure each entry connects to at least one peer competitor

### Phase 4: Verify STRONG entries (16 entries)
- Run through Fabrication Agent only — verify all claims still current
- Check: are source URLs still live? (some may be 404 after 6 months)
- Check: has the landscape changed since publication? If so, note it but don't change historical facts
- No rewriting unless fabrication issues found

### Quality gate
- After all phases: every entry on the platform must pass the 6-point McKinsey test
- Target: 0 WEAK entries. Period.
- Run content quality audit again — verify improvement

### Push
- All updated entries pushed to main
- Portal rebuilds with upgraded content
- Run smoke tests before pushing

---

## Session 18: Editorial Studio UI

**Goal:** The review experience matches the v2 pipeline output

### Build — Rich Inbox Cards
- Replace current thin card with v2 card showing:
  - Headline + company + type badge + final score + source count
  - Summary (2-3 lines, analytical)
  - "Why It Matters" section (the_so_what)
  - Key Stat with named source
  - Sources list with type badges (primary/coverage/discovery)
- Expandable sections:
  - Research Brief: sources found, landscape context, past entries, what's new
  - Fabrication Report: claims checked, verified, unverified, confidence
  - Iteration History: v1 evaluation → v2 changes → final result
  - Full source list with links

### Build — "Needs Work" Flow
- "Needs Work" button opens text area for editor notes
- Notes stored in entry._editor_notes array
- On submit: entry re-enters Content Producer pipeline (Writer + Fabrication only, using stored _research brief)
- Entry reappears in inbox with updated draft + new iteration in history

### Build — Triage Results Panel
- New section in Editorial Studio: "Discovery & Triage"
- Shows: all candidates from latest pipeline run
  - Triage score, source, headline, why it was blocked/ignored
  - "Process This" button to manually push a candidate through the v2 pipeline
- This is how Haresh spot-checks what the pipeline is catching and missing

### Build — TL Inbox Integration
- TL candidates also show in the rich format (after going through TL Writer pipeline)
- Author name + organization prominently displayed
- "Preserve author voice" indicator
- Cross-TL suggestions shown as "Related reading" links, not merged content

### Test
- End-to-end: candidate → pipeline → inbox card → approve → portal
- Verify: "needs work" flow produces improved entry
- Verify: triage panel shows blocked/ignored candidates with reasons
- Verify: TL entries display correctly with author preservation

### Update — /add-entry Skill
- Update the skill to use the v2 Content Producer (not the old one-shot intake.js flow)
- When you manually add an entry via Claude Code, it goes through the same Research → Write → Evaluate → Fabrication pipeline

---

## Session 19: Landing Page + Go-Live Prep

**Goal:** Push the landing page and prepare for market

### Landing Page
- Unstash changes from feature/landing-page branch
- Apply all feedback from Haresh's review (this session starts with the review)
- Verify: terminology matches app (Intelligence, Landscape, Thought Leadership)
- Verify: sample entries on landing page match the upgraded v2 quality entries on the portal
- Verify: pricing is correct ($4,500 founding / $5,000 standard)
- Verify: all CTAs work (mailto links)
- Push to feature/landing-page → Railway deploys to livingintel.ai

### Portal Quality Check
- Walk through every page on wealth.tigerai.tech:
  - Homepage: lead story, featured grid, all entries
  - Intelligence feed: all entries display correctly, source badges, key stats
  - Each article detail page: summary formatting, sources section, why it matters
  - Landscape: all companies, capability matrix, company profiles
  - Thought Leadership: all entries, author display, insight callouts
- Check: are all logos resolving? Any broken images?
- Check: does the "Updated" date show today?
- Check: do source links work? (No 404s)

### Google Workspace
- Set up hello@livingintel.ai (for "Request Access" emails)
- Configure email forwarding to Haresh's inbox
- Update all mailto links on landing page if needed

### Documentation
- Update docs/architecture.md with v2 pipeline description
- Update docs/agents-and-architecture.md with new agent descriptions
- Update CLAUDE.md content standards to reference McKinsey test
- Update /add-entry skill to reference v2 pipeline
- Update memory files with final session notes

### Verify before going live
- All 135+ unit tests pass
- All 7+ smoke tests pass
- Portal builds successfully
- Landing page builds successfully
- Editorial Studio functions correctly with v2 entries
- No weak entries on the platform

---

## Session 20: Automation + Hardening

**Goal:** Make the pipeline run without manual triggering

### Claude Code Desktop Scheduled Task
- Set up scheduled task in Claude Code Desktop app:
  - Time: 5:30am daily
  - Task: "Fetch pipeline candidates from Railway, process top 5 through v2 pipeline, write to inbox"
  - Allowed tools: WebFetch, Read, Write, Edit, Bash
- Test: trigger manually, verify full pipeline executes
- Set up Mac Energy Saver: prevent sleep, or use caffeinate

### Railway API Endpoint
- Verify: `GET /api/pipeline-candidates` returns triaged candidates
- Verify: Claude Code Desktop task can read from this endpoint
- Verify: results are written correctly to .governance-pending.json

### Error Handling + Fallback
- If Claude Code Desktop task fails → candidates queue for next day
- If Mac is off → same, candidates queue
- Add: pipeline status indicator in Editorial Studio showing last successful v2 run
- Add: email/Telegram notification if v2 pipeline hasn't run in 24 hours
- Fallback: if v2 is consistently failing, the v1 pipeline (current) still runs on Railway and still produces entries (lower quality but not zero)

### Monitoring
- Track: entries per day through v2 pipeline
- Track: average final score of v2 entries vs v1 entries
- Track: fabrication agent rejection rate
- Track: evaluator pass rate on first iteration vs needs refinement
- Pipeline status dashboard in Editorial Studio

### Future-Proofing
- Document: how to migrate to Agent SDK (Phase 3) when scaling
- Document: how to add a new vertical (same pipeline, different landscape data)
- Document: how to add new capability dimensions to the landscape

---

## Summary

| Session | Duration | What Gets Built | Key Output |
|---------|----------|----------------|------------|
| 14 | 1 session | Research Agent + v2 data model | 5 tested research briefs |
| 15 | 1 session | Writer Agent + Evaluator Agent + TL Writer | Side-by-side quality comparison |
| 16 | 1 session | Fabrication Agent + Content Producer + API endpoint | End-to-end pipeline working |
| 17 | 1-2 sessions | Retrofit all 43 entries | 0 WEAK entries on platform |
| 18 | 1 session | Editorial Studio UI + triage panel + /add-entry update | Full review experience |
| 19 | 1 session | Landing page + portal check + Google Workspace + docs | Ready for market |
| 20 | 1 session | Automation + monitoring + hardening | Pipeline runs daily without manual trigger |

**Total: 7-8 sessions**

### What runs throughout (every session)
- Existing v1 pipeline continues running at 5am (discovery + triage + current processing)
- Unit tests: 135+ must pass at all times
- Smoke tests: 7+ must pass at all times
- Memory/docs updated after every session (enforced by hooks)
- All changes on intake branch, pushed after tests pass
- Portal changes on main branch, pushed after build passes
