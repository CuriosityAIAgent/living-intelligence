# Pipeline v2 — Architecture Review & Honest Assessment

## What the Research Revealed

### Claude Code CLI (-p mode)
- **Works** for non-interactive multi-step workflows
- **Skills DON'T work** in -p mode — can't use `/process-candidates`
- WebFetch works but complex API calls (with auth headers) need Bash + curl
- 200K context with auto-compaction — plenty of room
- No session persistence — each `-p` call starts fresh
- No daemon mode — synchronous, one-shot

### Claude Code Desktop
- Can schedule recurring tasks (minimum 1-minute interval)
- Has access to local files and MCP tools
- Mac must be on
- More reliable than CLI cron for recurring work

### Claude Agent SDK
- Purpose-built for autonomous server-side workflows
- Full tool support, session management, custom tools
- Can run on Railway or any server — **no Mac dependency**
- Uses API tokens (not Max plan)
- Most robust and scalable option

### Cloud Scheduled Tasks
- Run on Anthropic infrastructure
- Minimum 1-hour interval
- Fresh repo clone only — no access to Railway's persistent volume
- Good for simple, periodic tasks

---

## Honest Problems With the Current Plan

### Problem 1: The hybrid approach is fragile
Railway → Mac handoff introduces a dependency chain: Railway must complete discovery, write candidates to an accessible location, Mac must be awake, Claude Code must start, complete the full pipeline, and write results back to somewhere the Editorial Studio can read. Any link in this chain fails = no entries that day.

### Problem 2: Skills don't work in -p mode
The plan proposed a `/process-candidates` skill. That won't work. We'd need to describe the entire workflow in the prompt string, which is less reliable and harder to maintain than a skill file.

### Problem 3: Opus vs Sonnet matters for quality
The whole point of this pipeline is consulting-firm quality. Sonnet 4.6 (what the current pipeline uses) produces the 37% STRONG / 40% ADEQUATE / 23% WEAK split we audited. For the Writer and Evaluator agents, Opus 4.6 would produce significantly better analytical writing. Via API, Opus costs ~5x more than Sonnet ($15/M input vs $3/M). Via Max plan (Claude Code), Opus is included at no extra cost. This is a real argument for keeping content production on Claude Code — but only if the execution is reliable.

### Problem 4: Context compression = quality loss
The plan proposed sending compressed "source facts" to the Fabrication Agent to save context. But compressed facts lose nuance — the exact wording matters for fabrication detection. If we send "BofA deployed AI meeting tool, 4 hours saved" instead of the full paragraph that says "potentially saving up to 4 hours per client meeting," the fabrication agent can't catch the "potentially" qualifier being dropped. Full source context produces better verification.

With Opus 4.6's 200K context (or 1M on the model we're using right now), context isn't the constraint. Processing 10 articles at 2,000 words each = 20,000 words = ~25K tokens. That's 12% of even the 200K window. **We should send full source text, not compressed facts.**

---

## Three Realistic Architecture Options

### Option A: Manual-First (Recommended to start)

```
5:00 AM — Railway cron: discovery + triage (existing)
  ↓
Candidates written to .pipeline-candidates.json
Pushed to intake branch via git
  ↓
WHEN HARESH IS READY — opens Claude Code interactively
  ↓
"Process today's candidates" — runs pipeline in conversation
Research → Write (Opus) → Evaluate → Refine → Fabrication → Final
  ↓
Finished entries written to inbox
  ↓
Reviews in Editorial Studio, approves
```

**Pros:**
- Zero new infrastructure
- Uses Opus via Max plan (best quality, zero cost)
- Full context window (1M on current model)
- You see each entry being built, can intervene mid-pipeline
- Works TODAY — no automation to build

**Cons:**
- Not fully automated — you trigger the processing
- Adds 15-20 minutes to your morning routine
- Depends on you being available

**When to use:** Phase 1. While we build and validate the agents. This could be the permanent model if the quality justifies the time.

### Option B: Claude Code Desktop Scheduled Tasks

