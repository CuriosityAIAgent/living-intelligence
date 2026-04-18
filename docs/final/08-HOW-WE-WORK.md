# How We Work — Development Philosophy
**Definitive Reference — April 18, 2026 | Distilled from 44 sessions**

This document captures how we approach building this product. Not just what tools we use, but how we think. These principles emerged from real work — mistakes that cost hours, approaches that saved days, and a shared understanding that took time to develop.

---

## The Four Stages

Every piece of work flows through four stages. Skipping any one of them has, without exception, caused problems.

### 1. PLAN — Think Before Typing

**What we do:**
- Write the plan before writing code. Always. Even for "quick fixes."
- For anything non-trivial: create a document (plan file or memory file) describing what we're building, why, and how
- Get alignment before execution. Show the plan, get a "yes", then build.
- Consider what already exists. Read the code first. Understand before modifying.

**Why this matters:**
- Session 14: Planned the entire v2 pipeline architecture across 3 documents before writing a line. Result: clean implementation across sessions 14-17, no architectural rework.
- Session 35: Jumped straight into a UI redesign without checking what existed. Dropped 4 working tabs. Cost 3 sessions to recover.

**The questions we ask:**
- What problem are we actually solving? (Not what was literally asked — what's needed)
- What already exists that we should preserve or build on?
- What are the dependencies? What breaks if we change this?
- What does "done" look like? How will we verify it?

---

### 2. BUILD — Write Code With Intent

**What we do:**
- Read existing code before modifying. Never propose changes to code we haven't read.
- Edit existing files rather than creating new ones. Builds on existing work, prevents file bloat.
- One thing at a time. Don't refactor while fixing a bug. Don't add features while refactoring.
- Follow the config. All thresholds, paths, and constants live in `config.js`. No agent defines its own.
- Use the right tool for the job. Max tokens for writing ($0) vs API for discovery ($). Hooks for enforcement vs memory for guidance.

**Coding principles that matter:**
- **Prompts are code.** Version them (`writer-v1.js`), track which version produced each output, measure quality changes. A prompt change is a code change.
- **Store raw, transform later.** Every Jina fetch, every Claude output, every human decision is an immutable record in KB. You can re-derive; you cannot re-fetch a deleted article.
- **Two-call anti-hallucination.** Generate in one call, verify in a separate call. Never merge structuring and verification into the same prompt. The fabrication check must be adversarial to the writer.
- **Idempotent pipelines.** Every mutation accepts an idempotency key. Content-hash dedup prevents duplicate publishes. Every pipeline run is safely re-runnable.
- **Graceful degradation.** If Supabase is unreachable, return null and log a warning — don't crash. If NewsAPI key isn't set, skip that layer. The pipeline continues.

**What we don't do:**
- Don't add features beyond what was asked. A bug fix doesn't need surrounding code cleaned up.
- Don't build for hypothetical future requirements. Three similar lines beat a premature abstraction.
- Don't add error handling for scenarios that can't happen. Trust internal code and framework guarantees.

---

### 3. TEST — Verify Before Claiming Done

**What we do:**
- Test the actual thing, not a proxy. Build passing ≠ feature working. Type checks verify code correctness, not feature correctness.
- For UI changes: restart the server, open the browser, click through the golden path AND edge cases. Screenshots or it didn't happen.
- For API changes: curl the endpoint, check the response shape, verify the data.
- For pipeline changes: run a real entry through the full flow end-to-end.
- Run the test suite before pushing. Smoke tests catch data integrity issues. Unit tests catch logic regressions. E2E tests catch integration failures.

**Why this matters:**
- Session 42: Agent claimed empty states were fixed. Screenshots proved they weren't. The build passed, but Tailwind v4 classes weren't actually applying in the browser. Inline styles were the fix — only discovered by looking at the actual rendered page.
- Session 9: BlockedPanel pushed without testing — API format bug (object vs array) only caught after being asked "did you test this?"

**The test hierarchy:**
1. **Does it build?** (`npx vite build` / `npx next build`) — catches syntax and type errors
2. **Does the test suite pass?** (`node scripts/run-tests.js` + `node scripts/smoke-test.js`) — catches logic regressions
3. **Does it actually work?** (Open browser, click buttons, check network tab) — catches feature failures
4. **Does it work in production?** (Push, check Railway logs, verify live site) — catches deployment issues

---

### 4. COMMIT & ITERATE — Ship Carefully, Improve Continuously

**What we do:**
- Commit with meaningful messages that explain WHY, not just WHAT.
- Update docs in the same commit as the code change. Not after. Not "later." Same commit. The `enforce-doc-updates.sh` hook blocks commits where agent code changed without docs.
- Update memory files after every commit. The `post-commit-memory-reminder.sh` hook fires every time.
- Code review via Sonnet evaluator. Every commit goes through `code-evaluator.sh` — an LLM review gate that blocks on FAIL. For multi-file architecture changes, also run Opus deep review.
- Push to intake first, always. Test on Railway. Only merge to main when verified.

**The iteration philosophy:**
- The evaluate-refine loop is where quality comes from. First drafts — of code, of content, of prompts — are never consulting-quality.
- This applies to content (writer v1 → evaluate → refine to v2), to UI (build → screenshot → adjust → re-test), and to architecture (plan → build → discover gaps → revise plan).
- Don't iterate forever. Two iterations with early exit. If it passes all checks after v1, ship it. If it still fails after v3, step back and reconsider the approach.

---

## Core Principles We've Learned

### 1. Human-in-the-Loop Is Architecture, Not Compromise

"Nothing auto-publishes" is not a safety feature — it is the trust infrastructure that ships with every product. At $4,500/year, one fabricated claim costs a client. The 2024 ACM study found human-in-the-loop RAG reduced hallucinations 59%.

Haresh reviews the finished product. Not intermediate steps. Not raw pipeline output. The final, refined, fabrication-checked, scored entry. His time is spent on editorial judgment, not pipeline babysitting.

### 2. Enforcement Hierarchy: Hooks > Memory > Docs

Critical rules need hooks (shell scripts at the tool level). They fire deterministically, cannot be forgotten under context pressure, and cannot be overridden by a convincing-sounding argument.

Memory files are loaded into context. They guide behavior ~60% of the time without hooks. Under context pressure (long sessions, complex tasks), they get forgotten.

Documentation must be read manually. It's the weakest form of enforcement.

**When a rule gets violated twice despite being in memory → it becomes a hook.**

### 3. Translate From Code, Never From Memory

The Session 38 Remote Trigger incident: the mandatory evaluation+refinement loop was missing from the trigger prompt because it was written from memory instead of being translated step-by-step from `content-producer.js`.

This applies to any prompt that mirrors code logic. Read the code. Translate each step. Verify the prompt matches. Never reconstruct from what you remember the code does.

### 4. Search First, Guess Never

When looking for a URL, a current statistic, or a file location — search for it rather than guessing. If it can't be found in 2 attempts, switch methods immediately.

Multiple rounds guessing BofA URLs when a single Google search would have found the article. Not acceptable for a premium product.

### 5. Fix the Generator, Not Just the Output

If the_so_what was manually rewritten to be better, the prompt that generates future the_so_whats must also be updated. If a data file was manually corrected, the pipeline that produces those files must also be fixed.

Fixing output without fixing the source means the same problem recurs on the next pipeline run.

### 6. Grep for All Instances

When fixing a bug, search for the same pattern everywhere. A DATA_DIR fix that applies to 1 of 9 agents is not a fix — it's a time bomb. `grep -r` before committing.

### 7. Quality Is Not Optional at This Price Point

This is a $4,500/year product for CXOs. Every number must be verifiable. Every URL must resolve. Every claim must trace to a source. Every UI element must be polished.

"Good enough" at a consumer price point is not good enough here. The bar is: would you stand behind this claim in a room full of senior executives who have read the primary source?

### 8. The Platform Is a Factory

The four-layer system (CLAUDE.md + Memory + Skills + Hooks) is vertical-agnostic. Only content, thresholds, and prompts change per vertical. Data model, pipeline, governance, and Editorial Studio ship as template.

We're not building a wealth management product. We're building a repeatable intelligence product factory that happens to start with wealth management. Every architectural decision should make the next vertical easier, not harder.

---

## How We Communicate

- **Be direct.** Lead with action taken. No preamble. No "I'll now proceed to..."
- **Be honest immediately.** If something is broken, say so and fix it. Don't hedge.
- **Show, don't tell.** Screenshots for UI work. curl output for API work. Test results for logic work.
- **Never say "done" without verification.** "Done" means tested and working, not committed and hoping.
- **When something can't be done, say why.** Don't silently skip steps or produce partial work without flagging it.
- **Surface the roadmap.** Every time work starts or "what's next" is asked, show the pending list from project_roadmap.md first. Don't invent new work when planned work exists.

---

## The Working Session Pattern

```
1. START
   └── Read project_roadmap.md (what's pending?)
   └── Run /catchup (Railway health, inbox, tests)
   └── Align on today's goals

2. PLAN
   └── For each goal: read existing code, understand context
   └── Write plan if non-trivial (doc or message)
   └── Get "yes" before building

3. BUILD + TEST (loop)
   └── Write code
   └── Test immediately (build, smoke, browser, curl)
   └── Fix issues found
   └── Re-test

4. SHIP
   └── Commit (code evaluator fires, docs enforced)
   └── Push to intake (tests fire)
   └── Verify on Railway
   └── Update memory files

5. WRAP
   └── Update roadmap with what was done
   └── Update memory with session learnings
   └── Flag any deferred work
```

This pattern works. When we follow it, sessions produce clean, tested, documented work. When we skip steps, we create debt that costs future sessions.
