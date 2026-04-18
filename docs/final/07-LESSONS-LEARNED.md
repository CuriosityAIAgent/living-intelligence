# Lessons Learned — 44 Sessions of Building
**Definitive Reference — April 17, 2026**

These are patterns that emerged from real mistakes across 44 sessions. Each one cost time, credibility, or both. Read before starting any new feature or session.

---

## The 15 Failure Patterns

### 0. Context Filling Up
Have I compacted recently? If 3+ tasks done, compact NOW. Don't wait. Context exhaustion causes the agent to lose track of what's been done, leading to duplicate work or contradictory changes.

### 1. "Done" Without Verification
Am I saying "done" because I tested it, or because I committed it? Those are different. **Session 42:** Agent claimed empty states were fixed. Screenshots proved they weren't. Agent had only verified the build passed, not that the UI rendered correctly.

### 2. One-File Fix Missing Other Instances
Did I grep for the same issue everywhere? Or just fixed the file in front of me? **Session 10:** DATA_DIR fix affected 9 agents but was initially applied to only 1.

### 3. Advisory Not Blocking
Am I building something that nudges, or something that enforces? Haresh needs enforcement. **Pattern:** Critical rules need hooks (shell scripts at tool level), not memory files. Memory is advisory — hooks are deterministic.

### 4. Literal Interpretation
Am I solving what Haresh asked for, or what he needs? They're often different. **Session 35:** Asked for "4 tabs" — but the existing 7-tab architecture was the right design. Literal interpretation dropped 3 working features.

### 5. Docs Later
Am I planning to update docs "at the end"? Update them NOW, same commit. **Solution:** `enforce-doc-updates.sh` hook blocks commits with agent changes and no docs/ files staged.

### 6. Source Not Fixed
Did I fix the output but not the generator? If the_so_what was rewritten manually, is the prompt that generates it also fixed? **Session 41:** Anti-AI rules added to data files but not to the writer prompt that generates future content.

### 7. No Plan
Am I jumping into execution? Write the plan first, get validation. **Session 14:** Planned the v2 pipeline architecture across 3 documents before writing a single line of code. Result: clean implementation, no rework.

### 8. Wrong Tool
Am I using the right approach? **Session 37:** Fixed the content-producer API credits bug by redesigning the Remote Trigger to do writing/eval/fabrication itself ($0 via Max tokens) instead of calling `new Anthropic()` from Railway.

### 9. Skipping Iteration
Am I doing the evaluate-refine loop? That's where quality comes from. **Session 38:** Remote Trigger prompt was written from memory and the iteration loop was MISSING — the core differentiator of v2. Caught during review. Now a standing rule: always translate from code, never from memory.

### 10. URLs Unverified
Every URL in output must return 200. Check before saving. **Session 17:** 18 unreliable Yahoo Finance URLs removed from entries after systematic verification.

### 11. No E2E Test
Unit tests pass ≠ system works. Run real end-to-end test with real data before shipping. **Session 40:** Built 58 Playwright tests covering the full user journey from landing page through auth to content interaction.

### 12. AI Copy Shipped Raw
Run humanizer on all user-facing text. If it sounds like a press release, rewrite it. **Solution:** 18 anti-AI rules in writer prompt + `check-ai-patterns.sh` hook on data file writes.

### 13. Desktop Only
Check mobile (375px) before committing any UI work. **Status:** Editorial Studio responsive testing deferred (Phase G), but portal pages need mobile verification.

### 14. Localhost Assumptions
Never use `request.url` for redirects in deployed apps. Use `x-forwarded-host` header. **Session 29:** Railway reverse proxy returns localhost:8080 in request URL, breaking OAuth callbacks.

### 15. Feature Regression in Redesigns
When redesigning a UI, EVERY existing feature must be accounted for. **Session 35:** v4 redesign dropped TL, Landscape, Audit, and Blocked tabs. Components existed as dead code. Not caught until Session 42. **Solution:** FEATURE_MANIFEST.md — checklist before every deploy.

---

## Architecture Lessons

### 1. JSON + Git Is Right for This Scale
Flat JSON files in a git repo = zero infrastructure, perfect versioning, instant rollback. Works beautifully up to ~500 entries. Beyond that, migrate to Supabase (already set up as KB).

### 2. Store Raw, Transform Later
Every Jina fetch, every Claude output, every human decision = immutable record in KB. You can always re-derive; you cannot re-fetch a deleted article. Palantir's Raw Zone pattern.

