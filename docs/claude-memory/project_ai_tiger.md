---
name: AI of the Tiger Newsletter Pipeline
description: Newsletter production system at ~/Desktop/ai-tiger-workflow — Node.js Express + Claude agents, beehiiv publishing, 5-phase pipeline
type: project
---

AI of the Tiger — daily AI newsletter for business leaders, published on beehiiv (tigerai.tech).

## Project Location
- `/Users/haresh/Desktop/ai-tiger-workflow/`
- Also legacy docs at `/Users/haresh/Desktop/AI of the Tiger/`

## Architecture
- **Server:** Node.js Express at `ui/server.js`, port 3001, `npm start`
- **Agents:** 10 agents in `ui/agents/` (research, writer, guardrail, image, publisher, patch-html, regen-meta, linkedin, chat, _shared)
- **Prompts:** 4 system prompts in `prompts/`
- **Output:** `output/YYYY-MM-DD/` (research.md, draft.md, header.png, newsletter.html, meta.json)
- **Model:** claude-sonnet-4-6

## Claude Code Infrastructure (built 2026-03-27)
- **CLAUDE.md:** Root project guide with content standards, pipeline docs, anti-redundancy rules
- **7 skills:** tiger-research, tiger-write, tiger-guardrail, tiger-image, tiger-publish, tiger-full, tiger-edit
- **4 hooks:** HTML validation on write, draft word count check, no-secrets commit guard, stop reminder
- **4 legacy commands:** tiger-research, tiger-write, tiger-image, tiger-publish (in `.claude/commands/`)

## UI Improvements (built 2026-03-27)
1. Editable draft (contenteditable + save to server)
2. Split-pane mode (research + draft side by side)
3. Inline AI rewrite (select text + floating toolbar with quick actions)
4. Expandable sidebar summaries (click to peek at stage output)
5. Guardrail annotations on draft (click findings to highlight in draft)
6. HTML preview + source edit toggle (edit raw HTML with live preview)

## Server Endpoints Added
- `POST /api/save-draft` — save manual draft edits
- `POST /api/inline-rewrite` — AI rewrite selected text fragment
- `GET /api/output-text/:date/:file` — serve output as text
- `POST /api/save-html` — save manual HTML edits

**Why:** Haresh found the original linear pipeline too rigid — couldn't go back and edit, lost context between tabs, chat couldn't make targeted edits.

**How to apply:** When working on this project, always use the skills. The UI is the main workflow surface — changes there affect daily newsletter production.
