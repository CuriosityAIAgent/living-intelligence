# Landscape v2 Execution Plan — Every Company to McKinsey/BCG Quality

## What Made Intelligence v2 Successful

The intelligence v2 pipeline (Sessions 14-17) produced consulting-grade entries because:

1. **Multi-source research** — not one article, but 5-10 sources per entry
2. **Full source text** — no compression, every word available for verification
3. **WebSearch + WebFetch** — Claude Code Max searched the web independently when pipeline sources were thin
4. **Iteration** — v1 draft → evaluate → refine → v2 draft. Quality improved substantially on iteration 2
5. **Fabrication checking** — every claim traced to a source
6. **Human review** — Haresh reviewed output before it went live

The landscape pipeline must match or exceed this rigour. Landscape is the most important part of the platform.

## The Problem With What We Just Did

We started writing profiles from research briefs that sometimes had:
- Zero articles fetched (BofA came back with `confidence: "low"`)
- Only 2-3 Jina search results (often investment strategy pages, not AI strategy)
- No independent web verification of claims

This is not McKinsey quality. A McKinsey engagement would:
1. Read every primary source (annual reports, investor days, press releases)
2. Cross-reference with industry coverage (trade press, analyst reports)
3. Verify every metric against the original disclosure
4. Position each company relative to specific named peers with specific metrics

## The Comprehensive Research Process (Per Company)

### Stage 1: Research Brief (automated, via landscape-research-agent.js)
- Load our intelligence entries about this company
- Load TL entries mentioning this company
- Load current profile (what we already have)
- Load peer companies in same segment
- Jina Search: 2 queries for latest AI strategy coverage
- Jina Reader: fetch top 3 results

### Stage 2: Supplementary Research (Claude Code Max — NEW)
This is what was missing. For EVERY company, Claude Code does:

1. **WebSearch** for `"{company name}" AI artificial intelligence wealth management 2025 2026`
2. **WebSearch** for `"{company name}" AI strategy deployment generative`
3. **WebFetch** the most relevant 2-3 URLs that the research brief didn't already capture
4. **WebFetch** the company's newsroom/press page if available (e.g., `newsroom.bankofamerica.com`)
5. **Check our own intelligence entries** — read the full entry JSON for any entries about this company (not just the headline from the research brief)

This ensures every company has 5-10 sources minimum before profile writing begins.

### Stage 3: Profile Writing (Claude Code Max)
With ALL sources assembled, write the profile with:
- ai_strategy_summary: 400-1000 chars, names ≥2 peers with specific metrics
- All 7 capability dimensions
- Every maturity level backed by evidence
- no_activity assessments that explain what's missing and why it matters competitively
- Evidence bullets with source attribution
- Source URLs for every capability

### Stage 4: Two-Step Iteration (MANDATORY — same as intelligence v2)

**This is the process that produced the quality improvement in intelligence entries (scores 7→9).**

**Iteration 1:**
1. Write v1 draft from all research sources
2. Evaluate v1 against the 6-check Landscape McKinsey Test:
   - Strategy depth: ≥400 chars, names ≥2 peers with specific metrics?
   - Capability coverage: all 7 assessed (including no_activity)?
   - Evidence sourced: every bullet has source attribution?
   - Maturity justified: correct level per evidence (scaled needs adoption metrics, etc.)?
   - Competitive context: positioned relative to named peers?
   - Decision grade: would a Head of AI at a competing firm learn something new?
3. If ANY check fails → identify specific failures

**Iteration 2 (if v1 NEEDS_WORK):**
4. Refine v1 with specific evaluator feedback (fix failed checks)
5. Write v2 draft
6. Re-evaluate v2 against all 6 checks
7. v2 must PASS all checks before proceeding

**Metadata tracking:**
Both iterations are recorded in `_landscape_v2.iterations` array with version, evaluation result, and timestamp. This creates an audit trail showing quality improvement.

If any check fails → refine before saving.

### Stage 5: Save + Verify
- Save to /tmp/landscape-v2/{slug}.json
- Verify JSON is valid
- Verify all 7 capabilities present
- Verify strategy summary length and peer mentions

## Execution Approach

### Batch Size: 3-4 companies at a time
- Research briefs gathered in parallel (4 concurrent Jina calls)
- Supplementary research done per company (WebSearch/WebFetch)
- Profile writing via subagents (parallel, 3-4 at a time)
- Quality check after each batch

