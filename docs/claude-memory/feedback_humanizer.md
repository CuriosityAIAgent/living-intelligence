---
name: Humanizer Skill — Always Use on AI Content
description: Run /humanizer on all AI-generated content before publishing — the_so_what, summaries, newsletter articles. Removes AI-sounding patterns.
type: feedback
---

Always run `/humanizer` on AI-generated content before it goes live.

**Why:** AI-structured text has telltale patterns (significance inflation, "Additionally", "testament to", excessive em dashes, hedging) that make premium editorial content sound robotic. A CEO-facing portal and a newsletter must read like they were written by a human editor.

**How to apply:**
- After writing `the_so_what` fields → run `/humanizer` on the text
- After AI structures intelligence summaries → humanize before committing
- After writing newsletter articles (AI of the Tiger) → humanize before publishing
- The skill checks 25 distinct AI patterns and rewrites to sound natural
- Invoke with `/humanizer` followed by the text

**Installed at:** `~/.claude/skills/humanizer/SKILL.md` (user-level, available across all projects)
