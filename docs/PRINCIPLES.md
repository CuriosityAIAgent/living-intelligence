# Engineering & AI Agent Principles — Living Intelligence

These principles were learned building this platform over 17 sessions. They're not theoretical — every one comes from a real mistake or a real success.

---

## 1. Plan Thoroughly Before Building

**Write the plan. Document it. Get validation. Then build.**

A 30-minute plan saves 3 hours of rework. The landscape v2 pipeline was built twice — first as an ad-hoc script (killed), then properly after writing a detailed architecture plan. The intelligence v2 pipeline succeeded because Sessions 14-16 each had a clear plan before any code was written.

**What a plan must include:**
- What are we building and why?
- What agents/components are needed?
- What is the data flow?
- What are the quality criteria?
- What is the iteration process?
- How will we test?
- What does "done" look like?

**Anti-pattern:** "I'll just start coding and figure it out." No. Write it down.

---

## 2. Research Comprehensively — Use ALL Available Sources

**Never write from a single source. Always use the full research content, not a shortened version.**

The intelligence v2 quality breakthrough came from the Research Agent gathering 5-10 sources per entry, then the Writer Agent working from the FULL source text — every word available for verification. Compressed summaries lose nuance. The exact wording matters.

**Research process for any content:**
1. Gather primary sources (company newsroom, press releases, SEC filings)
2. Gather secondary sources (trade press, analyst coverage, industry reports)
3. WebSearch for additional coverage not found by automated tools
4. WebFetch key pages to extract specific metrics
5. Read our own intelligence entries about the subject
6. Load peer/competitor data for context
7. Only then start writing — with ALL sources in front of you

**Anti-pattern:** Writing from a single article or a compressed brief. Always go back to the full source.

---

## 3. Build Multi-Agent Pipelines With Clear Roles

**Each agent has one job. The orchestrator connects them.**

| Agent Role | What it does | Why it's separate |
|-----------|-------------|-------------------|
| Research Agent | Gathers ALL available information | Research quality determines everything downstream |
| Writer Agent | Produces the draft from research | Writing benefits from a persona (McKinsey partner) |
| Evaluator Agent | Checks quality against criteria | Self-evaluation catches issues the writer misses |
| Fabrication Agent | Verifies claims against sources | Prevents hallucination — the existential risk |
| Producer/Orchestrator | Connects agents, manages iteration | Keeps the pipeline clean and retryable |

**Key insight:** The Writer should work from the FULL research output, not a summary. Context compression kills quality. With 200K-1M context windows, there's no reason to compress.

---

## 4. Always Iterate — Write, Evaluate, Refine

**The iteration loop IS the quality. Never skip it.**

Intelligence v2 showed scores improving from 7/10 to 9/10 between v1 and v2 drafts. The evaluator identifies specific failures. The writer fixes them with targeted feedback. This isn't overhead — it's the mechanism that produces premium quality.

**The loop:**
```
Write v1 → Evaluate against quality criteria → Identify failures
  → If all pass: done
  → If any fail: feed specific feedback to writer → Write v2 → Re-evaluate
  → Max 2 iterations (diminishing returns after that)
```

**Track iterations in metadata.** Store v1 score, v2 score, which checks failed, what was fixed. This creates an audit trail and helps tune the quality criteria over time.

**Anti-pattern:** Single-pass writing. "It looks good enough." It's not — evaluate it.

---

## 5. Build Scoring Models to Measure and Improve

**If you can't score it, you can't improve it.**

### Intelligence Scoring (5 dimensions, 0-100)
| Dimension | Max | What it measures |
|-----------|-----|-----------------|
| Source Quality | 25 | Domain authority, credibility |
| Claim Verification | 25 | How many claims verified vs fabricated |
| Freshness | 10 | How recent the information is |
| Capability Impact | 40 | Which AI capability is advancing, at what scale |
| CXO Relevance | 10 | Would a C-suite exec act on this? |

### Landscape Quality (6-check McKinsey Test)
1. **Strategy depth** — ≥400 chars, names ≥2 peers with specific metrics
2. **Capability coverage** — all 7 dimensions assessed (including no_activity)
3. **Evidence sourced** — every claim traces to a named source
4. **Maturity justified** — correct level backed by evidence
5. **Competitive context** — positioned relative to named peers
6. **Decision grade** — would a Head of AI at a competing firm learn something new?

**Key insight:** Scoring models make quality objective. Instead of "does this look good?" you ask "does this pass all 6 checks?" Subjectivity kills consistency.

**Evolve the scoring.** When entries consistently pass all checks but still feel weak, add a new check. The scoring model should get stricter over time, not softer.

---

## 6. Verify Everything — Zero Tolerance for Fabrication

**Never write a claim you haven't personally read in the source during this session.**