### Company Priority Order
1. **Wirehouses first** (4): morgan-stanley, bofa-merrill, wells-fargo, jpmorgan — highest visibility on platform
2. **Global Private Banks** (9): ubs, goldman-sachs, hsbc, citi-private-bank, julius-baer, bnp-paribas-wealth, barclays-private-bank, santander-private-banking, societe-generale-private-banking
3. **Regional Champions** (7): dbs, bbva, standard-chartered, rbc-wealth-management, lloyds-wealth, abn-amro-private-banking, st-jamess-place, handelsbanken
4. **Digital Disruptors** (5): robinhood, wealthfront, etoro, public-com, betterment
5. **AI-Native** (2): arta-ai, savvy-wealth
6. **RIA/Independent** (2): altruist, lpl-financial
7. **Advisor Tools** (5): jump-ai, nevis, zocks, holistiplan, conquest-planning

### Quality Gates
- Every profile must have ≥5 source documents read
- Every ai_strategy_summary must name ≥2 specific peers with metrics
- Every maturity level must cite evidence
- no_activity must explain the competitive gap
- Strategy summary must be analytical, not a feature list

### URL Verification (Non-Negotiable)

Every source URL in every capability must be verified live before the profile is saved.

**During profile writing:**
- WebFetch every source URL before including it in the profile
- If a URL 404s → find the correct URL or remove the source
- If a source has moved → update to the new URL
- Prefer permanent URLs: newsroom pages, press releases, annual reports over news articles

**After batch processing:**
- Run a sweep checking every URL in every capability's sources array
- Flag any 404s or redirects for manual correction
- No profile ships with a broken link

## Portal Changes Required

The company detail page needs updates to properly display v2 landscape profiles:

1. **Update `CapabilityEntry` maturity type** — add `'no_activity'` (currently only `'none'`)
2. **Render no_activity capabilities as full cards** — currently they're hidden behind grey labels. v2 no_activity entries have rich detail explaining what the firm is NOT doing and why it matters. This is valuable intelligence.
3. **Add maturity styling for no_activity** — grey border-left, grey badge
4. **Source URLs already display** — lines 136-148 of competitors/[slug]/page.tsx renders them as clickable links (name + ↗). This works as-is.

These portal changes should be done BEFORE pushing the 37 profiles, so the visual review shows the full v2 experience.

## What "Done" Looks Like
- 37 profiles in /tmp/landscape-v2/
- Each with all 7 capabilities (including no_activity with detail+evidence+sources)
- Each with _landscape_v2 metadata
- Every source URL verified (no 404s)
- Portal updated to render no_activity capabilities as full cards
- Visual review on localhost:3002 (start portal, browse landscape pages)
- Only then: copy to data/competitors/, commit, push to main

## Timeline
- This is not a rush job. If it takes 3-4 sessions, that's fine.
- Quality is the only metric that matters.
- Every company must pass the "would a Head of AI at a competing firm find this useful?" test.

## Lessons Learned (Session 17b)

1. **Plan before building.** Jumped into execution without a plan. User had to stop me twice. The plan document should have been FIRST, not mid-session.
2. **Use Max subscription, not API calls.** The intelligence v2 quality came from Max context, not API calls. Same applies to landscape.
3. **Never skip the iteration loop.** Single-pass profiles were worse than v1→evaluate→v2 profiles. The iteration IS the quality.
4. **WebSearch/WebFetch for every company.** Research agent's Jina search is not enough. Supplementary web search found critical sources the automated pipeline missed (e.g., BofA had zero articles from Jina but rich coverage via WebSearch).
5. **Verify URLs before saving.** $5,000/year product cannot have broken links. Check every source URL returns 200 before including it.
6. **Subagents need explicit key constraints.** They invent their own capability taxonomy unless the exact 7 keys are listed AND enforced. Always validate output structure.
7. **Save to safe location.** `/tmp/` gets cleared on reboot. Use gitignored repo directory for staging.

## Completion Status

**Session 17b (2026-04-04): ALL 37 PROFILES COMPLETE**
- 37/37 companies with 7/7 capabilities
- 322 total source references
- Average 880-char strategy summaries
- Stored in `data/landscape-v2-staging/` (gitignored)
- Portal changes ready (no_activity rendering, maturity type)
- NEXT: visual review on localhost:3002, URL verification sweep, push to main

## Files Already Completed (need re-evaluation)
The following were done before this plan was written and may need supplementary research:
- abn-amro-private-banking (done, likely adequate — had strong CMD data)
- altruist (done, likely good — had 6 intelligence entries + 3 articles)
- arta-ai (done, may need supplementary — limited sources)
- barclays-private-bank (done, may need supplementary — articles were mostly investment outlook, not AI strategy)
- bbva (done, likely adequate — had intelligence entry + strong articles)

All 5 should be re-checked against this plan's quality gates before final approval.
