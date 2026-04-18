# Living Intelligence — Final Reference Documents
**Created April 17, 2026 | Sessions 1–44 | Verified against codebase**

These 7 documents are the definitive, authoritative reference for the Living Intelligence platform. They were created by running 5 independent audit agents across the entire codebase, all memory files, all hooks, all skills, all agent prompts, and all planning documents — then synthesizing findings into clean references.

**Read these first. Trust these over older docs in `docs/` or `memory/` when there's a conflict.**

---

## Documents

| # | File | What It Covers |
|---|------|----------------|
| 01 | [SYSTEM-OVERVIEW](01-SYSTEM-OVERVIEW.md) | Architecture, deployment map, data counts, infrastructure, APIs, directory structure |
| 02 | [CONTENT-STANDARDS](02-CONTENT-STANDARDS.md) | Prime Directive, attribution discipline, three layers, anti-AI rules, real incidents |
| 03 | [PIPELINE-REFERENCE](03-PIPELINE-REFERENCE.md) | V2 pipeline phases, agent inventory, prompt architecture, McKinsey test, scoring, discovery, API routes, Remote Trigger config |
| 04 | [EDITORIAL-STUDIO](04-EDITORIAL-STUDIO.md) | All 7 tabs (status + features), design tokens, typography, spacing, components, SSE pattern, dead code |
| 05 | [CODING-STANDARDS](05-CODING-STANDARDS.md) | Code style, git workflow, hooks (12 total), testing (unit/smoke/E2E), documentation mandate, skills, env vars |
| 06 | [KNOWN-ISSUES](06-KNOWN-ISSUES.md) | 3 critical, 6 medium, 7 low-priority issues — all verified, all actionable |
| 07 | [LESSONS-LEARNED](07-LESSONS-LEARNED.md) | 15 failure patterns, architecture lessons, real incidents table, new vertical checklist |

---

## How to Use These

- **Starting a new session:** Read 06-KNOWN-ISSUES (what needs fixing) and 07-LESSONS-LEARNED (patterns to avoid)
- **Writing content:** Read 02-CONTENT-STANDARDS (non-negotiable rules)
- **Changing pipeline:** Read 03-PIPELINE-REFERENCE (how it works) + 06 (known bugs)
- **UI work:** Read 04-EDITORIAL-STUDIO (design tokens, feature manifest)
- **Deploying:** Read 05-CODING-STANDARDS (git workflow, hooks, testing)
- **Starting new vertical:** Read 07-LESSONS-LEARNED (setup checklist at bottom)

---

## Audit Summary (Session 44)

**What was audited:**
- 43 memory files (zero contradictions, all indexed)
- 27 agent files (18 active, 9 legacy)
- 12 hooks (all working correctly)
- 7 skills (6 production-ready, 1 needs v2 update)
- All API routes (UI calls vs server definitions)
- All planning documents vs actual implementation

**Overall assessment:** 95% complete. V2 pipeline architecture is correct and working. 16 issues found (3 critical, 6 medium, 7 low). Core editorial workflow fully functional.

**Top 3 actions:**
1. Verify Remote Trigger prompt in Managed Agents dashboard (iteration loop)
2. Restart Railway `proud-reflection` to kill v1 ghost process
3. Run Supabase UNIQUE constraint on research_briefs
