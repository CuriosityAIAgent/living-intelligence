# Add Thought Leadership Entry

**Trigger phrases:** "add thought leadership", "add this essay", "add a TL entry", "add to thought leadership", "/add-tl"

Thought leadership entries are the most editorially demanding content on the platform. They are curated essays and reports from named senior figures or major institutions. Every quote must be verbatim. Every attribution must be exact. A fabricated quote from a named CEO destroys the platform's credibility permanently.

---

## Step 1 — Confirm the Source

Ask the user for:
- The URL or PDF link
- The author (name + title + organisation) OR the publishing institution if no named author
- Approximate date published

**Institutional reports (BCG, McKinsey, WEF, IMF) are valid** even without a named author — use `author_organization` instead of `author_name`.

---

## Step 2 — Fetch the Source (HARD REQUIREMENT)

**WebFetch the URL now.** If it's a PDF, fetch it. If it's paywalled, find an open version.

For PDF sources:
- Use Jina `r.jina.ai/{url}` to extract content
- If Jina fails, search for an open summary or press release covering the same piece

**If you cannot access the source at all:** tell the user. Do not write the entry from memory or secondary sources. Ask the user to paste the key quotes directly.

---

## Step 3 — Extract Verbatim Quotes

Find 2–4 quotes from the source that are:
- Substantive — a real claim or insight, not a pleasantry
- Attributable — clearly said by the named author or from the report
- CEO-relevant — something a senior wealth management executive would find insightful

List them exactly as they appear in the source:

| Quote | Location in source |
|-------|-------------------|
| "[verbatim text]" | [page number / paragraph / section heading] |

**Do not paraphrase a quote and present it as direct speech.** If a quote needs shortening, use [...] to indicate omission.

---

## Step 4 — Quality Gate Check

The thought leadership quality gate requires at least one of:
- A named author with a senior title (C-suite, partner, professor, recognized expert)
- An institutional author (BCG, McKinsey, WEF, IMF, major central bank)
- A verifiable publication with editorial standards

**Reject if:** The piece is a vendor blog, a marketing white paper without named senior authorship, or an aggregator summary of other people's ideas.

If in doubt, ask the user: "Is this original thinking from a named expert or recognised institution?"

---

## Step 5 — Write the TL Entry JSON

```json
{
  "id": "author-lastname-topic-year",
  "title": "Exact title of the piece",
  "subtitle": "Optional — subtitle or publication name",
  "summary": "3–4 sentences. What is the central argument? What evidence or framework does the author use? What is the implication for wealth management?",
  "key_quotes": [
    {
      "quote": "[verbatim quote from source — exact words, exact punctuation]",
      "context": "One sentence explaining what the author was discussing when they said this"
    }
  ],
  "insights": [
    "Insight 1 — a specific, actionable takeaway from the piece",
    "Insight 2",
    "Insight 3"
  ],
  "author": {
    "name": "First Last — or null if institutional",
    "title": "Exact title as stated in the piece",
    "organization": "Organisation name",
    "photo_url": null
  },
  "author_organization": "For institutional reports — BCG, McKinsey, WEF etc. (null if named author)",
  "publication": "Where it was published",
  "date": "YYYY-MM-DD",
  "source_url": "The URL you fetched",
  "document_url": "Direct PDF link if available, otherwise null",
  "tags": ["thought-leadership", "relevant-topic"],
  "source_verified": true,
  "human_approved": true
}
```

**Schema rules:**
- `key_quotes` must be verbatim — exact words from the source. If you can't find a quote worthy of verbatim extraction, use a shorter list.
- `insights` are your editorial interpretation — these can be paraphrased, but must be grounded in the piece
- `photo_url: null` always — never use external photo URLs
- `document_url` — only set if you have a direct PDF URL that works. Test it.

---

## Step 6 — Read Back Key Quotes to Haresh

Before saving, read the key quotes back to Haresh with their source locations:

> "Quote 1: '[text]' — from [location in source]. Confirmed verbatim?"

**Wait for explicit confirmation on each key quote.** If Haresh is unsure, fetch the source again and verify.

---

## Step 7 — Save and Commit

Thought leadership entries go directly to `main` (they update the portal immediately):

1. Save to `data/thought-leadership/{id}.json`
2. Read it back to verify structure
3. Commit and push to `feature/landing-page` (the primary platform at livingintel.ai):
   ```bash
   git add data/thought-leadership/{id}.json
   git commit -m "Add thought leadership: {author} — {title}"
   git push origin feature/landing-page
   ```
   livingintel.ai redeploys automatically on Railway.

---

## Step 8 — Update Memory

Update `project_living_intelligence.md`:
- Increment thought leadership count
- Add the entry to the verified TL list: `author name — title — date — key insight`

---

## Non-Negotiable Rules

- **Every key_quote must be verbatim — copied character for character from the fetched source**
- **Never paraphrase a quote and present it in key_quotes as direct speech**
- **`source_verified: true` only if source was fetched in this session**
- **`human_approved: true` only after Haresh confirms the key quotes**
- **Vendor marketing content does not qualify — must be original expert/institutional thinking**
- **`photo_url: null` always** — we do not use external author photo URLs