This is the prime directive. A single fabricated statistic in a CEO presentation destroys the platform's credibility. The cost of verification is minutes. The cost of a miss is the business.

**Verification rules:**
- WebFetch every source URL before citing it
- Every source URL must return HTTP 200 — no 404s, no broken links
- Every metric must trace to a specific source with exact location (slide number, paragraph, quote)
- If you can't verify a claim, omit it. A shorter, fully verified entry beats a longer one with one fabricated number.
- `source_verified: true` only if fetched and read this session

---

## 7. Test Comprehensively Before Shipping

**"Done" means tested, not committed.**

| What you changed | How to verify |
|-----------------|---------------|
| Portal code (app/, components/, lib/) | `npx next build` — must pass |
| Agent code (intake-server/agents/) | `node --check` + unit tests + smoke tests |
| Data files (data/) | Smoke tests (`node scripts/smoke-test.js`) |
| New external API | Make a real API call before committing |
| Any batch data change | `node scripts/test-portal.js` |

**Anti-pattern:** Running syntax checks and calling it tested. Syntax checks catch typos. They don't catch wrong logic, broken integrations, or bad data.

**For AI agent pipelines:** Test on 3 diverse inputs before batch processing. The intelligence pipeline was tested on BofA (wirehouse), Jump (advisor tool), and a generic article before running all 43 entries. The landscape pipeline was tested on DBS (regional champion), Morgan Stanley (wirehouse), and Jump AI (advisor tool) before the full batch.

---

## 8. Use the Right Tool for the Job

**Max subscription for quality. API for automation. WebSearch for research.**

| Need | Tool | Why |
|------|------|-----|
| Consulting-quality writing | Claude Code Max (Opus 4.6) | Full context window, best quality, zero marginal cost |
| Automated daily pipeline | Anthropic API (Sonnet) | Runs on server, no human needed, cost-controlled |
| Web research | WebSearch + WebFetch | Finds sources the automated pipeline misses |
| Source extraction | Jina Reader (r.jina.ai) | Cleans HTML, handles paywalls |
| Bulk search | DataForSEO / NewsAPI.ai | Scale discovery across thousands of sources |

**Anti-pattern:** Using API calls when Max subscription produces better output. Using a single search tool when combining 3-4 tools produces richer research.

---

## 9. Document As You Build — Not After

**The commit should include its documentation update.**

Every time code changes, the relevant doc changes too. Not later. Not when reminded. Not in a separate commit. Together.

| You changed | Update these |
|---|---|
| Agent code | `docs/agents-and-architecture.md` |
| External API | `docs/integrations.md` |
| Data counts | `docs/architecture.md` + memory files |
| Pipeline flow | `docs/integrations.md` + `docs/architecture.md` |
| Anything significant | Memory files: `project_living_intelligence.md`, `project_roadmap.md` |

**Enforcement:** The `enforce-doc-updates.sh` hook blocks commits that change agent code without staging doc files.

---

## 10. Every "No Activity" Is Intelligence

**Knowing what a competitor is NOT doing is as valuable as knowing what they ARE doing.**

When assessing a company and finding no evidence of AI in a capability area, don't just mark it empty. Write:
- **What** they're not doing (specifically)
- **Why** it matters competitively (what peers ARE doing in that space)
- **What** the strategic implication is (gap, risk, or deliberate choice)

Example: "Despite €239B in group AUM, ABN AMRO has disclosed no AI capabilities in portfolio construction. This is a material gap: RBC's ATOM model shapes recommendations for 2,200 advisors, and DBS embeds investment nudges in 45M monthly interactions."

A Head of AI reading this learns where the competitor has a blind spot they could exploit. That's worth $5,000/year.

---

## How These Principles Were Learned

| Principle | Session it came from | What triggered it |
|-----------|---------------------|-------------------|
| Plan before building | Session 17b | Jumped into landscape batch without a plan; had to restart |
| Research comprehensively | Sessions 14-16 | Intelligence v2 quality came from 5-10 sources, not 1 |
| Multi-agent pipelines | Sessions 14-16 | Separating research/write/evaluate/fabricate produced consulting quality |
| Always iterate | Sessions 15-17 | v1→v2 improved scores from 7 to 9 consistently |
| Scoring models | Session 10 | Scorer.js made publish/review/block decisions objective |
| Zero fabrication | Session 5 | JPMorgan entry had unverified claims. Trust was at risk. |
| Test before shipping | Session 10 | Pushed broken build to production without running `next build` |
| Right tool for job | Session 17b | Used API calls when Max subscription produced better output |
| Document as you build | Sessions 10-12 | Docs fell behind repeatedly; user had to remind every time |
| No activity = intelligence | Session 17b | Landscape profiles with honest gaps are more useful than vague positives |
