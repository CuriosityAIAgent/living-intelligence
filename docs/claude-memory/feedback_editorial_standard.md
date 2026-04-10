---
name: Editorial Standard — The So What
description: The three-layer editorial framework that makes Living Intelligence a premium product, not an aggregator. The_so_what examples and why it matters.
type: feedback
---

Every intelligence entry must have three layers. Missing Layer 3 makes this a news aggregator, not a premium product.

| Layer | Field | Purpose |
|-------|-------|---------|
| 1. Trigger | `type`, `date` | The news event — minimal context only |
| 2. Capability | `summary` | Which of the 7 dimensions is advancing, with evidence |
| 3. **The so what** | `the_so_what` | What a CXO should think or decide because of this |

**Why:** A CXO pays $500/month for Layer 3. They can get Layers 1+2 from Bloomberg. Layer 3 requires understanding the wealth management business — who's ahead, what the adoption curve looks like, what the build-vs-buy decision means. That is the moat.

## Strong the_so_what Examples

These live in the `/add-entry` skill as well. Reference them when assessing quality:

- *Jump $80M raise:* "Advisor productivity tools are now a funded, scaling category — firms without an AI meeting workflow strategy are falling behind 15,000 advisors who already have one."
- *BofA Erica 3B:* "At 3 billion interactions, AI is already the primary client touchpoint for BofA's 20M users. The question for every wealth firm is no longer whether to deploy conversational AI — it's build vs buy, and how fast."
- *Goldman 46k employees:* "Goldman's firm-wide deployment sets a new speed benchmark. Firms still in pilot phase are now 18+ months behind the market leader."
- *Altruist Hazel 1,600 RIAs in 30 days:* "The independent channel is adopting AI faster than the institutional channel — a structural reversal of the historic adoption curve."

## The Standard

The procedural enforcement of this standard lives in the `/add-entry` skill (Step 5 schema rules + the_so_what section). **Do not write entries without invoking the skill.**

If a the_so_what reads like a headline restatement or could apply to any AI company, it is wrong. Rewrite it before publishing.
