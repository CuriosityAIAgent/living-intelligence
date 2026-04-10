---
name: Landscape source URLs must be verified and displayed
description: Every landscape capability source URL must be live (no 404s) and displayed on the company detail page. This is a $5,000/year product.
type: feedback
---

# Landscape Source URLs — Zero Tolerance for Broken Links

Every source URL in every landscape capability must be verified before going live. No 404s, no page-not-found errors.

**Why:** User said "there is no compromise on the quality... why are we going to be able to charge that 5,000?" A broken URL destroys credibility instantly. This is the same standard as the intelligence feed where we verify every source_url.

**How to apply:**
1. During profile writing: WebFetch every source URL before including it
2. After batch processing: run a sweep that checks every URL in every capability's sources array
3. On the portal: sources already display on company detail pages (lines 136-148 of competitors/[slug]/page.tsx)
4. Fix needed: `no_activity` capabilities have rich detail+evidence+sources in v2 but the portal currently hides them behind a grey label-only section. Need to render them as full cards too.
5. Fix needed: `CapabilityEntry.maturity` type allows `'none'` but not `'no_activity'` — update the type.

**Portal changes needed for landscape v2:**
- Update `CapabilityEntry` maturity type to include `'no_activity'`
- Render no_activity capabilities as full cards (with grey styling) showing detail, evidence, sources
- Add maturity color for no_activity: grey border, grey badge
