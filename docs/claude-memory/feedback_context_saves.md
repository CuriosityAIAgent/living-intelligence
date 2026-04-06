---
name: Proactive context saves and compaction
description: Compact after every major milestone. Save memory immediately after completing work. Never wait for auto-compact.
type: feedback
---

Compact and save after every major milestone — never wait for auto-compact or user reminder.

**Why:** Haresh has flagged this MULTIPLE times. Auto-compact fires with no warning and context gets lost. Waiting until forced means sloppy handoffs between sessions. This is a trust issue — repeated failure to follow this rule erodes confidence in my reliability.

**How to apply:**
- After completing any significant unit of work (agent built, bug fixed, feature shipped), update memory files AND suggest compacting if context is getting long
- At natural pauses (topic switch, user confirms something), check if memory is stale
- Proactively say "let me compact and save state" — don't wait to be asked
- After ~30-40 tool calls or 3+ completed tasks, compact
- The PreCompact hook warning = EMERGENCY — drop everything and save
- Files to update: `MEMORY.md` · `project_roadmap.md` · `project_living_intelligence.md` · `reference_system_architecture.md`

**Pattern to break:** Saying "I'll update docs" then continuing to code. NO. Update NOW, then continue.
