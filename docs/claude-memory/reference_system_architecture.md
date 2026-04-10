---
name: Living Intelligence — Complete System Architecture
description: The full four-layer system: CLAUDE.md, Memory, Skills, Hooks. What each layer owns, how they interact, what belongs where. Reference before every session and before starting any new vertical.
type: reference
---

# Living Intelligence — Complete System Architecture
**Last updated: 2026-04-05 (Session 20 — v2 pipeline architecture planned)**

---

## The Four-Layer System

```
CLAUDE.md    → KNOW    (architecture, schema, brand, environment — what the system IS)
Memory       → REMEMBER (project state, roadmap, preferences, WHY decisions were made)
Skills       → DO      (complete step-by-step workflows — how every content action works)
Hooks        → BLOCK   (deterministic guardrails — things that cannot happen regardless)
```

**The cardinal rule:** Each layer has one job. Nothing should be in two layers. When a workflow procedure appears in CLAUDE.md or memory, it belongs in a skill. When a rule is being violated repeatedly, it belongs in a hook.

---

## Layer 1 — CLAUDE.md

**Location:** `/Users/haresh/Desktop/Living Intelligence/living-intelligence/CLAUDE.md`
**Loaded:** Automatically every session
**Purpose:** Knowledge — what the system is, how it's structured, hard constraints

