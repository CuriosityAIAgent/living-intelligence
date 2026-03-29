# Add Landscape Company

**Trigger phrases:** "add X to the landscape", "add a landscape company", "add competitor", "add to the matrix", "/add-company"

This skill enforces the full workflow for adding a company to the capability matrix. The landscape is a core product differentiator — maturity ratings appear in CEO presentations. Over-claiming maturity is worse than under-claiming. When in doubt, rate lower and note the evidence gap.

---

## Step 1 — Confirm Basic Details

Ask the user (or confirm from context):
- Company name
- Segment: `wirehouse` | `global_private_bank` | `regional_champion` | `digital_disruptor` | `ai_native` | `ria_independent` | `advisor_tools`
- Primary region(s): `us` | `uk` | `eu` | `apac` | `global`

**Segment classification rules (strict):**
- Large US advisor-network broker-dealers → `wirehouse`
- HNW/UHNW focused globally, whether standalone or bank division → `global_private_bank`
- Dominant in home region, full-service banking + wealth → `regional_champion`
- AI tools used BY advisors (Jump, Nevis, Zocks) → `advisor_tools`, NOT `ai_native`
- AI-native wealth platforms built from scratch → `ai_native`
- When in doubt: ask the user, do not guess

---

## Step 2 — Research Each Capability Dimension

For each of the 7 dimensions, WebFetch evidence before rating. Do not rate from memory.

| Dimension | What to look for |
|-----------|-----------------|
| `advisor_productivity` | Meeting notes AI, CRM automation, call summaries, proposal generation |
| `client_personalization` | Hyper-personalization, next-best-action, life event detection |
| `investment_portfolio` | AI-driven model portfolios, factor models, rebalancing automation |
| `research_content` | AI-generated market commentary, research summaries, content tools |
| `client_acquisition` | AI prospecting, lead scoring, digital onboarding |
| `operations_compliance` | RegTech, KYC/AML automation, surveillance, risk monitoring |
| `new_business_models` | New revenue streams enabled by AI (not just internal efficiency) |

For each dimension, fetch at least one source. Record:
- What they're doing (specific product or initiative)
- Where the evidence came from (URL + date)
- How broadly it's deployed

---

## Step 3 — Rate Maturity for Each Dimension

Use these definitions exactly. Do not upgrade based on press releases alone.

| Level | Definition | Evidence required |
|-------|-----------|-------------------|
| `scaled` | Live, widely deployed, measurably impacting business outcomes | Firm-wide rollout confirmed, metrics published |
| `deployed` | Live in production, adoption partial or regional | Confirmed live but limited scope |
| `piloting` | Testing with select users, not broadly available | Pilot program confirmed |
| `announced` | Publicly committed, not yet in production | Press release or executive statement |
| `no_activity` | No public evidence of any activity | Absence of evidence after search |

**Rating discipline:**
- A press release = `announced` maximum, not `deployed`
- "Rolling out to advisors" without deployment metrics = `deployed` at best, probably `piloting`
- "Exploring" or "evaluating" = `announced` at best
- Nothing found after searching = `no_activity` — do not infer from industry trends

---

## Step 4 — Write the Competitor JSON

```json
{
  "id": "company-name-slug",
  "name": "Exact Company Name",
  "segment": "[one of the 7 segments]",
  "regions": ["us"],
  "color": "#HEX",
  "ai_strategy_summary": "2–3 sentences. What is their overall AI approach and priority?",
  "headline_metric": "[AI metric leads] · [scale context follows]",
  "headline_initiative": "The single most significant AI initiative underway",
  "overall_maturity": "[scaled | deployed | piloting | announced | no_activity]",
  "capabilities": {
    "advisor_productivity": {
      "maturity": "[level]",
      "headline": "One sentence describing what they're doing",
      "detail": "2–3 sentences with specifics",
      "evidence": ["Source name — date — URL or description"],
      "jpm_implication": "What does this mean for JPMorgan's competitive position?",
      "jpm_segments_affected": ["JPMWM"],
      "date_assessed": "YYYY-MM-DD"
    }
  },
  "last_updated": "YYYY-MM-DD"
}
```

**headline_metric formula:** `[specific AI metric] · [scale context]`
Examples: `500,000 advisors using AI tools · Largest deployment in wealth management` or `$2.1T AUM on AI-personalized portfolios · Deployed across 12 markets`

**For dimensions with no evidence:** Set `maturity: "no_activity"` and `headline: "No public evidence of activity in this area"`. Do not omit the dimension.

---

## Step 5 — Logo

Check if a local logo exists: `data/logos/{company-id}.svg` or `.png`

If not:
- Search for the official logo (SVG preferred)
- Download to `data/logos/{company-id}.svg`
- **Never use clearbit, unavatar, or any external logo URL** — the clearbit/unavatar hook will alert if you try

If you cannot find a suitable logo, leave the logo out and note it for the user.

---

## Step 6 — Confirm with Haresh

Show the summary:
```
Company: [name]
Segment: [segment]
Overall maturity: [level]
Capabilities rated: 7/7
Key capability: [strongest dimension] — [maturity]
Weakest area: [dimension] — no_activity / announced
Logo: ✅ found / ⚠️ missing
```

**Wait for confirmation before saving.**

---

## Step 7 — Save and Commit

1. Save to `data/competitors/{id}.json`
2. Read it back to verify structure
3. Commit to `intake` branch:
   ```bash
   git add data/competitors/{id}.json
   git add data/logos/{id}.svg  # if logo was added
   git commit -m "Add landscape company: {name}"
   git push origin intake
   ```

---

## Step 8 — Update Memory and Counts

- Increment landscape company count in `project_living_intelligence.md`
- Note the company and segment added
- If this is a segment's first company, note that too

---

## Non-Negotiable Rules

- **Never rate a capability without fetched evidence from this session**
- **A press release alone is never `deployed` — maximum `announced`**
- **`overall_maturity` must reflect the strongest confirmed capability — not aspirational**
- **All 7 dimensions must be rated** — use `no_activity` for gaps, never omit
- **Never use external logo URLs** — local files only