```
5:00 AM — Railway cron: discovery + triage
  ↓
5:30 AM — Claude Code Desktop: scheduled task
  "Fetch candidates from intake API, process through v2 pipeline"
  Uses Max tokens, Opus model
  ↓
6:00 AM — Finished entries in inbox
  ↓
Haresh reviews when ready
```

**Pros:**
- Automated daily
- Uses Max tokens + Opus (best quality, zero API cost)
- Claude Code Desktop has MCP and full tool access
- More reliable than CLI cron

**Cons:**
- Mac must be on and awake at 5:30am
- If Mac is off, candidates queue (not lost, just delayed)
- Desktop app must be running

**When to use:** Phase 2. After agents are validated and the pipeline is proven.

### Option C: Agent SDK on Server

```
5:00 AM — Railway cron: discovery + triage
  ↓
5:05 AM — Agent SDK (Python) on Railway: full v2 pipeline
  Runs as a server process, uses API tokens
  Opus 4.6 for Writer, Sonnet 4.6 for Fabrication (cost optimization)
  ↓
5:30 AM — Finished entries in inbox
  ↓
Haresh reviews when ready
```

**Pros:**
- Fully automated, no Mac dependency
- Always-on, never misses a day
- Most scalable (add more verticals, more entries)
- Professional infrastructure

**Cons:**
- Uses API tokens (~$150-200/month with Opus for Writer)
- More complex to build (Python/TS orchestrator)
- Need to manage API costs carefully

**When to use:** Phase 3. When the product has paying customers and reliability matters more than cost.

---

## The Recommended Phased Approach

### Phase 1: Build + Validate (2-3 weeks)
**Architecture: Manual-first (Option A)**

Build the four agents (Research, Writer, Evaluator, Fabrication) as Node.js modules in `intake-server/agents/`. Test them by running entries through the pipeline in interactive Claude Code sessions. This is where we spend the time getting the prompts right, the quality right, the fabrication checking right.

During this phase:
- Retrofit all 43 existing entries through the new pipeline
- Validate: do the entries actually pass the McKinsey test?
- Tune: adjust prompts, iteration logic, evaluation criteria
- Measure: what's the quality improvement? Is it worth the complexity?

**No automation infrastructure. No scheduled tasks. Just quality.**

### Phase 2: Automate (1 week)
**Architecture: Claude Code Desktop Scheduled Tasks (Option B)**

Once the agents are proven and the prompts are locked:
- Set up Claude Code Desktop scheduled task for 5:30am
- Railway exposes `/api/pipeline-candidates` for the task to read
- Task runs the pipeline, writes results to inbox
- Mac must be on — use Energy Saver settings

### Phase 3: Scale (when needed)
**Architecture: Agent SDK on Server (Option C)**

When you have 10+ paying customers and reliability is critical:
- Migrate the pipeline to Agent SDK (Python)
- Deploy on Railway alongside the existing server
- Use API tokens (cost is trivial against subscription revenue)
- Opus for Writer, Sonnet for Fabrication (cost optimization)

---

## The Model Question: Opus vs Sonnet

| Agent | Recommended Model | Why |
|-------|------------------|-----|
| Research Agent | Sonnet 4.6 | Entity extraction and search orchestration — Sonnet is fine |
| Writer Agent | **Opus 4.6** | This is the consulting-quality writing. Opus produces significantly better analytical prose, sharper the_so_what, more nuanced competitive context |
| Evaluator Agent | **Opus 4.6** | Needs to judge quality at the McKinsey standard — needs the best judgment |
| Fabrication Agent | Sonnet 4.6 | Fact-checking is precise but not creative — Sonnet is accurate enough |

**In Phase 1 (Claude Code interactive):** Everything runs on Opus 4.6 via Max plan. Zero cost. Best quality.

**In Phase 2 (Desktop scheduled):** Same — Max plan covers Opus.

**In Phase 3 (Agent SDK):** Opus for Writer + Evaluator (~$0.30/entry), Sonnet for Research + Fabrication (~$0.15/entry). Total ~$0.45/entry = ~$40/month at 3/day.

---

## The Context Question: Full Text vs Compressed

**Send full source text. Don't compress.**