**What it contains:**
| Section | Purpose |
|---------|---------|
| Skills map | WHEN to invoke which skill — the routing table |
| Content Standards | ONE principle (Prime Directive) + pointer to skills. No procedure. |
| Documentation Maintenance | What docs to update when code changes |
| Environment | Ports, node version, git commands, Railway services |
| Critical Rules | Hard constraints (no database, Tailwind only, no external logo URLs) |
| Brand | Exact tokens (#990F3D claret, #1C1C2E dark slate, header structure) |
| Code Style | TypeScript strict, Tailwind, Server Components, async/await |
| Data Schema | Where files live (data/intelligence/, data/competitors/, etc.) |
| Segments | Classification rules for the 7 landscape segments |
| Maturity Levels | Definitions of scaled/deployed/piloting/announced/no_activity |
| Governance | What PASS/REVIEW/FAIL means, the _governance block structure |
| Scripts | What each script does and when to run it |

**What it must NOT contain:** Step-by-step procedures, workflow rules, how-to guides. Those belong in skills.

**Budget:** Keep under ~60 lines of actual instructions (not counting tables, code blocks, whitespace). Past that, compliance degrades.

---

## Layer 2 — Memory Files

**Location:** `~/.claude/projects/-Users-haresh/memory/`
**Loaded:** MEMORY.md loads automatically. Individual files read when relevant.
**Purpose:** Context and principles — project state, the WHY behind decisions, user preferences

**Index (MEMORY.md):**
Always loaded. Contains: session summaries, skills trigger map, key project facts, links to all other memory files.

**Full file list:**

| File | Contains |
|------|---------|
| `MEMORY.md` | Index + skills trigger map + session summaries |
| `project_roadmap.md` | All pending work, completed work, sequence. Updated every session. |
| `project_living_intelligence.md` | Architecture decisions, data counts, verified entries, Railway config |
| `project_content_pipeline_v2.md` | v2 multi-agent pipeline: Research → Write → Evaluate → Fabrication. Decisions, architecture, phased approach. |
| `project_landscape_enrichment.md` | Plan + status for v2 treatment of all 37 landscape profiles. |
| `project_knowledge_base.md` | KB architecture: Supabase + pgvector, 5 tables, backfill plan, v2 pipeline integration. PLANNED, not built. |
| `project_pricing_positioning.md` | B2B pricing ($4,500/$5,000), stealth distribution, sales strategy |
| `project_landscape_enrichment.md` | Plan for v2 treatment of 37 company profiles. Next priority. |
| `reference_system_architecture.md` | THIS FILE — the complete system map |
| `feedback_working_style.md` | How Haresh works, tone, response style, urgency, skills-first rule |
| `feedback_content_quality.md` | WHY content standards exist — incidents. NOT the procedure (that's in skills). |
| `feedback_editorial_standard.md` | Three-layer framework, the_so_what examples. NOT procedure. |
| `feedback_session_insights.md` | Concrete mistakes from real sessions. The feedback loop. Review at session start. |
| `feedback_context_saves.md` | When and how to save memory during sessions |
| `retrospective_living_intelligence.md` | Sessions 1-7 retrospective. Reference before starting new vertical. |
| `research_pricing.md` | B2B pricing research: AlphaSense, CB Insights, Gartner comparisons |
| `research_distribution.md` | Distribution research: LinkedIn, cold email, sales stack for solo founder |

**What memory must NOT contain:** Step-by-step procedures or how-to workflows. Those belong in skills. Memory keeps the WHY; skills keep the HOW.

---

## Layer 3 — Skills

**Purpose:** Complete, self-contained workflows for every content action. Read the skill file, follow every step. No improvising.

**Project-level skills** (available when working in the intake-server directory):
**Location:** `intake-server/.claude/skills/`

| Skill | Invoke when | What it enforces |
|-------|------------|-----------------|
| `add-entry.md` | Adding any intelligence entry | **v2 pipeline:** Research Agent (multi-source) → Writer Agent (Opus, McKinsey voice) → Evaluator (6-check test) → Fabrication → confirm → commit. **Automated v2 (planned):** Tier 1 gathers research brief, Tier 2 runs full write/evaluate/refine loop. |
| `add-company.md` | Adding a landscape company | Research all 7 capability dimensions with evidence → maturity rules (press release ≠ deployed) → logo check → confirm → commit |
| `add-tl.md` | Adding thought leadership | Verbatim quotes only → institutional quality gate → attribution → confirm each quote → commit to main |
| `catchup.md` | Start of every session | Roadmap → Railway health → inbox count → alerts → orient |
| `audit.md` | Content quality check | test-portal.js → entry audit → landscape maturity check → TL quote check → count reconciliation → fix or defer |

**User-level skills** (available across all projects):
**Location:** `~/.claude/skills/`

| Skill | Invoke when | What it enforces |
|-------|------------|-----------------|
| `new-vertical.md` | Starting any new industry vertical | Full setup: capability dimensions → segments → companies → CLAUDE.md → memory files → hooks → seed content → Railway deploy |

**The skill contract:**
- Skills are the source of truth for HOW to do work
- Skills are self-contained — following a skill should not require consulting CLAUDE.md or memory mid-task
- Skills are updated when workflows change — not CLAUDE.md, not memory
- Never improvise a workflow that has a skill — invoke the skill

**Trigger wiring** (three places tell Claude to use skills):
1. CLAUDE.md Skills section — loaded every session
2. MEMORY.md skills trigger table — loaded every session
3. `feedback_working_style.md` hard rule — always use skills for content actions

---

## Layer 4 — Hooks

**Purpose:** Deterministic guardrails. These fire at the tool level — they cannot be ignored, forgotten, or overridden by context loss.

**Global hooks** (`~/.claude/settings.json` + `~/.claude/hooks/`):

| Hook | Script/Type | Event | Effect |
|------|-------------|-------|--------|
| Push to main (allowed) | `check-push-main.sh` | PreToolUse Bash | Allows all pushes (portal UI changes go to `main`). |
| Pre-commit checks | `pre-commit-checks.sh` | PreToolUse Bash | Blocks `git commit` if staged .js fail `node --check` or .ts/.tsx fail `tsc --noEmit` |
| **Enforce doc updates** | `enforce-doc-updates.sh` | PreToolUse Bash | **BLOCKS** `git commit` if agent/pipeline code staged without docs/ files. Not advisory — blocks. |
| Pre-push tests | `pre-push-tests.sh` | PreToolUse Bash | Runs 135 tests before `git push intake`. Next build for main. |
| **Enforce memory on push** | `enforce-memory-on-push.sh` | PreToolUse Bash | **BLOCKS** `git push` if memory files (MEMORY.md, project_roadmap.md, project_living_intelligence.md) are older than last commit. |
| Post-commit memory reminder | `post-commit-memory-reminder.sh` | PostToolUse Bash | After every `git commit`, injects mandatory context: "UPDATE MEMORY NOW." |
| Banned URL guard | `check-banned-urls.sh` | PostToolUse Write\|Edit | Alerts if clearbit/unavatar URLs written to `data/*.json` |
| **Compact reminder** | `compact-reminder.sh` | PostToolUse Write\|Edit | Counts edits. Every 40, fires reminder to compact and save memory. |
| AI patterns check | `check-ai-patterns.sh` | PostToolUse Write\|Edit | Fast shell script (replaced slow prompt hook). Only checks data content files. |
| Stale docs check | Prompt hook | Stop | Checks if roadmap, memory, skills, CLAUDE.md need updating before session ends. |
| Session audit | `session-start-audit.sh` | SessionStart | Runs smoke tests + checks if docs are stale vs code. Reports findings before any work begins. |
| PreCompact save | Command hook | PreCompact | Reminds to save memory files before context compaction. |

**Project hooks** (`intake-server/.claude/settings.local.json` + `intake-server/.claude/hooks/`):

| Hook | Script | Event | Effect |
|------|--------|-------|--------|
| Node syntax check | `node-syntax-check.sh` | PostToolUse Write\|Edit | Alerts on .js syntax errors after file write |
| TypeScript check | `tsc-check.sh` | PostToolUse Write\|Edit | Alerts on .ts/.tsx type errors after file write |

**Skills** (`~/.claude/skills/`):

| Skill | Location | Purpose |
|-------|----------|---------|
| Humanizer | `~/.claude/skills/humanizer/SKILL.md` | `/humanizer` — removes AI writing patterns from text |

**Hook principle:** If a rule has been violated more than once despite being in memory or CLAUDE.md, it becomes a hook.

---

## How the Layers Interact — A Worked Example

**Trigger:** "Add this Goldman article to the feed"

```
1. MEMORY.md loads → skills trigger table says: "add this article" → /add-entry
2. CLAUDE.md loads → Skills section says: Adding an intelligence entry → /add-entry
3. Claude reads intake-server/.claude/skills/add-entry.md
4. Step 2 of skill: WebFetch the URL — mandatory, cannot skip
5. Step 3: extract claims with exact source locations
6. Step 5: write JSON following exact schema (including the_so_what)
7. Step 6: read key stat back to Haresh, wait for confirmation
8. Step 7: git add + git commit
   → pre-commit hook fires: runs node --check on staged .js files
   → if errors: commit blocked until fixed
9. Step 7: git push origin intake
   → push-to-main hook fires: checks target branch is not main ✓ passes
10. Step 8: update memory counts
```

**No step relies on Claude's memory of what to do.** The trigger is in memory, the workflow is in the skill, the guardrails are in hooks.

---

## Failure Mode Analysis

| Failure mode | Prevented by |
|---|---|
| Fabricated claim in entry | `/add-entry` skill Step 2 (mandatory WebFetch) + Step 6 (confirm key stat) |
| Wrong maturity rating on landscape | `/add-company` skill Step 3 (maturity rules + evidence required) |
| Fabricated quote in TL entry | `/add-tl` skill Step 3 (verbatim quotes only) + Step 6 (confirm each quote) |
| Push broken code to production | pre-commit hook (blocks on syntax/type errors) + push-to-main hook (blocks main) |
| Clearbit/unavatar URL in data file | banned-URL hook (fires immediately on write) |
| Stale roadmap at session end | PreCompact hook (fires before context compaction) |
| Ad-hoc workflow skipping verification | CLAUDE.md + MEMORY.md + feedback_working_style all point to skills |
| Context loss causing workflow degradation | Skills are files — read fresh each invocation, not recalled from compressed context |

---

## For New Verticals

Before session 1 of any new vertical, this system needs to be replicated:

1. Run `/new-vertical` skill — it walks through the full setup
2. The four-layer system is vertical-agnostic. Only the content changes:
   - CLAUDE.md: update capability dimensions, segments, audience framing
   - Memory: new project files, new roadmap
   - Skills: copy all 6, update paths and vertical-specific rules
   - Hooks: copy all 5, update paths

**The skills, hooks, and memory structure are the factory. Content is just configuration.**

---

## V2 Pipeline Architecture (Planned — Session 20)

**Two-tier design** separating automated discovery from consulting-quality enrichment:

### Tier 1 — Automated (5:00am, Node.js server on Railway)
```
Discovery (DFS + NewsAPI.ai + Jina) → research-agent.js (multi-source gathering)
→ triage score (Sonnet) → BLOCK/REVIEW/ENRICH decision
→ ENRICH candidates saved as research briefs to /data/.v2-research/
```

### Tier 2 — Claude Code Max (5:45am or manual trigger, 1M context)
```
Load research briefs → writer-agent.js (Opus, consulting persona)
→ evaluator-agent.js (6-check McKinsey test) → refine if NEEDS_WORK (2 iterations max)
→ fabrication check → final score → rich inbox card
```

### Implementation Phases
1. **Phase 1:** Build `research-agent.js` — multi-source gatherer using existing Jina/DFS/NewsAPI APIs
2. **Phase 2:** Build `content-producer.js` — orchestrator wiring research → write → evaluate → refine → fabrication → score
3. **Phase 3:** Integrate into `scheduler.js` — Tier 1 saves briefs, Tier 2 triggered separately
4. **Phase 4:** Editorial Studio rich cards — show evaluator checks, iteration count, quality score

### Cost Model (Hybrid — recommended)
- Tier 1: Sonnet via API (~$1/day for research + triage)
- Tier 2: Claude Code Max subscription (Opus, 1M context, $0 marginal cost)
- Existing agents ready: `writer-agent.js` (Opus), `evaluator-agent.js` (Opus) — built sessions 15-16
- Still to build: `research-agent.js`, `content-producer.js`

---

## Layer 5 — Shared Config (`config.js`)

**Location:** `intake-server/agents/config.js`
**Purpose:** Single source of truth for all paths, thresholds, and constants.

Every agent imports from config.js. No agent defines its own paths or thresholds.

**What it contains:**
- Content paths (repo-relative): `INTEL_DIR`, `COMPETITORS_DIR`, `TL_DIR`, `CAPABILITIES_DIR`, `LOGOS_DIR`
- State path (Railway volume): `STATE_DIR`
- Scoring thresholds: `PUBLISH: 75`, `REVIEW: 45`, `BLOCK: 45`, `FRESHNESS_LIMIT: 90`
- Source classification: `PRESS_RELEASE_DOMAINS`, `TIER1_MEDIA`, `PAYWALLED_DOMAINS`, `NEVER_PAYWALLED`
- Model config: `MODEL`, `SOURCE_WINDOW`, `THIN_CONTENT_THRESHOLD`

**Rule:** When a threshold or path changes, change it in config.js. Not in the agent.

---

## Development Process

```
1. THINK   — What are we changing and why?
2. TEST    — Write the test that defines "working"
3. CODE    — Write the code that passes the test
4. VERIFY  — Run unit tests (119) + smoke test (7)
5. LOCAL   — Start local server, check it works
6. COMMIT  — Pre-commit hook validates syntax/types
7. PUSH    — Pre-push hook runs tests. Push to GitHub.
8. DEPLOY  — Railway auto-deploys. Check live service.
```

**No code ships without a test for the change.**

**Test commands:**
```bash
node intake-server/scripts/run-tests.js    # 135 unit tests (15 suites)
node intake-server/scripts/smoke-test.js   # 7 data integrity checks
```

---

## Maintenance Rules

| When this changes | Update this |
|---|---|
| A workflow step changes | Update the relevant skill file |
| A threshold or path changes | Update config.js (not the agent) |
| A new recurring rule is needed | Add a hook (not CLAUDE.md, not memory) |
| New project state (data counts, decisions) | Update project_living_intelligence.md + roadmap |
| A rule is violated repeatedly | Escalate from memory → CLAUDE.md → hook |
| New content action type introduced | Create a new skill file |
| Session ends | Update project_roadmap.md (move completed items to ✅) |
