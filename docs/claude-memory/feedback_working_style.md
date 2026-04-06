---
name: Working Style Preferences
description: How Haresh prefers to collaborate — tone, urgency, research method, communication style
type: feedback
---

**This is a premium, best-in-class platform. Treat every entry as if it will be read aloud in a CEO meeting — because it will.**
Content is shown to Global CEOs and senior leadership. A fabricated number, a wrong attribution, a stale metric — any of these destroys the platform's credibility permanently. The standard is: every claim verifiable, every source fetchable, every number traceable to an exact page or slide.

**Why (specific incident):** In March 2026, a JPMorgan entry was published with metrics copied from memory without reading the source PDF. Haresh found the fabrication by opening the actual document. The platform was being prepared for a Global CEO walkthrough. This is the highest possible consequence of a content miss.

**How to apply:** Verify before writing. Fetch before claiming. When in doubt, omit. Never show something as published until the source has been read in this session.

**Search first, guess never.**
When looking for a URL or a current statistic, search for it (WebFetch a search query or use Jina) rather than guessing URL patterns. If you cannot find something in 2 attempts, switch method immediately.
**Why:** Spent multiple rounds guessing BofA URLs when the user found the article via a single Google search. This is not acceptable.

**Be proactive, not reactive.**
Don't wait to be asked to check things. If something looks wrong (dates, URLs, statistics, stale numbers), fix it without being asked.
**Why:** Multiple fabricated entries persisted for weeks because they weren't verified proactively.

**When something is wrong, say so clearly and fix it.**
Don't hedge. If a URL is 404, delete the entry. If a quote is fabricated, remove it. If a number is from 2024 and a 2026 version exists, find and use the 2026 version.

**Prefer deleting over leaving broken or stale content.**
If a source cannot be verified or a number is outdated with no newer verified source, delete the entry rather than leaving it.
**Why:** "Better to have fewer real entries than fake ones."

**Commit messages and summaries should be specific.**
List exactly what changed and why. Use tables for before/after comparisons. Include the reason for each deletion.

**Response style:** Direct, concise. Lead with action taken. No preamble. No "I'll now proceed to..."

**ALWAYS use skills for content actions — never improvise.**
When the user asks to add an entry, add a company, add thought leadership, run an audit, or start a new vertical: READ the skill file first, follow its steps exactly. The skill is the source of truth. Skills live in `intake-server/.claude/skills/` (project) and `~/.claude/skills/` (user-level). Improvising bypasses the quality gates built into the skill — this is not acceptable for a CEO-facing platform.
**Why:** Skills were built precisely because ad-hoc workflows skip steps (source verification, key stat confirmation, duplicate checks). One skipped step = one fabricated claim in front of a Global CEO.

**TRIGGER PHRASE: "things to do"**
When Haresh says "things to do" (or "what's on the list", "show me the checklist"), immediately read `project_roadmap.md` and output the full current checklist with status. No preamble — just the list.
**How to apply:** Treat it like a slash command. Read the file, render the table, done.

**ALWAYS surface the pending work list when starting something new.**
Haresh frequently jumps between ideas and loses track of what's in flight. Every time he introduces a new task OR asks "what's next", read `project_roadmap.md` and lead with: "Before we start — here's what's pending: [brief list]." Then proceed with the new task.
**Why:** Multiple sessions have ended with unfinished work because new ideas displaced in-progress items. The roadmap is the memory. Use it.

**Keep the roadmap current.**
After every session where tasks are completed, started, or added: update `project_roadmap.md` before the conversation ends. Move completed items to ✅, add any new items raised, update the sequence.
**Why:** The roadmap is only useful if it reflects reality. A stale roadmap is worse than no roadmap.

**ALWAYS test before pushing. No exceptions.**
The sequence is: write code → test locally → verify it works → THEN commit and push.
For every API endpoint: curl it and assert the response shape. For every UI change: restart the local server and confirm the behaviour. For every bug fix: reproduce the bug first, fix it, confirm it's gone.
**Why:** Phase 4 Block Review was pushed without testing — the API format bug (object vs array) was only caught after asking. This is not acceptable. Haresh has mentioned this multiple times. Testing is not optional.
**How to apply:**
- After writing a new API endpoint: `curl` it, check the response shape matches what the frontend expects
- After writing frontend logic: build with `npm run build`, confirm no TypeScript errors
- After a bug fix: reproduce the original error first, then confirm the fix resolves it
- Only run `git push` after all of the above pass
