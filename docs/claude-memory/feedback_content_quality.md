---
name: Content Quality — Zero Fabrication Rules
description: Why content standards exist on Living Intelligence — the incidents, the stakes, the principle. The procedural rules live in the skills.
type: feedback
---

**This is a premium, CEO-facing platform. Content appears in boardrooms and senior leadership meetings. One fabricated or unverified statistic destroys the platform's credibility permanently.**

## The Prime Directive

**Never write a claim you have not personally read in the source during this session.**

Not from memory. Not from a previous session. Not from `data/competitors/*.json`. Not from another intelligence entry. Only from a source fetched and read right now, in this session.

## Why This Exists — The Incidents

These are not hypothetical. Each incident below was a real failure that reached or nearly reached production:

| Incident | What happened | Rule created |
|----------|--------------|-------------|
| **JPMorgan March 2026** | Intelligence entry published with fabricated metrics ("95% faster", "20% YoY growth", "9,600 advisors") — all copied from competitor file without fetching the source PDF. Haresh caught it by opening the actual Investor Day document. Platform was about to be shown to a Global CEO. | WebFetch before writing. Never copy from competitor files. |
| **BCG entry** | Claimed "147 financial institutions analyzed", "4x more value", "25-35% productivity gains" — all fabricated. No source fetched. | Statistics must be traceable to a named source. |
| **Amodei quote** | Key quote in TL entry was fabricated — the exact phrasing did not appear in "Machines of Loving Grace". It was recalled from memory, not verified. | key_quotes must be verbatim from fetched source. |
| **Altman date** | "The Intelligence Age" dated 2025-09-23 — real date is 2024-09-23. One year off. Date extracted from URL, not content. | Always extract date from article body. |
| **BofA Erica figure** | "2 billion interactions" was from April 2024. March 2026 figure is 3.2 billion. Two completely different contexts. | Check if a newer figure exists before publishing. |

## The Procedural Rules

The step-by-step workflow implementing these principles lives in the skills:
- **`/add-entry`** — full Track 2 entry workflow (WebFetch, claim extraction, verification, confirmation)
- **`/add-tl`** — thought leadership workflow (verbatim quotes, institutional attribution)
- **`/add-company`** — landscape company workflow (evidence-based maturity rating)

**Do not follow these rules from memory. Invoke the skill — the skill is the quality gate.**

## The Cost of a Miss

A wrong number in a CEO presentation is not a typo. It is a trust failure that can end the platform's credibility. Every piece of content on this site should be something you would stand behind in a room full of senior executives who have read the primary source.

**When in doubt: omit. A shorter verified entry is always better than a longer entry with one fabricated number.**
