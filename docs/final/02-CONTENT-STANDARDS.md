# Content Standards — Non-Negotiable Rules
**Definitive Reference — April 17, 2026**

These rules exist because of real incidents. Every rule has a "why" — a moment where a fabricated claim, unverified number, or mis-attributed metric nearly reached a CEO presentation. At $4,500/year, one wrong number ends platform credibility.

---

## The Prime Directive

**Never write a claim you have not personally read in the source during this session.**

Not from memory. Not from a previous session. Not from `data/competitors/*.json`. Not from another intelligence entry. Only from sources fetched and read right now.

---

## Track 2 Entry Rules (Direct JSON Writes — No Pipeline)

Track 2 entries bypass the automated pipeline entirely (no research-agent, no evaluator, no fabrication check). The human writing them is the only check. These rules are absolute:

1. **WebFetch the source URL before writing a single claim.** PDF → fetch it. 404 → find correct URL. Paywalled → note explicitly, find open alternative. No exceptions.

2. **Every `verified_claims` item must include exact location** — slide number, paragraph, section heading, or verbatim quote. "Investor Day PDF" is not acceptable. "Investor Day slide 12" is acceptable.

3. **`source_verified: true` only if URL was fetched and read in this session.** If cannot fetch, set `source_verified: false` and explain why.

4. **`human_approved: true` only after Haresh confirms the key stat.** Read headline number back with exact source quote before setting.

5. **Never copy claims from `data/competitors/*.json` without re-verifying against original source.** Competitor file may contain unverified claims from prior session.

6. **Never use a stat from a PDF not fetched in this session**, even if believed correct from prior knowledge.

---

## Attribution Discipline

**Never attribute broad business metrics to specific AI tools unless source explicitly makes that causal claim.**

Proximity implies causation. A metric and an AI tool in the same sentence — without explicit causal language from the source — is fabrication by implication.

### Examples of Fabrication by Implication

| Fabricated Claim | What Source Actually Said | Why It's Wrong |
|------------------|--------------------------|----------------|
| "20% gross sales growth linked to Connect Coach" | "GenAI tools helped teams focus on high-impact work" | Source never credits Connect Coach specifically |
| "€200M in AI savings" | "Efficiency gains including AI, automation, and operational improvements" | AI is one of several factors, not sole driver |
| "$211B in AI-linked asset growth" | "AUM in accounts where Erica is used" | Portfolio size, not growth attributable to tool |

### How to Apply

- Source says "AI tools contributed to X% growth" → write exactly that. Do NOT name specific tool unless source does.
- Source says "$X in AI savings" → check if AI alone or broader programme. Qualify accordingly.
- Source says "$X AUM in accounts using [tool]" → that's portfolio size, NOT growth attributable to tool.
- Before publishing any evidence linking metric to tool: "Did source say this tool caused this number?" If no → soften language.

---

## The Three Layers

Every intelligence entry must have all three layers. Missing Layer 3 = news aggregator, not premium product.

| Layer | Field | Purpose |
|-------|-------|---------|
| 1. Trigger | `type`, `date` | The news event — minimal context only |
| 2. Capability | `summary` | Which of the 7 dimensions is advancing, with evidence |
| 3. The So What | `the_so_what` | What a CXO should think or decide because of this |

**Why:** CXO pays $500/month for Layer 3. They get Layers 1+2 from Bloomberg. Layer 3 requires understanding wealth management business — who's ahead, adoption curve, build-vs-buy implications. That is the moat.

### Strong "The So What" Examples

- **Jump $80M raise:** "Advisor productivity tools are now a funded, scaling category — firms without an AI meeting workflow strategy are falling behind 15,000 advisors who already have one."
- **BofA Erica 3B:** "At 3 billion interactions, AI is already the primary client touchpoint for BofA's 20M users. The question for every wealth firm is no longer whether to deploy conversational AI — it's build vs buy, and how fast."
- **Goldman 46k employees:** "Goldman's firm-wide deployment sets a new speed benchmark. Firms still in pilot phase are now 18+ months behind the market leader."
- **Altruist Hazel 1,600 RIAs in 30 days:** "The independent channel is adopting AI faster than the institutional channel — a structural reversal of the historic adoption curve."

### Quality Gate

If the_so_what reads like a headline restatement or could apply to any AI company, it is wrong. Rewrite before publishing.

---

## When a Claim Cannot Be Verified

- **Omit it entirely.** A shorter, fully verified entry is always better than longer entry with one fabricated number.
- If key stat is only thing in doubt, write entry without it and flag to Haresh.
- Do NOT round up, interpolate, or extrapolate. "~20%" when source says "approximately 20%" is fine. "~20%" when source says nothing is fabrication.

---

## Anti-AI Writing Rules (18 Rules)

These are enforced in the Writer Agent prompt (`prompts/writer-v1.js`) and the Remote Trigger:

1. No em dashes (—)
2. No "additionally"
3. No "underscores" (as verb)
4. No "highlights" (as verb meaning "emphasizes")
5. No "showcases"
6. No "leverages" / "leveraging"
7. No "utilizing" / "utilization"
8. No "delve" / "delving"
9. No "tapestry"
10. No "pivotal"
11. No "testament"
12. No "fostering"
13. No "garner"
14. No "interplay"
15. No "intricate"
16. No "vibrant"
17. No "crucial"
18. No significance inflation: "stands as", "serves as", "marks a pivotal", "represents a shift", "signals"

**Additional writing rules:**
- Vary sentence length
- Use simple verbs (is, are, has) freely
- Max 1 hyphenated compound per sentence
- the_so_what must read like a person, not an LLM
- No copula avoidance: "serves as" → just say "is"

---

## Real Incidents That Created These Rules

| Incident | Session | Rule Created |
|----------|---------|--------------|
| JPMorgan metrics copied from competitor file without source fetch | 18 | PRIME DIRECTIVE: WebFetch every source in same session |
| BofA $211B attributed to Erica when it was AUM in Erica accounts | 18 | Attribution Discipline: proximity ≠ causation |
| Santander €200M attributed to AI alone (was AI + automation + ops) | 18 | Attribution Discipline: qualify broader efficiency claims |
| Amodei quote not in actual source | 10 | All key_quotes must be verbatim from fetched source |
| Altman date wrong by 1 year | 10 | Extract date from article body, not URL |
| FormattedSummary split "$14.00" into two sentences | 10 | Preserve decimal points in sentence splitter |
| BCG report claims not verified against actual PDF | 7 | PDFs must be fetched and read, not assumed |
| unavatar.io returned broken placeholder images | 8 | Never use external avatar/logo services |
| Altruist CTO title wrong (was CPO) | 36 | Re-verify titles against current source |
