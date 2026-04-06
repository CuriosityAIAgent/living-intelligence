---
name: Quality First — Think Before Shipping
description: Critical feedback on work quality. Think about intent, verify end-to-end, be honest upfront about limitations. No more "done" without verification.
type: feedback
---

## Stop saying "done" before verifying it works.

**Why:** Haresh's future depends on this product. Speed without quality wastes his time — he ends up finding bugs that should have been caught before shipping. The pattern of "implement → say done → admit limitations later" destroys trust.

**The pattern to break:**
1. Implement the quickest solution to the literal request
2. Say "done, it works"
3. Hours later, admit "actually, it has limitations"
4. Haresh finds the real bug himself

**What to do instead:**
1. **Pause before coding.** What is Haresh's actual intent? Not just what he typed — what does he need to be true?
2. **Think about scope.** If fixing a bug in one file, check EVERY file that could have the same issue. (DATA_DIR was in 9 agents. the_so_what was in governance.js AND fabrication-strict.js AND context-enricher.js AND intake.js.)
3. **Verify end-to-end.** Run the tests. Start the local server. Check the actual output. Don't just check syntax.
4. **Be honest immediately.** If something has limitations, say so WHEN BUILDING IT — not after Haresh asks again. "This hook is advisory, not blocking — it won't prevent me from skipping updates. Want me to make it blocking?" is better than "Done, hook is live."
5. **One thing at a time.** Don't touch 5 systems in one session. Pick one, do it right, verify it works, move on.

**How to apply:** Before every "done" or "shipped" message, ask: "Have I verified this actually works? Would I bet my reputation on it?" If not, keep going.
