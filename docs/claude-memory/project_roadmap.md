---
name: Living Intelligence — Master Roadmap
description: All pending and in-progress work across intake, portal, editorial studio, public site, and authentication. Updated every session.
type: project
---

# Living Intelligence — Master Roadmap
**Last updated: 2026-04-06 (session 22 — auth deployed + KB Phase 1+2 complete)**

This is the single source of truth for all pending work. Every session: check this first, update this last.

---

## ✅ COMPLETED (2026-03-26–29 — session 10, full)

- **Publisher.js bug fix:** default branch was `dev` (old name, doesn't exist) → changed to `main` for content, `intake` for state files
- **Pipeline v3 — scoring, discovery, paywall, UX overhaul:**
  - Scorer: REVIEW threshold 60→45, Tier 1 paywall premium (+10), strategic signals in Dim D (CEO/board +8/+5), tracked company floor 30→60 days
  - Discovery: 5 new L1 queries (CEO interviews, M&A, regulation, earnings calls, conferences) — total ~62 queries/run
  - Paywall bypass: multi-query fallback when headline search finds <3 results
  - Governance: the_so_what excluded from verification + fabrication-strict. Press release wires never paywalled.
  - Company slug alias map (25+). Auto-resolve logos in publisher.
  - DATA_DIR fix across 9 agents
  - gov-store: `addBlocked()` now stores title + score metadata
- **Editorial Studio:**
  - Tab switching changed from unmount to display:none — SSE streams + state survive tab switches
  - Global process tracker with pulsing indicator in header
  - TL candidate cards show source org badge + publication date
  - Blocked panel: shows title, source domain, date, "NEAR MISS" badge, sorted newest first
  - Phase 5 Pipeline Control complete
- **Portal:**
  - Search bar with company autocomplete on intelligence page
  - "Why it matters" (the_so_what) displayed on intelligence cards
  - Auto-rotate featured story (most recent = lead, `featured` flag removed)
  - Company profile page redesigned
  - Disclaimers (securities, liability, AI disclosure, trademarks, corrections)
  - CTA buttons added
  - Approve button fix (`{ method: 'POST' }`)
- **Landing page live at livingintel.ai**
- **Content:**
  - All 43 the_so_what rewritten (analytical insight, no CXO directives)
  - DBS + Zocks duplicates removed. Company-date proximity dedup added.
  - 7 slug mismatches fixed. 3 entries re-verified.
- **Quality infrastructure:**
  - config.js shared config (single source of truth for paths/thresholds)
  - 119 unit tests across 13 suites
  - 7 smoke tests (smoke-test.js)
  - Pre-push test hook
  - Humanizer skill + AI patterns hook installed
- **Deployment confusion fixed:** Portal UI → `main`, intake server → `intake`. All docs updated.

---

## ✅ COMPLETED (2026-03-26 — session 9 final)

- **System architecture formalised:** `reference_system_architecture.md` written — complete four-layer system map (CLAUDE.md/Memory/Skills/Hooks), what each layer owns, interaction model, failure mode analysis, maintenance rules, new-vertical replication guide
- **CLAUDE.md cleaned up:** Track 2 procedural rules removed (now in /add-entry skill). Content Standards reduced to Prime Directive principle + pointer. No more duplication.
- **Memory workflow files cleaned up:** `feedback_content_quality.md` — kept incidents/WHY, stripped procedure (now in skill). `feedback_editorial_standard.md` — kept three-layer framework + examples, stripped procedure.
- **Skills enriched:** `add-entry.md` — added the_so_what strong examples + number freshness rules from editorial standard memory. Now fully self-contained.
- **Single source of truth per workflow:** Each content action has exactly one owner — its skill file. CLAUDE.md and memory contain no duplicate procedure.

## ✅ COMPLETED (2026-03-26 — session 9 continued)

- **6 custom skills built** — complete workflow enforcement for every content action:
  - `/add-entry` — mandatory WebFetch → claim extraction → schema → confirm key stat → commit
  - `/add-company` — research all 7 dimensions with evidence → maturity rules → logo → confirm
  - `/add-tl` — verbatim quotes only → quality gate → confirm → commit to main
  - `/catchup` — session start: roadmap + Railway health + inbox summary
  - `/audit` — full content quality sweep: entries, landscape, TL, broken URLs, count reconciliation
  - `/new-vertical` — complete setup checklist for any new vertical (user-level, reusable)
- **Skills wired into CLAUDE.md, MEMORY.md, feedback_working_style.md** — Claude now invokes skills for content actions rather than reconstructing workflows ad-hoc
- **Stop hook removed** — was firing after every turn, not just session end. Removed from settings.json.
- **Irrelevant financial-services plugins removed** from `~/.claude/settings.json`

## ✅ COMPLETED (2026-03-25 — session 9 continued)

- **Claude Code hooks — deterministic guardrails (replacing memory-only rules ~70% → 100%):**
  - `~/.claude/hooks/check-push-main.sh` — PreToolUse Bash: previously blocked pushes to main; now allows (portal changes MUST go to main)
  - `~/.claude/hooks/pre-commit-checks.sh` — PreToolUse Bash: blocks `git commit` if staged .js files fail `node --check` or staged client .ts/.tsx files fail `tsc --noEmit`
  - `intake-server/.claude/hooks/node-syntax-check.sh` — PostToolUse Write|Edit: alerts on .js syntax errors after every file write
  - `intake-server/.claude/hooks/tsc-check.sh` — PostToolUse Write|Edit: alerts on TypeScript errors after every .ts/.tsx write
  - `~/.claude/hooks/check-banned-urls.sh` — PostToolUse Write|Edit: alerts if clearbit/unavatar URLs written to any `data/` JSON file
  - All hooks pipe-tested and validated with `jq -e`. Push-to-main hook proved live (fired immediately).

## ✅ COMPLETED (2026-03-25 — session 9)

- **Railway deploy:** `feature/studio-react` merged → `intake` → pushed → Railway `proud-reflection` auto-deployed. Fixed `SyntaxError: entryCompanyId already declared` in `scheduler.js` (duplicate `const` at lines 151+280 — merged into single normalised declaration at 151). Server now starts cleanly.
- **StoryCard score null fix:** `score !== undefined` → `score != null`; null score renders as `—` in grey instead of blank space. (Jump article hit 403 so scorer never ran → score=null.)

## ✅ COMPLETED (2026-03-25 — session 8, continued)

- **Evidence card UI (StoryCard.tsx):** Header badges: score, PASS/REVIEW/FAIL, FAB CLEAN/SUSPECT/FAIL, PAYWALL, FORMAT ISSUES, ALREADY IN LANDSCAPE. Enrichment context block (indigo): what_changed + maturity direction + competitor_gap + landscape_match_notes. Fabrication detail block (amber/red, SUSPECT/FAIL only). Schema Issues block. Normalised flat server format in StoryCard.
- **governance.js tightened:** FAIL = contradicted only (not "appears fabricated"). Paywall short-circuit: sourceLen<300 → REVIEW immediately, no Claude call. `human_approved: false` + `approved_at: null` on short-circuit return. `verified_at` on all return paths.
- **fabrication-strict.js tightened:** Check 3 = year only (not full date in body — was noisy). Check 6 added: numbers_in_so_what. check_details now has 6 keys. Updated stale comment.
- **scorer.js Dimension E:** `scoreCXORelevance()` rule-based 0–10. Forbidden phrases (−3), company name absent (−2), >60 words (−1). Metric (+2), comparative (+2), decision language (+2). weak≤4 → PUBLISH downgrade to REVIEW (never BLOCK). formatScoreBreakdown includes `CXO: X/10 ⚠`. `classifySource()` exported as utility.
- **context-enricher.js cross-reference:** `crossReferenceCheck()` reuses already-loaded competitor file (zero extra I/O). `landscape_already_covered` + `landscape_match_notes` on ALL return paths. `MATURITY_RANK` + `EVIDENCE_STAGE_TO_MATURITY` exported for testing.
- **Test suites 6–9 added:** 102/102 passing. Suite 6: format-validator (13 tests). Suite 7: Dimension E via scoreEntry (6 tests). Suite 8: crossReferenceCheck pure (10 tests). Suite 9: governance paywall short-circuit (5 tests). Suite 1 updated: perfect score test now includes strong the_so_what.
- **ErrorBoundary:** Added to `main.tsx` — renders error message instead of blank page on render crash.
- **StoryCard crash fix:** Server returns flat format (`_entry` not `entry`, governance fields at top level). StoryCard now normalises both formats. `gov.unverified_claims ?? []` guards throughout.

## ✅ COMPLETED (2026-03-25 — session 8, earlier)

- **React Studio (Vite + React + TypeScript + Tailwind v4):** Full rebuild of Editorial Studio as React app at `intake-server/client/`. Vite dev server at port 5173, proxies API to 3003. Build outputs to `intake-server/public/`. All 4 tabs functional: Intelligence, Thought Leadership, Landscape, Data Audit.
- **3 new pipeline agents:** `format-validator.js` (pure rules, 9 checks, zero API cost) · `fabrication-strict.js` (dedicated Claude pass, CLEAN/SUSPECT/FAIL, 12k window, hard block on FAIL) · `context-enricher.js` (enriches the_so_what with last 3 entries + landscape maturity + peer competitors — non-fatal fallback)
- **Bug fix — unavatar.io:** `intake.js` INTAKE_SCHEMA now sets `image_url: null` instead of unavatar.io placeholder (was causing broken images on all pipeline entries)
- **Bug fix — governance source window:** `governance.js` source window 6k → 12k characters (double coverage)
- **UI fixes:** Blocked sub-tab added with BlockedPanel · clickable KPI cards navigate to sub-tabs · KPI colors grey at zero / colored when non-zero · "Last run" shows real date from `last_run_at` field
- **Auto-approve permissions:** `~/.claude/settings.json` `permissions.defaultMode` = `bypassPermissions` — no more tool call prompts
- **scheduler.js updated:** All 3 new agents integrated — Step 1b (enrich), Step 2a (format), Step 2c (fabrication hard block)

---

## ✅ COMPLETED (2026-03-24 — session 7, continued)

- **Railway Volume:** Added persistent volume to `proud-reflection` at `/data`, set `DATA_DIR=/data` — blocked URLs and state now survive redeploys
- **Decimal sentence splitter fix:** Portal `FormattedSummary` was splitting on periods inside numbers ($14.00 → showed "00 per share"). Fixed regex to preserve digit.digit. Wealthfront entry also patched.
- **Workflow agreed:** Railway = production editorial studio. Local = dev only.

## ✅ COMPLETED (2026-03-24 — session 7, earlier)

- **discovered_at + date-grouped inbox:** Every pending item gets `discovered_at` timestamp. Inbox groups stories by discovery date (TODAY / YESTERDAY / date). `archiveStaleItems()` moves items >7 days to `.governance-archive.json` on each load.
- **7-day archive:** `GET /api/inbox/archive` endpoint. "Show older →" link at bottom of inbox loads archived items in read-only compact view.
- **Instant inline reject:** Replaced modal with slim inline red bar on the card itself. Reason dropdown + Confirm button. Card vanishes immediately on confirm, page scrolls to Recent Activity.
- **TL quality gate fix:** `tl-publisher.js` now falls back to `author_organization` when `author_name` is null — BCG/McKinsey/institutional reports pass without error.
- **BCG AI Radar 2026 TL entry:** "As AI Investments Surge, CEOs Take the Lead" — Christoph Schweizer (CEO, BCG) · Jan 15 2026. Written directly (Jina can't fetch BCG). Pushed to `main`. Portal now has 7 TL entries.
- **Superpowers framework explored:** https://github.com/obra/superpowers — agentic dev workflow, reference saved in memory.

---

## ✅ COMPLETED (2026-03-24 — session 6)

- **Editorial Studio v3 redesign:** Two-tier header (#1C1C2E + #141420) matching portal, FT cream body, single nav bar (Intelligence · Thought Leadership · Landscape · Data Audit). Discover moved inside Intelligence as sub-tab.
- **Thought Leadership tab:** Run TL Discovery button, candidate cards (Approve as TL / Dismiss), Published list. `agents/tl-discover.js` — L1 TL queries + L2 known authors via Jina, persists `.tl-candidates.json`.
- **New API routes:** POST /api/tl-discover, GET /api/tl-candidates, POST /api/tl-candidates/dismiss, GET /api/tl-published, GET /api/activity-log
- **7-day activity log:** Below inbox in Review tab — date-grouped approved/rejected rows with pills. Refreshes after every action.
- **Pipeline cron:** 6am → 5am UK time (Europe/London)
- **Reject flow:** Story disappears after modal confirm + activity log updates immediately

---

## ✅ COMPLETED (2026-03-24 — sessions 3–5)

- Landscape maturity audit (4 over-claims corrected)
- Phase 6a/6b/6c: Post-publish landscape trigger, staleness sweep, Landscape tab in Editorial Studio
- TL approve-in-studio workflow (`agents/tl-publisher.js`)
- JPMorgan 2026 Company Update — competitor file fully updated
- headline_metric standardised across all 37 companies
- 7 European companies added to landscape
- Guardrails audit (42 entries)

---

## ✅ COMPLETED (2026-03-30 — session 11)

- **Multi-source intelligence (Phase 1):** Enrichment URLs captured in entry.sources array with type classification (primary/coverage/discovery). Scorer +3/+5 bonus for multi-source. Portal shows "Sources (N)" with PRIMARY badge on article detail pages.
- **process-url endpoint fixed:** Was bypassing scoring AND dedup entirely. Now runs full scoring + URL dedup.
- **TL publish URL dedup:** Prevents duplicate TL entries.
- **Pre-push hook:** Now covers both main (next build) and intake (tests+smoke).

## ✅ COMPLETED (2026-03-31 — session 12)

- **Multi-source backfill:** Top 10 intelligence entries now have 3-7 verified sources each with type classification.
- **NewsAPI.ai integration:** Layer 3 discovery (Event Registry, 80K+ sources, 4 queries). Live-tested, queries tuned. NEWSAPI_KEY on Railway.
- **Source count badges:** Homepage lead story, featured grid, and intelligence feed show "N sources" pill.
- **Blocking doc-update hook:** `enforce-doc-updates.sh` — commits with agent code but no docs/ staged are blocked.
- **Compact reminder hook:** `compact-reminder.sh` — fires every 40 edits to remind about compaction.
- **BofA landscape updated:** advisor_productivity now reflects AI Meeting Journey deployment (was stale at Ask Merrill).
- **add-entry skill updated:** Template now includes sources array.
- 126/126 unit tests, 7/7 smoke tests.

---

## ✅ COMPLETED (2026-04-01 — session 13)

- **Pipeline robustness — 4 auto-fix gaps closed:**
  - publisher.js: auto-corrects `week` to Monday of article date (was silently wrong, flagged but ignored)
  - publisher.js: auto-resolves company logo from `public/logos/` (path bug fixed: was `data/public/logos` → now uses `LOGOS_DIR`)
  - publisher.js: strips unavatar.io URLs, replaces with local logo or null
  - intake.js: post-structuring enrichment — after Claude identifies company/topic, runs targeted Jina searches for press releases + coverage (only fires when initial enrichment found ≤1 source)
  - format-validator.js: the_so_what quality gate — flags run-on sentences >50 words, total >80 words, generic/directive phrases
- **Fortune/McKinsey market signal entry improved:** Fixed week, added Yahoo Finance as 2nd source, set Robinhood logo, tightened the_so_what
- **AI patterns hook replaced:** Slow prompt-type hook (LLM call on every edit, ~2-3s) → fast shell script (~10ms, only checks data files)
- **Pipeline confirmed working:** 5am cron picked up Fortune article automatically via discovery layers, processed it, user approved in Editorial Studio
- 135/135 unit tests (9 new), 7/7 smoke tests

---

## ✅ COMPLETED (2026-04-02 — session 13 day 2)

- **TL publisher fixed:** Railway mode now uses clone-main-into-temp pattern (was failing silently with ENOENT)
- **TL listing endpoint fixed:** /api/tl-published handles missing directory gracefully
- **server.js DATA_DIR cleanup:** Removed standalone DATA_DIR, now imports CONTENT_DIR/INTEL_DIR/TL_DIR from config.js (single source of truth)
- **Portal "Updated" date:** Now shows build date (today), not most recent article date
- **Landing page major rewrite (on feature/landing-page, stashed):**
  - Existential hook: "The wealth management business model is being rewritten. Right now."
  - Sticky section nav, 5-step pipeline visual, source verification callout
  - 3 intelligence cards + BofA AI strategy deep-dive + TL card
  - Rich matrix with cell content, coverage as classification framework
  - Pricing: $4,500/$5,000 annual, 5 users per firm
  - NEEDS: Haresh final review + push
- **Content quality audit completed:** 37% STRONG / 40% ADEQUATE / 23% WEAK
  - Full report at `docs/content-quality-audit.md`
  - McKinsey Test checklist (6 gates), editorial voice guide, weakest entries identified
- **Memory enforcement hooks working:** Post-commit reminder + pre-push blocker both firing correctly

---

## 🔴 IMMEDIATE — BEFORE touching landing page

### 1. Multi-agent content pipeline v2 — ✅ ALL COMPLETE
- Full plan at `docs/session-by-session-plan.md` (Sessions 14-19)
- **Session 14-16:** Research Agent, Writer Agent (Opus), Evaluator Agent (McKinsey test), Fabrication Agent v2, Content Producer orchestrator.
- **Session 17:** All 43 intelligence entries upgraded to v2 quality (41 multi-source).
- **Session 17b:** All 37 landscape profiles upgraded (7/7 capabilities, 322 source references).
- **Session 18:** Attribution discipline audit (JPMorgan, Lloyds, Santander, BofA fixes). no_activity UI.
- **Session 19:** Content Quality Audit — all 6 phases complete. Three Questions framework applied to all 43 entries + 37 profiles. 16 landscape profiles fixed. Build passes (97/97 pages). All content CIO-ready.

### 2. Content cleanup (from audit) — ✅ COMPLETE
- ✅ DBS duplicate deleted (dbs-worlds-best-ai-bank)
- ✅ HSBC rewritten + key_stat populated
- ✅ 6 NULL key_stats populated (Aladdin, Citi, eToro, HSBC, UBS, Vanguard)
- ✅ BofA Meeting Journey conflation fixed
- ✅ BofA Erica $211B over-attribution fixed
- ✅ Altruist circular sourcing removed, FNZ drift + key_stat fixed, DBS attribution fixed
- ✅ 16 landscape profiles fixed (superlatives, causal language, unsourced comparisons, evidence gaps)
- ✅ All 43 intelligence entries + 37 landscape profiles pass Three Questions framework
- REMAINING: Implement McKinsey Test as pre-publish gate

### 3. Landing page enrichment — ✅ DONE (Session 20)
- Branch: `feature/landing-page`, all changes implemented, build passes
- **11 enrichments completed:**
  1. RotatingHeadline: 4 new fear-based + data-proof headlines
  2. Hero sub-headline: rewritten to lead with "consulting-grade standards"
  3. Stats strip: 44→43+, all firm counts use "37+", "Discovery Queries"
  4. Why Now: added concrete proof points (BofA 3.2B Erica, MS 98%, Altruist 1,600 RIAs)
  5. How It Works: two quality callout boxes (source verification + consulting-grade editorial standards with "six quality dimensions" + "iterative refinement")
  6. What's Inside: added "multi-source corroboration", "evidence-linked", "Venrock"
  7. Intelligence Samples: intro rewritten, count fixed "+40 more"
  8. BofA landscape cell: removed $211B over-attribution, replaced with verified 3.2B/20.6M/700M
  9. Segments: removed fake "Asset Managers", now shows real 7 segments with actual company names
  10. Pricing comparison: strengthened ($75K-$150K range, analyst sub critique)
  11. Final CTA: updated counts + "consulting-grade editorial standards"
- **Secret sauce protected:** quality hints (multi-stage, six dimensions, iterative) without naming agents
- **TL section added to nav** (Why Now → How It Works → Intelligence → Landscape → Thought Leadership → Pricing) as its own section with McKinsey + Venrock/Beim cards
- **Company deep-dive moved** from inside Intelligence to its own section after Landscape (flow: Intelligence → Landscape → Deep-Dive → TL → Built For → Pricing)
- **Headlines + hero rewritten** for fear/urgency positioning; TL description enriched (HBS, Wharton, Mollick)
- **STATS constants** added at top of page.tsx — single source of truth for all numbers (firms, entries, capabilities, queries). No more drift.
- **Pipeline depth stats** added to How It Works: 15+ specialised systems, 6 quality dimensions, 300+ source references, 2 refinement iterations — broad numbers, no agent names
- **Sticky "Request access" CTA** — fixed bottom-right pill, always visible on desktop
- **Favicon:** W → LI
- **Status:** Committed + pushed to `feature/landing-page` → Railway deploys to livingintel.ai

### 4. Subscription stack
- Stripe (annual billing) + Supabase Auth (team seats) + Iubenda + Google Workspace

---

---

## ✅ COMPLETED — Public Website (livingintel.ai)

Branch: `feature/landing-page` | Service: `profound-wonder` | Domain: `livingintel.ai`
- Live with rotating headlines, platform section, landscape coverage, sample entry, pricing ($400/mo founding)
- Humanized copy. Needs mobile testing and Stripe integration later.

---

## 🟡 NEXT — Push Unified Auth + Test Stripe (Session 22, remaining)

- ✅ Auth files built, unified /login (no /register), onboarding rewritten
- ✅ Railway env vars set (7 vars on profound-wonder)
- ✅ Committed locally (7cd045d) — needs push to feature/landing-page
- REMAINING: push, set up Stripe webhook, create Haresh's org, test full flow
- See `project_supabase_unified.md` for full auth architecture

---

## 🔵 FUTURE

### Telegram digest revamp
- Single summary message + link to Editorial Studio

### Intelligence Feed
- "Latest wins" dedup rule (most-recent-per-company)
- Improve source quality for advisor_tools companies

### Telegram
- Morning digest revamp: single message with summary + link to Editorial Studio

---

## DATA INTEGRITY RULES

1. Date = original article date (not approval date)
2. Latest wins — use most recent source for companies with multi-year coverage
3. One entry per milestone
4. human_approved: true only on directly-written or pipeline-approved entries
5. WebFetch every source before writing any claim
6. Cite exact location in verified_claims
7. headline_metric formula: `[AI metric leads] · [scale context follows]`
8. NEVER attribute broad business metrics (revenue, sales growth, AUM) to specific AI tools unless the source explicitly makes that causal claim — see `feedback_attribution_discipline.md`

---

### 5. Unified Supabase — Auth + Subscriptions + KB (Session 20 designed, Session 21 built)
Full plan at `project_supabase_unified.md`. Single Supabase project for all three needs.

**Auth (Session 21 — BUILT, local only, not deployed):**
- Supabase project: Pro tier, Micro compute, Europe, org "Curiosity AI"
- Google OAuth: fully configured (Google Cloud + Supabase)
- Stripe: sandbox, 2 products ($4,500/$5,000), FRIEND2026 coupon (100% off, 1 month, 20 max)
- 14 tables created (2 auth + 8 KB + 4 engagement + pending_invites)
- 10 auth files: middleware, login (3 methods), join, onboarding, checkout, webhook, callback, signout
- PostHog snippet (needs NEXT_PUBLIC_POSTHOG_KEY)
- Google OAuth tested + working (user created in DB)
- NOT YET: deployed to main, Stripe checkout tested, full end-to-end flow

**KB (Session 22 — COMPLETE):** kb-client.js built (12 helpers). Backfill run: 265 sources (264 full Jina content, 609K words), 51 published entries, 37 landscape profiles, 41 companies, 91 editorial decisions. All entry↔landscape relationships linked. See `project_knowledge_base.md`.

### 6. Knowledge Base + V2 Pipeline + Recommendations — PLANNED (Session 20)
Full plan at `project_knowledge_base.md` + `/Users/haresh/.claude/plans/scalable-fluttering-cake.md`.

**KB stores the FULL picture (not just raw sources):**
- Raw sources (articles, press releases — full markdown + embeddings)
- Published entries (headline, summary, the_so_what — what we wrote)
- Landscape profiles (AI strategy, capabilities — competitive context)
- Editorial decisions (approve/reject + reasons — persona training)
- All linked by company_id — intelligence ↔ landscape ↔ sources

**Recommendations (portal reads from KB):**
- "You might also be interested in..." on article + landscape pages
- Same company entries, same capability across competitors, vector similarity
- Portal already has Supabase connection (auth) — zero extra infra

**V2 Pipeline:**
- Tier 1 (5am): Discovery → research-agent stores in KB → triage
- Tier 2 (CLI): `node content-producer.js --top 5` → hydrate from KB → write → evaluate → refine → inbox
- Writer pulls: prior entries + landscape profile + raw sources + editorial decisions — full institutional memory

**Status:** Builds on same Supabase project as auth. KB tables created in Session 21 alongside auth tables.

---

## SEQUENCE

```
SESSION 21 (COMPLETE — 2026-04-05):
  ✅ Supabase project created (Pro tier, Micro compute, Europe, org "Curiosity AI")
  ✅ Google OAuth configured (Google Cloud project + Client ID/Secret in Supabase)
  ✅ API keys in .env.local (Publishable=anon, Secret=service_role)
  ✅ URL Configuration saved (Site URL: livingintel.ai, 3 redirect URLs)
  ✅ Stripe account created (sandbox, 2 products, FRIEND2026 coupon 100% off / 1 month / 20 max)
  ✅ Stripe price IDs in .env.local
  ✅ Auth files built (middleware, login, join, onboarding, callback, signout, checkout, webhook)
  ✅ Supabase client libs (browser + server + admin)
  ✅ PostHog snippet in layout (needs NEXT_PUBLIC_POSTHOG_KEY)
  ✅ DDL written at supabase/schema.sql (14 tables + indexes + RLS + triggers + functions)
  ✅ Build passes clean (all auth routes compile)
  ✅ DDL run in Supabase SQL Editor (14 tables + indexes + RLS + triggers + functions)
  ✅ Google OAuth working (user created in auth.users + user_profiles)
  ✅ All docs audited + multi-session plan created (Sessions 22-26)

SESSION 22 (IN PROGRESS — 2026-04-06):
  ✅ Deployment architecture decision: livingintel.ai = full product, wealth.tigerai.tech = frozen (JPM)
  ✅ Merged main into feature/landing-page (43 entries, 37 profiles, all v2 content)
  ✅ Auth + Stripe code merged into feature/landing-page
  ✅ Middleware updated: landing page (/) is public, portal pages behind auth
  ✅ scheduler.js duplicate const fix (normalizedCompanyId)
  ✅ Railway env vars set on profound-wonder (7 vars: Supabase + Stripe)
  ✅ Pushed + deployed to livingintel.ai (3 commits: auth, CTA wiring, registration)
  ✅ Pricing redesign: single box (founding $4,500/yr, rate locked for life, "after 50 firms → $5,000")
  ✅ Registration v1→v2→v3: iterated from confusing 3-step → single unified /login (email + Google, no passwords)
  ✅ /register DELETED. One page (/login) handles new + returning users automatically.
  ✅ Onboarding redesigned: profile completion (name + company) → team invites (4 slots) → checkout if no org
  ✅ Middleware: checks profile complete (name+company) + org exists + org active
  ✅ Landing page: nav has "Sign in" + "Register" buttons. CTAs = "Register now". All → /login.
  ✅ Checkout route accepts tier param (founding/standard → correct Stripe price)
  ✅ handle_new_user trigger updated to capture company from metadata (run in Supabase SQL Editor)
  ✅ Unified auth committed + pushed (7cd045d)
  ✅ Nav fixes: Sign in white, CTAs consistent, mobile nav (3b2dfaf)
  ✅ Landing page redesigned: two-tier nav (masthead + section links), compacted centred hero, 4 fear-based rotating headlines, scroll-mt-24 anchors. Committed + pushed.
  ✅ KB Phase 1: @supabase/supabase-js installed, kb-client.js built (12 helpers), backfill-kb.js seeded verticals/companies/sources/editorial_decisions
  ✅ KB Phase 2: Merged main→intake (v2 data). backfill-kb-v2.js — Jina fetched 264 full articles (609K words). 51 published entries, 37 landscape profiles, 39 entry↔landscape links. Verification: 27/28 checks pass.
  ⬜ Set up Stripe webhook endpoint (livingintel.ai/api/webhooks/stripe) — PARKED
  ⬜ Create Haresh's org in Supabase (manual SQL) — PARKED
  ⬜ Test full flow on livingintel.ai — PARKED

SESSION 23:
  1. Deploy auth to livingintel.ai:
     - Merge landing page + portal into one app on livingintel.ai (or point livingintel.ai to main)
     - Set env vars on Railway (Supabase + Stripe keys)
     - Set up Stripe webhook endpoint (livingintel.ai/api/webhooks/stripe)
     - Test full flow on live domain: landing page → checkout → Google login → onboarding (5 emails) → portal
  2. Stripe checkout end-to-end:
     - Test paid checkout ($4,500 sandbox) → webhook → org created → admin profile linked
     - Test friend checkout (FRIEND2026 coupon) → no card → org created → access for 1 month
  3. Team onboarding flow:
     - Admin enters 5 team emails → pending_invites created
     - Team member signs up → auto-linked to org via trigger
     - Team member sees portal content
  4. Login page polish (based on Haresh feedback)

SESSION 23:
  1. Legal pages (Iubenda: Terms of Service, Privacy Policy, Cookie Policy — ~$29/yr)
  2. Google Workspace (hello@livingintel.ai) — professional email for support/welcome
  3. Welcome email via Stripe (on checkout.session.completed)
  4. Signout button in portal header

SESSION 23:
  KB Phase 3 — Wire Research Agent to KB + Principle 1 (Store Raw)
  1. intake.js: call storeSource() BEFORE Claude structuring (raw content hits DB first)
  2. Build full research-agent.js (fetch → store → entity extract → multi-source search → store each → build brief → persist)
  3. kb-client.js: add hydrateBrief(), getCompanyContext()
  4. Test on 3 URLs (wirehouse, fintech, regulatory). Verify sources in Supabase before entries created.

SESSION 24:
  KB Phase 4 — Pipeline Integration + Principle 8 (Observe Everything)
  1. scheduler.js: call research() for ENRICH candidates, logPipelineRun()
  2. Create pipeline_events table + logPipelineEvent() in kb-client.js
  3. Add event logging to EVERY agent (writer, evaluator, fabrication, scorer, intake)
  4. Fallback: if KB unavailable, v1 path still works

SESSION 25:
  KB Phase 5 — Editorial Capture + Principle 9 (Overrides = Training Data)
  1. approve-and-publish route: logDecision() with full draft_snapshot + evaluator_score
  2. reject-with-reason route: logDecision() with reason + draft_snapshot
  3. Editorial Studio UI: optional editor notes on approve, required reason on reject

SESSION 26:
  Principle 3 (Version Prompts) + Principle 7 (Idempotent Pipelines)
  1. Create intake-server/prompts/ directory (writer-v1.md, evaluator-v1.md, fabrication-v1.md, entity-extraction-v1.md)
  2. Modify each agent to load prompt from versioned file, log prompt_version in pipeline events
  3. Add content_hash to sources table (detect content changes on re-fetch)
  4. publisher.js: check published_entries before inserting (prevent double-publish)

SESSION 27:
  Vector Embeddings + Semantic Search
  1. generate-embeddings.js: batch Jina embeddings-v3 for all ~350 rows where embedding IS NULL
  2. kb-client.js: add searchSimilar(text, opts) using match_content RPC
  3. Wire into research-agent: pull semantically similar sources from KB during research

SESSION 28:
  Content Producer CLI + End-to-End Test
  1. Build content-producer.js (research → hydrate → write → evaluate → refine → fabrication → score → inbox)
  2. CLI: --url, --brief, --top N, --status
  3. server.js: POST /api/v2/produce, GET /api/v2/briefs, GET /api/v2/kb/stats
  4. Test 3 fresh URLs — verify all 10 principles enforced in one pipeline run

LATER:
  - Auth: Stripe webhook, Haresh's org, test full flow — PARKED
  - Telegram digest revamp
  - Stripe live mode (switch from sandbox when ready to charge)
  - PostHog setup (create account, add key)
  - API access as premium tier
  - Recommendations ("Related reading" on article pages, powered by vector search)

DROPPED:
  - SEC EDGAR — not needed. Press releases + trade press + NewsAPI cover the announcement surface.
```