### 3. Set Up Persistent Storage BEFORE Building Pipeline
We re-fetched 264 URLs and spent 6 sessions on v2 retrofit that would have been unnecessary if KB existed from day one. **Rule:** For next vertical, set up Supabase before writing any pipeline code.

### 4. Two-Call Anti-Hallucination Pattern
Structure → Verify. The governance/fabrication check as a separate Claude call (not the same call that generates content) is the primary defense against hallucination. Never merge these into one call.

### 5. Prompt Versioning Matters
`prompts/writer-v1.js` exports `VERSION = 'writer-v1'`. Every entry tracks which prompt version produced it. When you change a prompt, you can measure whether quality improved.

### 6. Human-in-the-Loop Is Architecture, Not Compromise
"Nothing auto-publishes" is not a safety feature — it is the trust infrastructure. At $4,500/year, one fabricated claim costs a client. The 2024 ACM study found human-in-the-loop RAG reduced hallucinations 59%.

### 7. Hooks > Memory > Documentation
Enforcement hierarchy: hooks (deterministic, cannot be ignored) > memory (loaded into context, can be forgotten under pressure) > documentation (must be read manually). Critical rules should be hooks.

### 8. This Is a Repeatable Factory
The four-layer system (CLAUDE.md + Memory + Skills + Hooks) is vertical-agnostic. Only content, thresholds, and prompts change per vertical. Data model, pipeline, governance, and Editorial Studio ship as template. Setup for next vertical: ~2 sessions.

---

## Real Incidents

| Session | What Happened | Rule Created |
|---------|--------------|--------------|
| 7 | BCG report claims not verified against actual PDF | PDFs must be fetched and read |
| 8 | unavatar.io returned broken placeholder images | Hook: check-banned-urls.sh |
| 9 | Railway crash from duplicate `const` in scheduler.js | Hook: pre-commit-checks.sh |
| 10 | DATA_DIR fix applied to 1 of 9 agents | Pattern 2: grep for all instances |
| 10 | "$14.00" split into two sentences by formatter | Preserve decimal points in splitter |
| 17 | 18 Yahoo Finance URLs returned 404 | Pattern 10: verify all URLs |
| 18 | JPMorgan metrics copied from competitor file | PRIME DIRECTIVE created |
| 18 | BofA $211B mis-attributed to Erica (was AUM) | Attribution Discipline created |
| 29 | OAuth redirect broken on Railway | Pattern 14: x-forwarded-host |
| 35 | v4 redesign dropped 4 tabs | FEATURE_MANIFEST.md created |
| 38 | Remote Trigger missing iteration loop | feedback_trigger_prompt.md created |
| 39 | Code evaluator hook had stale .env path | Fixed: multi-path env sourcing |
| 41 | Railway dual-instance: v1+v2 both fire cron | v1 code fully removed from server.js |
| 42 | Agent claimed empty states fixed, screenshots proved otherwise | Pattern 1: test before claiming done |

---

## Setup Checklist for New Verticals

Before session 1 of any new vertical:

- [ ] Define 7-8 capability dimensions
- [ ] Identify 25-40 tracked companies (landscape seed)
- [ ] Define 8 landscape segments with classification rules
- [ ] Write the_so_what framing for target CXO audience
- [ ] Set up STATE_DIR and DATA_DIR as separate env vars from day 1
- [ ] **Set up Supabase KB before building pipeline** (lesson from sessions 1-22)
- [ ] Create memory files: project.md, roadmap.md, content_standards.md
- [ ] Write CLAUDE.md content standards
- [ ] Set up branching: main / intake / feature/X
- [ ] Seed discovery queries (8 broad L1 + 7 dimension-based)
- [ ] Define 5 most important verified data points to anchor landscape
- [ ] Set up Claude Code hooks from session 1:
  - PreToolUse Bash: `node --check` + `tsc --noEmit` before commit
  - PostToolUse Write/Edit: banned URL check
  - Stop hook: roadmap update reminder
- [ ] Build Editorial Studio as React app from session 1
- [ ] Create FEATURE_MANIFEST.md from session 1

**Estimated time to first production deploy: 2 sessions** (1 setup + landscape, 1 pipeline + first 10 entries)

---

## The Cost of a Miss

A wrong number in a CEO presentation is not a typo. It is a trust failure that can end the platform's credibility. Every piece of content on this site should be something you would stand behind in a room full of senior executives who have read the primary source.

**When in doubt: omit.** A shorter, fully verified entry is always better than a longer entry with one fabricated number.
