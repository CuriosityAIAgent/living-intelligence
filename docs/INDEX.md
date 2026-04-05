# Document Index — Living Intelligence

Everything in one place. Where to find what.

---

## Repo Documents (`docs/` + root)

| Document | What it covers |
|----------|---------------|
| `CLAUDE.md` | Master rules: content standards, environment, git workflow, brand tokens, data schema, segments, maturity levels, governance. The prime directive lives here. |
| `docs/architecture.md` | System architecture: two-system design (Portal + Intake Server), data flow diagrams, v1 and v2 pipeline flows, governance audit block, landscape data model, coverage table. |
| `docs/agents-and-architecture.md` | Every agent described: 11 intelligence agents + 5 landscape agents. API endpoints table. Data model schema. Test suites. The technical reference. |
| `docs/integrations.md` | Every external API: Anthropic Claude, Jina (search + extract + embeddings + reranker), DataForSEO (news + organic + images + content analysis + backlinks), NewsAPI.ai. Pipeline flow diagrams. |
| `docs/landscape-v2-plan.md` | Landscape v2 pipeline architecture: 5 agents, iteration process, quality criteria (Landscape McKinsey Test), testing plan, cost considerations. |
| `docs/landscape-v2-execution-plan.md` | Per-company execution process: 5 stages (research → supplementary → write → iterate → verify URLs). Quality gates. Priority order. Portal changes. Lessons learned. |
| `BUILD_PLAN_ALGORITHM.md` | Original algorithm design document (v1 era). |

---

## Memory Files (`~/.claude/projects/-Users-haresh/memory/`)

### Project State
| File | What it tracks |
|------|---------------|
| `MEMORY.md` | Master index — pointers to everything. Loaded into every conversation. Keep under 200 lines. |
| `project_roadmap.md` | ALL pending work sequenced. Check first every session. Update last. |
| `project_living_intelligence.md` | Full project details: stack, data counts, pipeline versions, session-by-session notes, pending items. |

### Feedback & Learning (how to work)
| File | What it teaches |
|------|----------------|
| `feedback_session_insights.md` | **READ EVERY SESSION.** Concrete mistakes from real sessions. 20 insights. 11 patterns to watch. The feedback loop. |
| `feedback_quality_first.md` | Stop saying "done" before verifying. Think about intent. Verify end-to-end. Be honest upfront. |
| `feedback_working_style.md` | Stakes are high (CEO presentations). Prefer deleting over broken content. |
| `feedback_content_quality.md` | Zero fabrication rules. URL verification. Quote attribution. JPMorgan incident. |
| `feedback_editorial_standard.md` | Three layers: trigger + capability + the_so_what. What makes content premium. |
| `feedback_landscape_process.md` | Plan before building. Use ALL search tools. No rushing. Quality over speed. |
| `feedback_landscape_urls.md` | Every URL verified. Portal changes needed for no_activity rendering. |
| `feedback_humanizer.md` | Run /humanizer on all AI content before publishing. |
| `feedback_context_saves.md` | Save memory proactively mid-session. Don't wait for auto-compact. |
| `feedback_pipeline_tuning.md` | Pipeline scoring and threshold tuning notes. |

### Project-Specific Knowledge
| File | What it contains |
|------|-----------------|
| `project_content_pipeline_v2.md` | v2 pipeline decisions: Opus for writer+evaluator, full source text, 2 iterations, early exit. |
| `project_landscape_enrichment.md` | Landscape enrichment tracking and decisions. |
| `project_pricing_positioning.md` | B2B annual firm license ($10K-$15K/year). Sales flow. Why B2C monthly was dropped. |
| `project_subscription_stack.md` | Stripe + Supabase Auth + Iubenda implementation plan. |
| `project_ai_tiger.md` | AI of the Tiger newsletter pipeline. Separate project. |

### References
| File | What it explains |
|------|-----------------|
| `reference_system_architecture.md` | Four-layer system: CLAUDE.md / Memory / Skills / Hooks. What each layer owns. Failure modes. |
| `reference_superpowers.md` | Agentic dev workflow, composable skills, TDD, git worktrees. |
| `retrospective_living_intelligence.md` | Sessions 1-7 retrospective. Architecture lessons. Incident log. Template for future verticals. |
| `research_distribution.md` | Distribution strategy research. |
| `research_pricing.md` | Pricing research and competitor analysis. |

---

## Skills (`intake-server/.claude/skills/` + `~/.claude/skills/`)

| Skill | When to use |
|-------|-------------|
| `/add-entry` | Adding an intelligence entry from a URL |
| `/add-company` | Adding a company to the landscape |
| `/add-tl` | Adding a thought leadership entry |
| `/catchup` | Session start: roadmap + health + inbox |
| `/audit` | Full content quality sweep |
| `/new-vertical` | Setting up a new vertical (user-level) |
| `/humanizer` | Removing AI writing patterns from text (user-level) |

---

## How to navigate

- **Starting a session?** → Read `MEMORY.md` (auto-loaded), then `project_roadmap.md`, then `feedback_session_insights.md`
- **Writing code?** → Check `docs/agents-and-architecture.md` for agent specs, `docs/integrations.md` for APIs
- **Adding content?** → Use the skill files. Read `feedback_content_quality.md` and `feedback_editorial_standard.md`
- **Something broke?** → Check `feedback_session_insights.md` for the same pattern. It's probably there.
- **Planning a new feature?** → Read `docs/landscape-v2-execution-plan.md` as a process template. Plan → build → test → iterate.
