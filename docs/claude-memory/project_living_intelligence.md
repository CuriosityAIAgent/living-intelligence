---
name: Living Intelligence Project
description: Full details of the Living Intelligence portal — location, stack, architecture, pipeline, brand, and content rules
type: project
---

# Living Intelligence Portal

## Stack
- **Portal + Landing:** Next.js 16, port 3002, `livingintel.ai` — Railway `profound-wonder` service, deploys from `feature/landing-page` (THE product — landing + auth + portal)
- **Intake Server:** Node.js/Express, port 3003 — Railway `proud-reflection` service, deploys from `intake`
- **Legacy Portal:** `wealth.tigerai.tech` — Railway `living-intelligence` service, deploys from `main` — **FROZEN** (shared with JPM, don't touch)
- **Desktop:** `/Users/haresh/Desktop/Living Intelligence/living-intelligence/`

## Data Counts (2026-04-06, session 22 — auth deployed to livingintel.ai)
- 43 intelligence entries (41 with multi-source coverage)
- 8 thought leadership entries
- 37 landscape companies across 7 segments (Asset Managers removed — was never real)
- 42 logos (local SVG/PNG)

## Landing Page (session 20)
- Branch `feature/landing-page` → Railway `profound-wonder` → livingintel.ai
- Fear-driven positioning, consulting-grade quality callouts, STATS constants for number consistency
- Nav: Why Now → How It Works → Intelligence → Landscape → Thought Leadership → Pricing
- Sticky "Request access" CTA (bottom-right pill, desktop)
- Pipeline depth stats (15+ systems, 6 quality dimensions, 300+ source refs, 2 iterations) — no agent names
- BofA company deep-dive sample, McKinsey + Venrock/Beim TL cards
- Favicon: W → LI

## Pipeline v2 — ALL COMPLETE (sessions 14-19)
- Intelligence v2: Research Agent → Writer (Opus) → Evaluator → Fabrication → Content Producer. All 43 entries upgraded.
- Landscape v2: All 37 profiles upgraded with 7/7 capabilities, 322 source references.
- Content Quality Audit (session 19): All 6 phases complete. Three Questions framework (Q1 evidence grounding, Q2 attribution discipline, Q3 writing quality) applied to all 43 intelligence entries + 37 landscape profiles. 16 landscape profiles fixed. All content CIO-ready.

## Pipeline (v3 — session 10+)
- **Scoring:** 4 dimensions (Source 0-25, Claims 0-25, Freshness 0-10, Impact 0-40) + multi-source bonus + Dim E CXO gate
- **Thresholds:** PUBLISH ≥75, REVIEW 45-74, BLOCK <45
- **Discovery layers:** L1 News (8 DFS), L1 Capabilities (7 DFS), L2 Companies (37 DFS Content Analysis), L3 NewsAPI.ai (4 queries, 80K+ sources), L1 TL (5 Jina), L2 Authors (dynamic Jina)
- **Multi-source:** Entries get `sources` array with type classification (primary/coverage/discovery). Scorer gives +3 for 2 sources, +5 for 3+, +3 for primary source found.
- **NewsAPI.ai:** Integrated session 12 (2026-03-31). Event Registry API at eventregistry.org. Key in .env as NEWSAPI_KEY. 4 keyword queries, 7-day window, dedup-skip, +4 scoring bonus. Gracefully skips if key not set.

## Key Architecture
- `config.js` = single source of truth for all paths, thresholds, constants (all 12+ agents import)
- Editorial Studio (React, Vite+TS+Tailwind v4) at `intake-server/client/`
- Universal Inbox — nothing auto-publishes
- Company slug alias map (25+ aliases + dynamic)

## Quality Infrastructure
- 126 unit tests across 15 suites
- 7 smoke tests (data integrity)
- Pre-push hooks: intake (tests+smoke), main (next build)
- SessionStart audit hook, AI patterns hook, Stop hook for stale docs

## Session 12 (2026-03-31) — What was built
- Multi-source backfill: top 10 entries now have 3-7 verified sources each
- NewsAPI.ai integration: Layer 3 discovery in auto-discover.js
- Source count badges: homepage + intelligence feed show "N sources"
- 126/126 tests passing (up from 123)
- Feedback memory updated: compaction rules tightened

## Session 13 (2026-04-01) — What was built
- Pipeline robustness: publisher.js auto-corrects week + auto-resolves logo (path bug fixed) + strips unavatar.io
- intake.js post-structuring enrichment: targeted Jina searches after Claude identifies company (fires when ≤1 initial source)
- format-validator.js: the_so_what quality gate (run-on >50 words/sentence, >80 total, generic phrases)
- AI patterns hook: replaced slow LLM prompt hook with fast shell script (only checks data files)
- Fortune/McKinsey market signal entry improved (week, 2nd source, logo, tightened the_so_what)
- Pipeline confirmed working: 5am cron discovered Fortune article automatically
- 135/135 tests (up from 126), 7/7 smoke

## Session 17b (2026-04-04) — Landscape v2 Complete
- ALL 37 landscape profiles upgraded to v2 consulting quality via Claude Code Max
- 37/37 companies with 7/7 capabilities each, 322 total source references
- Process: WebSearch → WebFetch → write v1 → evaluate 6-check McKinsey test → refine v2 → verify URLs
- Portal changes done (not committed): no_activity renders as full cards with grey styling, maturity type updated
- Stored in `data/landscape-v2-staging/` (gitignored, survives reboots)
- Key learnings: plan before building, use all search tools (WebSearch/WebFetch), never skip iteration loop, verify every URL
- Plans documented: `docs/landscape-v2-plan.md`, `docs/landscape-v2-execution-plan.md`

## Session 22 (2026-04-06) — Auth + Registration
- Deployment architecture: livingintel.ai = full product, wealth.tigerai.tech = frozen (JPM)
- Merged main → feature/landing-page (all v2 content on landing page branch)
- Auth iterated 3 times: v1 (confusing) → v2 (3-step) → v3 unified /login
- **Unified auth:** single /login page handles new + returning users via `signInWithOtp({shouldCreateUser: true})`
- Magic link + Google OAuth, no passwords, /register deleted entirely
- Onboarding rewritten: profile completion (name + company) → team invites (4 slots) → checkout waiting
- Middleware: checks full_name + company + org_id + org status active
- Landing page nav: "Sign in" (text) + "Register" (claret button), all CTAs → /login
- Pricing: single founding box ($4,500/yr, rate locked for life), no standard box
- Railway env vars set on profound-wonder (7 vars: Supabase + Stripe)
- Stripe checkout: tier param (founding/standard), coupon support
- Landing page redesigned (session 22): two-tier nav (24px masthead + "AI in Wealth Management" descriptor | Sign in, 14px title case section links). Compacted centred hero with fixed-height rotating headlines (4 fear-based). Sub-copy removed. scroll-mt-24 on all anchors. Only 2 register points: pricing box + floating pill.
- REMAINING: Stripe webhook endpoint, create Haresh's org, test full flow

## Session 22 (cont'd) — Knowledge Base Phase 1
- **Branch:** `intake` — all KB work here
- **`@supabase/supabase-js`** installed in `intake-server/package.json`
- **Env vars:** `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` added to `intake-server/.env`
- **`intake-server/agents/kb-client.js`** — Supabase singleton + helpers: getSupabaseClient(), storeSource(), getSourceByUrl(), getCompanySources(), storeBrief(), getBrief(), getReadyBriefs(), logDecision(), logPipelineRun()
- **`intake-server/scripts/backfill-kb.js`** — 5-phase backfill: verticals → companies → company_verticals → sources → editorial_decisions. Supports --dry-run.
- **KB data seeded:** 1 vertical (wealth), 40 companies (37 landscape + blackrock/fnz/webull), 37 company-vertical links, 42 sources (thin — summaries as content_md placeholder), 91 editorial decisions
- **Smoke tests:** 7/7 passing
- **KB Phase 2 COMPLETE:** Comprehensive backfill with full Jina content.
  - kb-client.js expanded: storePublishedEntry, storeLandscapeProfile, updateSource, getCompanyEntries, etc.
  - backfill-kb-v2.js: 4-phase script (sources → entries → landscape → relationships), supports --dry-run/--skip-fetch/--phase
  - **Final KB:** 265 sources (264 full content, 609K words), 51 published entries (43 intel + 8 TL), 37 landscape profiles (119 capabilities, 28 with evidence links), 41 companies, 91 editorial decisions
  - Merged main→intake to get all v2 data before backfill
  - 4 non-landscape companies added (blackrock, fnz, webull, orion) for FK integrity
- **REMAINING KB (Sessions 23-28 plan):**
  - Session 23: Phase 3 — wire research-agent to KB, storeSource() before processing (Principle 1)
  - Session 24: Phase 4 — pipeline integration (scheduler/intake → KB), pipeline_events table (Principle 8)
  - Session 25: Phase 5 — editorial decision capture with draft_snapshot (Principle 9)
  - Session 26: prompt versioning (intake-server/prompts/) + idempotency (content_hash, dedup publish) (Principles 3, 7)
  - Session 27: vector embeddings (Jina v3, ~350 rows) + semantic search (match_content RPC)
  - Session 28: content-producer.js CLI (--url/--brief/--top N) + E2E test of all 10 principles
- **Enforcement hierarchy:** blocking hooks + code architecture = 100% followed. Memory/skills/advisory hooks = 40-80%. Principles must be baked into code, not stored in memory.