The quality argument: a Writer Agent writing from compressed "key facts" produces summaries that sound like summaries. A Writer Agent reading the full 2,000-word article can:
- Pick up the tone and framing of the original
- Catch qualifiers ("potentially," "up to," "in select markets")
- Find the quote that matters (buried in paragraph 8, not in the headline)
- Understand what the article DIDN'T say (sometimes the omission is the insight)

The fabrication argument: compressed facts lose the exact wording. "4 hours saved per meeting" vs "potentially saving up to 4 hours per client meeting" — the fabrication agent needs the full text to catch the qualifier being dropped.

The context math: 10 sources × 2,000 words = 20,000 words ≈ 25K tokens. Even with Opus 4.6's 200K context, that's 12.5%. With the 1M context model we're on right now, it's 2.5%. **Context is not the constraint. Quality is.**

---

## What Changed From the Original Plan

| Original Plan | Updated Plan | Why |
|--------------|-------------|-----|
| Build automation first | Build agents first, automate later | Quality validation before infrastructure |
| Claude Code CLI cron | Phase 1 manual, Phase 2 Desktop scheduled | CLI skills don't work in -p mode |
| Sonnet for everything | Opus for Writer + Evaluator | Premium quality is the whole point |
| Compressed source facts | Full source text | Quality and fabrication accuracy |
| 6 sprints, 15-20 days | Phase 1 (agents + retrofit): 2-3 weeks | Focus on the hard part first |
| All automation in Sprint 3 | Automation deferred to Phase 2 | Prove quality before automating |

---

## Updated Sprint Plan (Phase 1 Only)

### Sprint 1: Research Agent (3-4 days)
- `agents/research-agent.js`
- Entity extraction from primary source
- Multi-source search (entity-based queries via Jina + DFS + NewsAPI)
- Landscape context loading (company file + peers)
- Past entries loading
- "What's new" determination
- Abort gate: if research confidence is "low" and sources < 2, park the candidate
- Output: Research Brief JSON with full source texts
- Test: run 5 candidates through, verify brief quality

### Sprint 2: Writer + Evaluator Agents (3-4 days)
- `agents/writer-agent.js` — Opus-optimized consulting persona prompt
- `agents/evaluator-agent.js` — McKinsey Test checklist
- Separate TL Writer prompt (preserve author's voice)
- 2-iteration loop: Write → Evaluate → Refine → Evaluate
- Early exit: if iteration 1 passes all 6 McKinsey checks, skip to fabrication
- Test: run 5 research briefs through, compare output to current entries

### Sprint 3: Fabrication Agent Enhancement (2-3 days)
- Enhance `agents/fabrication-strict.js` for multi-source verification
- Full source text input (not compressed)
- Drift detection: flag claims in v2 not in v1 and not in any source
- Cross-source conflict detection
- the_so_what exemption: editorial insight is allowed, but factual claims within it must be sourced
- Test: feed it intentionally flawed entries, verify it catches them

### Sprint 4: Content Producer Orchestrator (2-3 days)
- `agents/content-producer.js` — orchestrates Research → Write → Evaluate → Refine → Fabrication → Score
- Two-stage scoring (triage score preserved, final score computed)
- Stores `_research`, `_fabrication`, `_iterations` in entry JSON
- "Needs work" flow: takes editor notes, re-runs Writer with feedback
- Test: end-to-end on 3 real candidates

### Sprint 5: Retrofit Existing Entries (3-5 days)
- Delete 3, unpublish 2
- Run remaining weak entries through full pipeline
- Run adequate entries through Evaluator + Writer refinement
- Verify strong entries through Fabrication check
- Target: 0 WEAK entries, all pass McKinsey test
- Push upgraded entries to main

### Sprint 6: Editorial Studio UI (2-3 days)
- Rich inbox card with research brief, fabrication report, iteration history
- "Needs work" button with notes field
- Triage results panel (what was discovered, what was ignored, why)
- Final score display (distinct from triage score)

**Total Phase 1: ~15-22 days**

Phase 2 (automation via Desktop scheduled tasks) follows only after Phase 1 is validated and the platform quality is where it needs to be.
