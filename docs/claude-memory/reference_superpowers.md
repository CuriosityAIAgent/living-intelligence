---
name: Superpowers Framework
description: Agentic development workflow framework for AI coding agents — composable skills, TDD, git worktrees, structured planning phases
type: reference
---

# Superpowers — Agentic Skills Framework

**Repo:** https://github.com/obra/superpowers
**License:** MIT
**Install (Claude Code):** `/plugin install superpowers@claude-plugins-official`

## What it is

A complete software development workflow system for AI coding agents built on composable "skills". Agents check for relevant skills before any task and follow mandatory structured phases rather than coding ad-hoc.

## Seven-phase workflow

1. **Brainstorming** — agent asks clarifying questions, presents design in chunks for sign-off
2. **Git Worktrees** — isolated development branches, baseline test verification
3. **Planning** — breaks work into 2-5 minute tasks with file paths + verification steps
4. **Subagent Development** — fresh agents per task, two-stage review (spec compliance → code quality)
5. **Test-Driven Development** — strict RED-GREEN-REFACTOR cycle
6. **Code Review** — systematic severity-based issue assessment
7. **Branch Completion** — merge decisions, cleanup

## Core philosophy

- Write tests first, always
- Process over improvisation
- Simplicity as primary goal
- Evidence-based verification before declaring success

## Skills library (15+)

Testing, debugging, brainstorming, planning, parallel dev branches, subagent coordination, code review

## Relevance to Living Intelligence project

- **Git worktrees** → develop Phase 4 (Block Review), Phase 5 (Pipeline Control), landing page in parallel isolated branches
- **Subagent dev** → one agent for intake validation, one for editorial UI, one for portal
- **Structured planning** → great for new phases before coding begins (prevents the "rabbit hole" pattern)
- **TDD** → intake pipeline agents, gov-store, scoring logic are prime candidates for tests
- **Brainstorming phase** → aligns with Haresh's preference to review plans before implementation

## Limitations

- Adds process overhead (design sign-off required before any implementation)
- Mandatory workflows — no quick hacks
- Best for feature development, not production incident response
