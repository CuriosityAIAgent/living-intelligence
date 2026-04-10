---
name: Pipeline Tuning Feedback — Session 10
description: Haresh's feedback on pipeline scoring, blocking, paywall handling, and content freshness. Critical for getting the Editorial Studio right.
type: feedback
---

## The editorial studio is the product. Getting this right = scaling across verticals.

**Why:** Haresh's words: "The editorial studio is the product. If we get this right, the day-to-day becomes a lot easier, and that is how we will be able to scale it across different verticals."

**Key feedback points (2026-03-27):**

1. **Don't randomly block** — before blocking, understand what the article is about, when published, what it covers. Blocked items need context.
2. **Scoring model needs tuning** — a Bloomberg article about Schwab CEO on AI scored 34 and was blocked. That's exactly what the portal should cover.
3. **Paywall ≠ low quality** — Bloomberg, FT, WSJ are the highest quality sources. If paywalled, search Google for press releases, company announcements, or other coverage of the same story before giving up.
4. **Featured story stale** — Hazel has been the lead story for a week. Portal needs to feel alive. Auto-rotate based on recency.
5. **Cast the net wide enough** — are discovery queries catching all relevant developments? Audit the search patterns.
6. **Think before coding** — this needs a proper plan, not just code changes.

**How to apply:** Before any pipeline code changes, present the analysis and plan to Haresh first. Get alignment on thresholds, scoring weights, and strategy before touching scorer.js, governance.js, or auto-discover.js.
