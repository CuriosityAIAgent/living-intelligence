# Key Learnings (updated 2026-04-06)

## Deployment Architecture — CRITICAL
- See `project_deployment_architecture.md` — livingintel.ai is the product, wealth.tigerai.tech is FROZEN (JPM internal, don't touch)

## Living Intelligence Portal
- See `project_living_intelligence.md` — full stack, pipeline, brand, data counts, verified thought leadership list
- Portal: Next.js 16, port 3002, `wealth.tigerai.tech` (FROZEN) / `livingintel.ai` (active) — Intake server: Node.js/Express, port 3003, Railway `proud-reflection`
- Desktop: `/Users/haresh/Desktop/Living Intelligence/living-intelligence/`
- **NAMING CLARITY — "intake" means two different things:**
  - `intake-server/` = a FOLDER inside the repo containing the Node.js backend (agents, pipeline, Editorial Studio). Exists on ALL branches.
  - `intake` = a GIT BRANCH. Railway deploys `proud-reflection` (the Editorial Studio + pipeline server) from this branch.
  - The portal (Next.js, `app/`, `components/`, `lib/`) lives in the REPO ROOT, not in `intake-server/`.
- **DEPLOYMENT MAP (three separate Railway services):**
  - `living-intelligence` service ← `main` branch ← `wealth.tigerai.tech` = THE PORTAL (what executives see)
  - `proud-reflection` service ← `intake` branch ← Editorial Studio + pipeline server (internal tool)
  - `profound-wonder` service ← `feature/landing-page` branch ← `livingintel.ai` (public landing page)
- **WHAT GOES WHERE:**
  - Portal UI changes (anything in `app/`, `components/`, `lib/`, `public/`) → commit + push `main`
  - Pipeline/agent/Editorial Studio changes (anything in `intake-server/`) → commit + push `intake`
  - Published content (approved stories via Editorial Studio) → publisher.js auto-pushes to `main`
- **Versions:** v1.0 (portal launch) · v1.1 (algorithm v2) · v2.0 (Universal Inbox + Editorial Studio)
- **Universal Inbox (v2.0):** NOTHING auto-publishes. All stories go to inbox. Editorial Studio at port 3003.
- **Editorial Studio phases:** Phase 1 ✓ · Phase 2 ✓ · Phase 3 DROPPED · Phase 4 = Block Review · Phase 5 = Pipeline Control · Phase 6a/6b/6c ✓ · v3 redesign ✓ (session 6)
- **Data counts (2026-04-05 session 19):** 43 intelligence entries (41 multi-sourced) · 8 thought leadership · 37 landscape companies · 42 logos
- **Editorial Studio v3 (session 6):** Two-tier header matching portal · Nav: Intelligence · Thought Leadership · Landscape · Data Audit · TL tab with discovery + candidates + published · 7-day activity log in Review tab · 5am UK cron
- **Session 7 additions:** `discovered_at` stamp on all pending items · date-grouped inbox (TODAY/YESTERDAY/date) · 7-day archive with "Show older →" · instant inline reject bar (no modal) · TL quality gate accepts institutional/org-credited reports · BCG AI Radar 2026 added as TL entry
- **Session 8 additions:** React Studio (Vite + React + TS + Tailwind v4) at `intake-server/client/` · 3 new agents: `context-enricher.js`, `format-validator.js`, `fabrication-strict.js` · fixed `intake.js` unavatar.io bug · `governance.js` source window 6k→12k · Blocked sub-tab + clickable KPIs in IntelligenceTab · auto-approve permissions set globally
- **Session 8 continued (2026-03-25):** Evidence card UI complete (fabrication/enrichment/format badges in StoryCard) · governance.js tightened (FAIL=contradicted only, paywall short-circuit <300 chars) · fabrication-strict.js tightened (Check 6 = numbers_in_so_what, Check 3 = year only) · scorer.js Dimension E (CXO relevance, rule-based, weak→PUBLISH downgrade to REVIEW) · context-enricher.js cross-reference (reuses loaded competitor data, zero extra I/O) · classifySource exported from scorer.js · test suites 6–9 added (102/102 passing) · ErrorBoundary added to main.tsx
- **Session 9 (2026-03-25):** Merged `feature/studio-react` → `intake` → pushed → Railway deployed. Fixed `scheduler.js` duplicate `const entryCompanyId` (lines 151+280 in same scope → SyntaxError on Railway). Fixed StoryCard null score display (`score != null` check, renders `—` in grey when not scored). Basic Auth added to server.js (STUDIO_USER/STUDIO_PASS). Phase 4 Block Review tab complete. Activity log moved full-width below inbox. 14 _testpub_* junk files deleted.
- **Session 9 continued:** 7 Claude Code hooks added as deterministic guardrails — block push to main, pre-commit syntax/type checks, node-syntax-check on write, tsc-check on write, clearbit/unavatar URL guard on data/ writes, Stop hook for roadmap reminder. All pipe-tested and live.
- **Session 9 continued (skills):** 6 custom skills built. Project-level: `/add-entry`, `/add-company`, `/add-tl`, `/catchup`, `/audit` in `intake-server/.claude/skills/`. User-level: `/new-vertical` in `~/.claude/skills/`. These encode the full workflow for every content action — no more reconstructing from CLAUDE.md each session.
- **CRITICAL BUG KNOWN:** Inbox server returns items in FLAT format (`_entry` not `entry`, governance fields at top level not nested). StoryCard now normalises both formats at render time. Do NOT change server format without updating StoryCard normalisation.
- **Score=null case:** When scorer doesn't run (paywall 403, no source content), `item.score` is null. Card shows `—` in grey. Normal — scorer requires source content to function.
- **Railway Volume:** `proud-reflection` has persistent volume at `/data`, `DATA_DIR=/data` env var set — state survives redeploys
- **Session 10 (2026-03-26–29):** Publisher.js dev→main fix. Pipeline v3: threshold 60→45, Tier 1 premium +10, strategic signals, 5 new L1 queries, paywall multi-query fallback. Governance: the_so_what excluded from verification + fabrication-strict. Press release wires never paywalled. Company slug alias map (25+). Auto-resolve logos in publisher. DATA_DIR fix across 9 agents. Editorial Studio: display:none tabs, process tracker, TL org+date, blocked panel redesign, Phase 5 Pipeline Control. Portal: search bar, Why it matters, auto-rotate featured, company profile redesigned, disclaimers, CTA buttons. Landing page live at livingintel.ai. Content: all 43 the_so_what rewritten (analytical, no CXO). Data fixes: 7 slug mismatches, DBS+Zocks duplicates removed, 3 entries re-verified. Quality infra: config.js shared config, 119 unit tests (13 suites), 7 smoke tests, pre-push test hook. Humanizer skill + AI patterns hook installed.
- **Session 10 final (2026-03-29):** Config.js migration (12 agents). Fabrication softened (equivalent expressions = PASS). Latest wins dedup on homepage. 4 stub entries rewritten with verified content, LPL removed (unverifiable). Pre-push hook covers both main (build) and intake (tests+smoke). SessionStart audit hook. feedback_quality_first.md saved. Skills symlinked to repo root. key_stat format bug caught and fixed. 42 entries on portal, all clean.
- **Session 11 (2026-03-30):** Multi-source intelligence (Phase 1): enrichment URLs captured in entry.sources array with type classification (primary/coverage/discovery). Scorer +3/+5 bonus for multi-source. Portal shows "Sources (N)" with PRIMARY badge. process-url endpoint fixed (was bypassing scoring + dedup). TL publish URL dedup added. Pre-push hook now covers main (build) + intake (tests). Zocks duplicate + Bloomberg empty article bugs traced to process-url bypass.
- **Session 12 (2026-03-31):** Multi-source backfill (top 10 entries, 3-7 sources each). NewsAPI.ai Layer 3 integration (Event Registry, 80K+ sources, 4 queries, live-tested). Source count badges on homepage + feed. Landscape trigger upgraded (evidence updates, not just maturity upgrades). 3 publish endpoints fixed (missing landscape check). Pipeline status now tracks discovery sources + error details. Format validator checks sources array. Blocking doc-update hook + compact reminder hook. SEC EDGAR dropped from roadmap (not needed). 126/126 tests, 7/7 smoke.
- **Session 13 (2026-04-01):** Pipeline robustness fixes: publisher.js auto-corrects week (was silently wrong) + auto-resolves logo (path bug fixed) + strips unavatar.io. intake.js post-structuring enrichment (targeted Jina searches after Claude identifies company). format-validator.js the_so_what quality gate (run-on >50w, generic phrases). AI patterns hook replaced with fast shell script. Fortune/McKinsey entry improved. Pipeline confirmed working (5am cron caught Fortune article). 135/135 tests, 7/7 smoke.
- **Session 13 continued:** Major landing page rewrite. Existential hook ("business model being rewritten"), fear-based positioning (not feature-based). Sticky section nav. 5-step pipeline visual. Rich matrix with cell content (not dots). Company AI strategy deep-dive sample (BofA). 3 intelligence cards + TL card + company profile. Coverage as classification framework. Pricing $4,500/$5,000 annual. Cost comparison moved to bridge. Stealth distribution model. Research saved in docs/. First push done, rewrite in progress for Haresh review.
- **Session 13 (cont'd, Apr 2):** TL publisher Railway fix (ENOENT → mkdirSync + clone-main pattern). server.js DATA_DIR removed (now uses config.js CONTENT_DIR/INTEL_DIR/TL_DIR). Portal "Updated" date = build date. Content quality audit: 37% STRONG / 40% ADEQUATE / 23% WEAK — report at docs/content-quality-audit.md. McKinsey Test checklist + editorial voice guide.
- **MAJOR: Multi-agent content pipeline v2** — all decisions locked. Session plan at `docs/session-by-session-plan.md`. Architecture at `docs/pipeline-v2-architecture-review.md`. Opus 4.6 for Writer+Evaluator. Full source text (no compression). 2 iterations + early exit. Retrofit 43 entries FIRST. Phase 1 manual, Phase 2 Desktop tasks, Phase 3 Agent SDK.
- **Session 14 COMPLETE.** Research Agent built + tested. BofA: 6 sources, 19K words. Jump: 6 sources, 12K words. v2 data model defined.
- **Session 15 COMPLETE.** Writer Agent (Opus, consulting persona) + Evaluator Agent (McKinsey 6-check test). Full pipeline tested: Research → Write → Evaluate → Refine. v1 score 7/10, v2 score 8/10. the_so_what is genuinely consulting-grade. TL Writer prompt (preserves author voice) included.
- **Session 16 COMPLETE.** Fabrication Agent v2 (multi-source, drift detection, the_so_what handling) + Content Producer orchestrator. Full end-to-end pipeline tested: BofA article → Research (6 sources) → Write v1 (score 7) → Evaluate → Refine v2 (score 9) → Fabrication → Final score 78. "Needs work" re-entry flow built. v2 the_so_what is genuinely consulting-grade — names competitors with specific metrics, identifies disclosure gaps.
- **Session 17 FULLY COMPLETE.** 44 entries v2 quality. 41 multi-source, 3 honest single-source. 18 unreliable Yahoo Finance URLs removed. All QA fixes applied. CTA buttons. Source badges. 7/7 smoke. Build OK.
- **DOCS REFRESHED.** CLAUDE.md (v2 pipeline, counts), docs/architecture.md (v2 data flow, agent table, counts), add-entry skill (v2 pipeline reference), reference_system_architecture.md (new hooks, memory files, v2 skills). docs/integrations.md still needs NewsAPI.ai section update.
- **Landscape v2 ALL 37 PROFILES COMPLETE (session 17b, 2026-04-04).** All processed through Claude Code Max.
  - **37/37 profiles** in `data/landscape-v2-staging/` (gitignored, survives reboots), all with 7/7 capabilities
  - **322 total source references** across all profiles, average 880-char strategy summaries
  - **Portal changes done** (on main, not committed): no_activity rendering as full cards, maturity type updated, grey styling
  - **Process used**: WebSearch → WebFetch sources → write v1 → evaluate 6-check McKinsey test → refine to v2 → verify URLs → save
  - **Plans**: `docs/landscape-v2-plan.md` (architecture), `docs/landscape-v2-execution-plan.md` (per-company process, two-step iteration, URL verification, quality gates)
  - **NEXT SESSION**: copy staging → data/competitors/, visual review on localhost:3002, run full URL verification sweep (322 refs), fix any issues, commit + push to main in one shot
- **Session 18 (2026-04-05):** Attribution discipline audit across all 37 profiles. JPMorgan: Smart Monitor removed entirely (AM tool, out of scope), 20% gross sales reworded (GenAI broadly cited, not linked to Connect Coach), research_content capability deleted. Lloyds: £0.8B reframed as broader efficiency programme. Santander: €200M reframed as efficiency gains (AI + automation + ops). BofA: $211B reframed as AUM in accounts using Erica. UI: no_activity capabilities consolidated into grouped "NO TRACKED ACTIVITY IN:" section (detail pages) + rendered as `—` on landscape matrix. New memory: `feedback_attribution_discipline.md`. Investor Day transcript reviewed — enriched JPMorgan profile with $6T AUM, $2.7B AWM spend, 3.4x productivity, Harvard case study, 9,600 advisors, Connect Coach DAF/GRAT examples. CLAUDE.md updated with Attribution Discipline section.
- **Session 19 (2026-04-05):** Content quality audit ALL 6 PHASES COMPLETE. Phase 0: lede-cut rendering bug fixed (numeric + parenthetical commas). Phase 1-2: DBS duplicate removed (44→43), BofA Meeting Journey conflation fixed, HSBC rewritten, 6 NULL key_stats populated, BofA $211B over-attribution corrected. Phase 3-4: Altruist circular sourcing removed, DBS/FNZ attribution fixed, FNZ key_stat replaced, 3 AI patterns fixed, U.S. sentence splitter bugs fixed. Phase 5: Deep landscape review — 4 agents audited all 37 profiles (Q1 evidence grounding, Q2 attribution, Q3 writing quality). 21 PASS / 16 NEEDS_EDIT. 16 profiles fixed: unsupported superlatives removed (BNP, BBVA, Zocks), causal language softened (Altruist/LPL "triggered"→"coincided with"), unsourced comparisons removed (StanChart, Jump, Wells Fargo, LPL), evidence gaps filled (JPMorgan Investor Day), data inconsistencies fixed (Holistiplan 42→39%). Phase 6: Build passes (97/97 pages), 80 JSON files parse clean, 0 errors. Final: 43 intelligence, 37 landscape, 8 TL — all CIO-ready.

- **Session 20 (2026-04-05):** Pushed session 19 audit to main (49 files, 782 insertions, 516 deletions). Homepage CTA consistency fix (TL + Landscape buttons inside cards, matching style). **Knowledge Base architecture designed** — Supabase (PostgreSQL + pgvector), 5 tables, backfill plan, multi-vertical. Full plan at `scalable-fluttering-cake.md`, memory at `project_knowledge_base.md`. **PARKED** — Haresh showing platform to prospects first. **Landing page enrichment IMPLEMENTED** on `feature/landing-page` — 11 changes: RotatingHeadline rewritten (4 fear-based headlines), hero ("consulting-grade"), stats fixed (44→43), "Why Now" enriched (BofA 3.2B, MS 98%, Altruist 1,600 RIAs), quality callouts (six dimensions + iterative refinement — secret sauce protected, no agent names), What's Inside enriched, BofA landscape cell fixed ($211B→verified 3.2B/20.6M/700M), fake Asset Managers segment removed, pricing strengthened, final CTA updated. TL added to sticky nav + own section (after Landscape). Company deep-dive moved to own section after Landscape. Headlines rewritten (fear/urgency). Hero copy rewritten. TL enriched (HBS, Wharton, Mollick). STATS constants (single source of truth for numbers). Pipeline depth stats (15+ systems, 6 dimensions, 300+ sources, 2 iterations). Sticky "Request access" CTA. Build passes. Favicon W→LI. Committed + pushed to `feature/landing-page` → Railway deploys to livingintel.ai. **Unified Supabase plan designed** — single project for auth (Google + magic link + password), Stripe Billing (no local subscription tables), and KB. Friends via Stripe 100% off coupon (no card). Schema pressure-tested: 14 tables total (2 auth + 8 KB + 4 engagement). Added user_activity (ROI proof), user_watchlist (alerts), entry_versions (content versioning), source_domains (reliability tracking), RLS, full-text search. Full plans at `project_supabase_unified.md` + `project_knowledge_base.md`.
- **Session 22 (2026-04-06, COMPLETE):** Auth + landing page deployed to livingintel.ai. Two-tier nav, fear-based headlines, unified /login. **KB Phase 1+2 COMPLETE:** kb-client.js (12 helpers), backfill-kb.js + backfill-kb-v2.js. Final KB: 265 sources (264 full Jina, 609K words), 51 entries, 37 landscape profiles, 41 companies, 91 editorial decisions. 10 platform engineering principles researched (Anthropic/Stripe/Palantir/Linear). **Sessions 23-28 planned:** KB Phases 3-5 + principles enforced IN CODE (store-before-process, pipeline events, editorial capture, prompt versioning, idempotency, vector embeddings, content-producer CLI). Enforcement hierarchy established: blocking hooks + code architecture = 100% followed; memory/skills = unreliable.
- **Session 21 (2026-04-05, COMPLETE):** ✅ Supabase project created (Pro tier, Micro compute, Europe region, org "Curiosity AI"). API key naming change: Publishable (= old anon), Secret (= old service_role). ✅ Keys in `.env.local`. ✅ Google OAuth fully configured (Google Cloud Console project "Living Intelligence", OAuth client ID + GOCSPX secret, redirect URI to Supabase callback). ✅ URL Configuration saved (Site URL: livingintel.ai, redirects: livingintel.ai + wealth.tigerai.tech + localhost:3002). ✅ Stripe account created (sandbox mode, 2 products: Founding $4,500/yr + Standard $5,000/yr, FRIEND2026 coupon 100% off 1 month 20 max, secret key in .env.local). ✅ Price IDs in .env.local (Founding + Standard). ⬜ DDL not yet run (SQL ready at `supabase/schema.sql` — paste into SQL Editor). ✅ Auth files built (8 files: middleware.ts, lib/supabase.ts, lib/supabase-server.ts, app/login, app/join, app/onboarding, app/api/auth/callback, app/api/auth/signout, app/api/checkout, app/api/webhooks/stripe). ✅ PostHog snippet added to layout (needs NEXT_PUBLIC_POSTHOG_KEY env var). ✅ Build passes clean. ✅ DDL run successfully in Supabase SQL Editor. ✅ Google OAuth working — user created in auth.users + user_profiles (trigger needed `SET search_path = public` + permissions GRANT). ⬜ Not yet pushed to main (local only). ⬜ Stripe checkout flow not yet tested (no org created — that happens post-checkout). **Key decision:** livingintel.ai is the primary domain; wealth.tigerai.tech will be retired.

## IIFL Global Prototype
- Project: `/Users/haresh/Desktop/IIFL Global/iifl-global/` — Next.js 14, Tailwind, Framer Motion
- Node.js installed at `~/.local/node/` (need `export PATH="$HOME/.local/node/bin:$PATH"`)
- Advisor: Priya, Client: Rajesh Patel Family Trust, $106.7M AUM
- AI sidebar renamed from CoPilot → AIAssociate

## Content Quality — CRITICAL (premium CEO-facing platform)
- See `feedback_content_quality.md` — zero fabrication rules, URL verification, quote attribution, JPMorgan incident
- See `feedback_attribution_discipline.md` — NEVER attribute broad business metrics to specific AI tools unless source explicitly makes causal claim
- See `feedback_editorial_standard.md` — THREE LAYERS required: trigger + capability + **the_so_what**
- **PRIME DIRECTIVE: WebFetch every source before writing any claim, in the same session**
- **verified_claims must cite exact location** — slide number, paragraph, or verbatim quote
- **`source_verified: true` only if fetched this session**
- CLAUDE.md has full CONTENT STANDARDS section — read it before any content work

## Master Roadmap — READ FIRST EVERY SESSION
- See `project_roadmap.md` — ALL pending work sequenced
- **Rule:** Every time Haresh starts something new or asks "what's next", surface the pending list from this file first

## Database First — CRITICAL for New Verticals
- See `feedback_database_first.md` — set up persistent storage BEFORE building pipeline, not after 20 sessions
- We re-fetched 264 URLs and spent 6 sessions on v2 retrofit that would have been unnecessary if KB existed from day one

## Build Retrospective & Lessons
- See `retrospective_living_intelligence.md` — full session 1–7 retrospective
- Architecture lessons, what slowed us down, incident log, template for future verticals
- **Key insight:** This is a repeatable intelligence product factory, not a wealth management project
- **For next vertical:** read the setup checklist in retrospective before session 1

## Platform Engineering Principles — FROM REAL COMPANIES
- See `reference_platform_engineering.md` — 10 principles from Anthropic, Stripe, Palantir, CB Insights, Linear
- Key: store raw, version prompts, evaluate continuously, human-in-the-loop, pgvector is right, idempotent pipelines

## Document Index + Engineering Principles
- See `docs/INDEX.md` — master index of ALL documents, memory files, and skills with descriptions
- See `docs/PRINCIPLES.md` — 10 engineering and AI agent principles learned over 17 sessions. Plan → Research → Build agents → Iterate → Score → Verify → Test → Document.
- **Rule:** Read PRINCIPLES.md before starting any new feature or pipeline work

## Complete System Architecture — READ THIS
- See `reference_system_architecture.md` — the full four-layer system (CLAUDE.md / Memory / Skills / Hooks), what each layer owns, how they interact, failure modes, maintenance rules. Reference before every session and before any new vertical.

## Skills — Always Invoke, Never Improvise

For every content action, READ THE SKILL FILE FIRST and follow its steps. Do not reconstruct from CLAUDE.md or memory.

| User says... | Use skill |
|---|---|
| "add this article / entry / URL" | `/add-entry` → `intake-server/.claude/skills/add-entry.md` |
| "add X to the landscape / add company" | `/add-company` → `intake-server/.claude/skills/add-company.md` |
| "add thought leadership / this essay" | `/add-tl` → `intake-server/.claude/skills/add-tl.md` |
| "catchup / what's pending / things to do" | `/catchup` → `intake-server/.claude/skills/catchup.md` |
| "audit / check content quality" | `/audit` → `intake-server/.claude/skills/audit.md` |
| "new vertical / start banking/insurance" | `/new-vertical` → `~/.claude/skills/new-vertical.md` |

## Landscape Process — CRITICAL
- See `feedback_landscape_process.md` — PLAN before building, use ALL search tools, no rushing, McKinsey/BCG quality non-negotiable
- Landscape is THE most important part of the platform. If it takes 3-4 days, that's fine.

## Working Style
- See `feedback_working_style.md` — stakes are high (CEO presentations), prefer deleting over broken content
- See `feedback_context_saves.md` — save memory proactively mid-session, don't wait for auto-compact
- See `feedback_quality_first.md` — CRITICAL: think about intent, verify end-to-end, be honest upfront about limitations
- See `feedback_session_insights.md` — READ EVERY SESSION. Concrete mistakes from real sessions. The feedback loop.
- **Rule:** Update docs/memory immediately after each completed item. Not at the end. Not when reminded.
- **Rule:** Before saying "done" — run full verification for the branch. Intake = tests + smoke. Main = next build.
- **Rule:** When fixing a bug, grep for the same pattern everywhere. Fix all instances in one commit.

## Superpowers Framework
- See `reference_superpowers.md` — agentic dev workflow, composable skills, TDD, worktrees, subagents
- Install in Claude Code: `/plugin install superpowers@claude-plugins-official`
- **Key value for this project:** structured planning before coding, git worktrees for parallel features, mandatory TDD

## Pricing & Positioning — MAJOR SHIFT (2026-04-01)
- See `project_pricing_positioning.md` — full thinking
- **B2C monthly ($500/mo) DROPPED** → B2B annual firm license ($10K-$15K/year)
- Key insight: CXOs don't put $500/mo on their card. Firms expense $10K/year as competitive intelligence.
- Team seats: 1 seat ~$10K, 3 seats ~$15K (firm buys, multiple people access)
- Sales flow: trial → love it → CFO justification email → annual payment
- Landing page needs full repositioning from individual to enterprise
- See also `project_subscription_stack.md` for Stripe + Supabase Auth + Iubenda implementation
- See `project_supabase_unified.md` — unified plan tying auth + subscriptions + KB into one Supabase project

## Humanizer — Always Run on AI Content
- See `feedback_humanizer.md` — `/humanizer` skill removes AI-sounding patterns from text
- Installed at `~/.claude/skills/humanizer/SKILL.md` (user-level, all projects)
- **Rule:** Run on all `the_so_what` fields, intelligence summaries, and newsletter articles before publishing

## Business Prompt Studio (LinkedIn Carousels)
- Project: `/Users/haresh/Desktop/business-prompt-studio/` — Next.js 16, port 3005
- Series: THE BUSINESS PROMPT — 9-slide carousels for business leaders (45-55, CEOs/CFOs/COOs)
- **Positioning:** "Business insight builds the AI stack. Not the other way around."
- **Persona:** 365 days daily AI building (n8n, Claude Code, image models). Business lens, not tech lens.
- **Posting schedule:** Tue/Thu/Sat (3x/week). 13 carousels scheduled Apr 2-25.
- **Pipeline:** Calendar → /generate → /fact-check → /humanizer → /quick-post → PDF → LinkedIn
- **6 skills:** `/generate`, `/suggest`, `/review`, `/quick-post`, `/fact-check`, `/catchup`
- **4 hooks:** tsc-check, content-guard, pre-commit-check, pre-push-check (smoke test)
- **ZERO HALLUCINATION standard:** /fact-check mandatory before every post. Primary sources only.
- **Design:** 1080x1080 square, Navy/White/CodeGrey/Amber, design controls sidebar
- **Each takeaway slide teaches one AI concept in business language** (Context, Position, Tone, GIGO, etc.)
- Memory at `~/.claude/projects/-Users-haresh-Desktop-business-prompt-studio/memory/`
- Memory at `~/.claude/projects/-Users-haresh-Desktop-business-prompt-studio/memory/`

## AI of the Tiger Newsletter
- See `project_ai_tiger.md` — full pipeline, Claude Code infra, UI improvements
- Project: `/Users/haresh/Desktop/ai-tiger-workflow/` — Node.js Express, port 3001, beehiiv publishing
- **5-phase pipeline:** Research → Write → Guardrail → Image → Publish
- **7 skills:** `/tiger-research`, `/tiger-write`, `/tiger-guardrail`, `/tiger-image`, `/tiger-publish`, `/tiger-full`, `/tiger-edit`
- **4 hooks:** HTML validation, draft word count, no-secrets commit, stop reminder
- **UI v2 (2026-03-27):** Editable draft, split-pane, inline AI rewrite, expandable sidebar, guardrail annotations, HTML source editor
- **CLAUDE.md** created with full content standards (zero fabrication, anti-redundancy)

## Chart/Visualization Patterns
- **Never use absolute positioning for chart labels** — use flexbox stacking instead
- **Never overlay multiple gradient divs** — use a single div with multi-stop gradient
- **For percentile bars**: `10 + ((P50-P5)/(P95-P5))*80` keeps median line in 10–90% band
- **Per-bucket scaling** — each bucket needs its own scale
- **Keep bar visuals clean** — no text inside bars, numbers below in flex stack
