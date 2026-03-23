# Algorithm v2 — Build Plan (Final)
## Session: 22 March 2026

---

## Core Philosophy

This platform is a **capability intelligence layer**, not a news aggregator or funding tracker.
Every entry must answer: which of the 7 capability dimensions is advancing, with what evidence, at what scale?

Funding, acquisitions, partnerships are **triggers** — reasons the story is publishable today.
They are not the story. The story is always capability + evidence + scale.

---

## Scoring Architecture (v2, max 100)

```
Dim A  Source Quality      0–25   Where did this come from? Is it credible?
Dim B  Claims Verified     0–25   Is what it says actually in the source?
Dim C  Freshness           0–10   Is this new? (less weight — impact > recency)
Dim D  Capability Impact   0–40   The core value: capability + evidence + scale
────────────────────────── ────
Total max                  100

PUBLISH  ≥ 75  (strong capability evidence + verified + credible source)
REVIEW   ≥ 60  (capability present but weaker evidence, or unverified claims)
BLOCK    < 60  (no clear capability OR no evidence OR bad source)
```

### Dim D: Capability Impact breakdown (0–40)

```
Capability Clarity (0–10)
  Clear capability + described in summary (capability_evidence populated):  10
  Capability tagged in entry but not described:                              5
  No clear capability dimension:                                             0

Evidence Quality (0–15)
  Deployed at scale + quantified metrics (N advisors, % savings):          15
  Deployed or piloting + named clients / described scope:                  10
  Announced + specific product details:                                     7
  Announced + vague intent only:                                            3
  No evidence / pure opinion or prediction:                                 0

Business Scale (0–10)
  Quantified: "15,000 advisors", "$2B AUM affected":                       10
  Named major institution as client/partner:                                 7
  Descriptive breadth: "firm-wide", "enterprise rollout":                   4
  Individual advisor / small scope:                                          2
  No scale information:                                                      0

Competitive Relevance (0–5)
  Tracked company IS the central subject (name in headline):                5
  Tracked company mentioned (but not central):                              3
  General industry / untracked:                                             1
```

---

## Files Changed (7 files + 1 data file)

```
data/capabilities/index.json          add search_term per capability (dynamic queries)
lib/data.ts                           add published_at to type, sort by published_at
intake-server/agents/publisher.js     set published_at, hard date validation
intake-server/agents/intake.js        new types, capability_evidence field, reframed prompt
intake-server/agents/scorer.js        new 4-dim scoring, Dim D Capability Impact
intake-server/agents/auto-discover.js capability queries (dynamic), HN gravity, dedup
intake-server/agents/scheduler.js     top 15, entity+event dedup, landscape flags
intake-server/agents/notifier.js      group by capability, landscape update prompts
```

---

## Date Integrity Fixes

**Problem A:** Feed sorts by `date` (event date) not by when we published it → Feb stories buried.
**Fix:** Add `published_at` (set at publish time). Sort feed by `published_at`, show `date` editorially.

**Problem B:** Claude can set wrong event date → old stories slip through.
**Fix:** Hard 90-day gate in publisher.js (validates even for manually submitted entries).
         Date divergence check: if Claude's date > 30 days from source pub_date → use source date.

**Problem C:** Same event (e.g. Jump $80M) keeps resurfacing in Telegram.
**Fix:** Entity+event dedup in scheduler: company + type + 14-day window → REVIEW with duplicate note.

---

## Discovery Architecture (v2)

Three dynamic layers:

| Layer | Source | Built from | Purpose |
|---|---|---|---|
| L1 News (broad) | DFS Google News | 5 hardcoded thematic queries | Catches unknown companies |
| L1 Capabilities | DFS Google News | data/capabilities/index.json (7 queries) | Capability-led discovery |
| L2 Companies | DFS Content Analysis | data/competitors/*.json (N queries) | Deep per-company |

Year in capability queries: dynamic `new Date().getFullYear()`.
Q1 adjustment: include prior year too since Dec-Feb content is < 90 days old.

---

## Build Order

Session 0 — Data + types (15 min)
  1. data/capabilities/index.json — add search_term
  2. lib/data.ts — published_at type, sort fix

Session 1 — Publish integrity (20 min)
  3. publisher.js — published_at + date validation

Session 2 — Intake reframe (30 min)
  4. intake.js — new types, capability_evidence, reframed Claude prompt

Session 3 — Scoring redesign (45 min)
  5. scorer.js — Dim A/B/C scaled down, Dim D Capability Impact (new)

Session 4 — Discovery (30 min)
  6. auto-discover.js — capability queries, HN gravity, narrative dedup

Session 5 — Pipeline wiring (20 min)
  7. scheduler.js — top 15, entity+event dedup, landscape flags
  8. notifier.js — capability grouping, landscape prompts

Session 6 — Verify (20 min)
  9. Run tests: node --env-file=.env scripts/run-tests.js
  10. Trace 21 March digest stories through new scorer manually
  11. Push to main
