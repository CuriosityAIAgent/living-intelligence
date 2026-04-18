# Add Intelligence Entry (v2 Pipeline)

**Trigger phrases:** "add this article", "add an intelligence entry", "write an entry for", "process this URL", "add to the feed", "/add-entry"

This skill uses the **v2 content pipeline** for consulting-quality intelligence entries. The standard is McKinsey/BCG quality — every entry must pass the 6-point McKinsey test, be multi-source verified, and include peer competitor context.

**v2 Pipeline:** Research Agent (multi-source) → Writer Agent (Opus, consulting voice) → Evaluator (McKinsey test) → Fabrication check → Refine if needed.

**Quality standard:** Every claim verifiable, every source fetchable, every number traceable. Named peer competitors in the_so_what. Decision-grade key_stat.

---

## Step 1 — Get the URL

Ask the user for the source URL if not already provided. Confirm it's the primary source (not a summary or secondary article).

---

## Step 2 — Fetch the Source (HARD REQUIREMENT)

**WebFetch the URL now, in this session.** Do not proceed until you have read the source.

- If the URL returns a paywall or <300 chars of content: find an open alternative (search for the story, find press release or company blog post). Document the fallback URL.
- If the URL 404s: tell the user immediately. Do not fabricate content. Ask for an alternative URL.
- If content is thin or ambiguous: flag it to the user before writing anything.

**You may not set `source_verified: true` unless you fetched and read the source in this session.**

---

## Step 3 — Extract Claims with Exact Locations

Before writing the entry, list every claim you plan to use with its exact location in the source:

| Claim | Exact location in source |
|-------|--------------------------|
| [stat or fact] | [paragraph / sentence / quote verbatim] |

If a claim you want to use is not in the source — omit it. Never infer, interpolate, or recall from memory.

---

## Step 4 — Check for Duplicates

Search `data/intelligence/` for any existing entry covering the same story or milestone:

```bash
grep -r "[company name]" /path/to/data/intelligence/ --include="*.json" -l
```

If a duplicate exists, tell the user and stop. Do not create a second entry for the same event.

---

## Step 5 — Write the Entry JSON

Follow this exact schema. Every field is required unless marked optional:

```json
{
  "id": "slug-format-company-topic-year",
  "title": "Headline — active voice, present tense, company name first",
  "summary": "2–3 sentences. Trigger (what happened) → Capability (what AI does) → strategic context.",
  "the_so_what": "1–2 sentences. Analytical insight — competitive benchmark, cross-landscape context, or infrastructure parallel. No directives.",
  "company": "Exact company name as it appears in data/competitors/",
  "entry_type": "product_launch | partnership | funding | regulatory | research | executive_move | earnings",
  "source_url": "The URL you fetched",
  "document_url": null,
  "image_url": null,
  "date": "YYYY-MM-DD — use article publication date, not today",
  "source_name": "Publication name",
  "sources": [
    { "name": "Company Newsroom", "url": "https://...", "type": "primary" },
    { "name": "Publication", "url": "https://...", "type": "coverage" },
    { "name": "Discovery source", "url": "https://...", "type": "discovery" }
  ],
  "source_count": 3,
  "author": { "name": null, "title": null, "organization": null },
  "tags": ["ai", "relevant-capability-dimension"],
  "source_verified": true,
  "human_approved": true,
  "_governance": {
    "verdict": "PASS",
    "confidence": 90,
    "verified_claims": ["claim 1 — exact source location", "claim 2 — exact source location"],
    "unverified_claims": [],
    "fabricated_claims": [],
    "notes": "Source fetched and read in this session. All claims verified.",
    "paywall_caveat": false,
    "verified_at": "[ISO timestamp]",
    "human_approved": true,
    "approved_at": "[ISO timestamp]"
  }
}
```

**Schema rules:**
- `the_so_what` must be specific analytical insight. If it could describe any AI news story, rewrite it. No directives.
- `date` = article publication date. Never use today's date unless the article was published today.
- `image_url` = null always (pipeline sets this). Never use clearbit, unavatar, or external logo URLs.
- `id` must be unique — check `data/intelligence/` for name collisions.
- `entry_type` must be one of the exact enum values listed.

---

## Step 6 — Read Back the Key Stat

Before saving anything, read the headline number or claim back to Haresh with the exact source quote:

> "The key stat is [X]. Source says: '[verbatim quote from article]'. Confirmed?"

**Wait for explicit confirmation before proceeding.**

---

## Step 7 — Save and Commit

Once confirmed:

1. Save the file to `data/intelligence/{id}.json`
2. Check the file was written correctly: read it back
3. Stage and commit to `feature/landing-page` (the primary platform at livingintel.ai):
   ```bash
   git add data/intelligence/{id}.json
   git commit -m "Add intelligence entry: {title}"
   ```
   The pre-commit hook will run `node --check` — fix any issues before pushing.
4. Push to `feature/landing-page`:
   ```bash
   git push origin feature/landing-page
   ```

---

## Step 8 — Update Memory

Update `project_living_intelligence.md`:
- Increment intelligence entry count
- Add the entry to the verified data points list if it contains a headline metric

---

## What Makes a Strong the_so_what

The `the_so_what` is the entire product. Subscribers pay for this layer — they can get headlines from Bloomberg. It must be analytical insight: what this move means competitively, historically, or structurally. One to two sentences. Never a summary. Never generic. Never a directive.

**NEVER use directive language:** "CXO", "board", "firms should", "must now decide", "game-changing". The the_so_what is analytical insight — competitive benchmarks, cross-landscape context, infrastructure parallels. Not advice.

**Run /humanizer on the_so_what before committing.**

**Strong examples:**
- BofA Erica: *"30 billion interactions and $211 billion in AI-linked asset growth make BofA's consumer AI estate larger than most standalone digital wealth platforms. The scale economics are now prohibitively expensive to replicate from scratch."*
- Goldman 46k: *"Goldman treating its AI platform as the most important infrastructure investment since electronic trading places it in the same category as Bloomberg terminals — foundational systems that reshape competitive positioning for decades."*
- Altruist Hazel: *"The independent channel adopting AI faster than the institutional channel is a structural reversal of the historic adoption curve, following the same pattern as discount brokerage adoption in the 1990s."*
- Altruist Hazel 1,600 RIAs in 30 days: *"The independent channel is adopting AI faster than the institutional channel — a structural reversal of the historic adoption curve."*

**Failing the_so_what test** (rewrite these):
- "This demonstrates the growing importance of AI in wealth management" → generic
- "Morgan Stanley continues to invest in AI capabilities" → headline restatement
- "Advisors will benefit from this new tool" → vague, no decision implication

**Hard rules on numbers:**
- Always check if a newer figure exists before publishing — AI moves fast. A 2024 figure may be significantly wrong by 2026.
- Dates must come from the article body, not the URL. URL dates are often wrong.
- Never include statistics that cannot be traced to a specific named source in `verified_claims`.

---

## Non-Negotiable Rules

- **Never write a claim you did not read in the fetched source during this session**
- **Never set `source_verified: true` without fetching the source**
- **Never set `human_approved: true` without Haresh's explicit confirmation of the key stat**
- **Never use today's date as the article date**
- **Never use external logo/image URLs** — `image_url: null` always
- **A shorter verified entry is always better than a longer entry with one fabricated number**
