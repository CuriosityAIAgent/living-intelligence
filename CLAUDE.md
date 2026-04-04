# AI in Wealth Management — Intelligence Portal

Premium executive intelligence platform ($4,500-$5,000/year) tracking AI adoption across 37+ wealth management firms.
Two systems: **Portal** (this repo, Next.js) + **Intake Server** (`../intake-server`, Node.js port 3003).

**v2 Content Pipeline (Sessions 14-17):** Research Agent → Writer Agent (Opus) → Evaluator Agent (McKinsey 6-check test) → Fabrication Agent (multi-source, drift detection) → Content Producer orchestrator. All 44 intelligence entries upgraded to consulting quality with multi-source verification.

See @docs/architecture.md for full system design, @docs/integrations.md for all external APIs, @docs/pipeline-v2-plan.md for the v2 pipeline architecture.

---

## CONTENT STANDARDS — NON-NEGOTIABLE

This is a **premium, CEO-facing platform**. Every number, every claim, every quote that appears on this site has been seen in boardrooms and senior leadership meetings. A single fabricated or unverified statistic destroys the credibility of the entire platform.

### The Prime Directive

**Never write a claim you have not personally read in the source during this session.**

Not from memory. Not from a previous session. Not from the landscape competitor file. Not from another intelligence entry. Only from the actual source document, fetched and read right now.

### Track 2 Entry Rules (direct JSON writes — no pipeline)

Track 2 entries bypass governance.js and scorer.js entirely. That makes the human writing them the only check. These rules are therefore absolute:

1. **WebFetch the source URL before writing a single claim.** If the URL is a PDF, fetch it. If it 404s, find the correct URL before proceeding. If it's paywalled, note it explicitly and find an open alternative. There are no exceptions.

2. **Every item in `verified_claims` must include the exact location** — slide number, paragraph, section heading, or verbatim quote. "Investor Day PDF" is not acceptable. "Investor Day slide 12 — confirmed in source by Haresh" is acceptable.

3. **`source_verified: true` only if the URL was fetched and read in this session.** If you cannot fetch the source, set `source_verified: false` and explain why in the governance notes.

4. **`human_approved: true` only after Haresh has confirmed the key stat.** Read the headline number back to Haresh with the exact source quote before setting this field.

5. **Never copy claims from `data/competitors/*.json` into an intelligence entry without first re-verifying them against the original source.** The competitor file may itself contain unverified claims from a previous session.

6. **Never use a stat from a PDF you have not fetched in this session**, even if you believe it to be correct from prior knowledge.

### What happens when a claim cannot be verified

- Omit it entirely. A shorter, fully verified entry is always better than a longer entry with one fabricated number.
- If a key stat is the only thing in doubt, write the entry without it and flag it to Haresh.
- Do not round up, interpolate, or extrapolate from related figures. "~20%" when the source says "approximately 20%" is fine. "~20%" when the source says nothing is fabrication.

### The cost of a miss

A wrong number in a CEO presentation is not a typo. It is a trust failure that can end the platform's credibility. Every piece of content on this site should be something you would stand behind in a room full of senior executives who have read the primary source.

---

## Documentation Maintenance — MANDATORY

**Every time you change code, data, or configuration in this project, you MUST update all affected documentation before committing.** No exceptions. This is a CEO-facing product — stale docs cause mistakes in presentations and future sessions.

### What to update and when

| You changed | Update these |
|---|---|
| Any file in `intake-server/agents/` | `docs/agents-and-architecture.md` (relevant agent section) + `docs/integrations.md` (if external API changed) |
| External API calls (new API, new endpoint, new use) | `docs/integrations.md` — add/update the relevant section + "What Each Integration Solves" table |
| Data counts (entries, companies, capabilities) | `docs/architecture.md` (Landscape Coverage + data directory counts) + `docs/agents-and-architecture.md` (Data Model section) + memory file `project_living_intelligence.md` |
| Brand tokens, UI rules, nav behavior | `CLAUDE.md` Brand section + memory file |
| New API route in `server.js` | `docs/agents-and-architecture.md` API Endpoints table + `docs/architecture.md` API Routes table |
| Scoring/governance logic | `docs/agents-and-architecture.md` scorer.js section |
| Thought leadership entries added/removed/verified | Memory file `project_living_intelligence.md` verified entries list |
| Landscape segment classifications, maturity levels | `docs/architecture.md` Landscape Coverage table |
| Any verified data point (user counts, AUM, metrics) | Memory file `project_living_intelligence.md` verified data points section |
| Pipeline flow (new stage, new source, new routing) | `docs/integrations.md` pipeline diagram + `docs/agents-and-architecture.md` agent description |

### Memory file updates

After any significant session, update `/Users/haresh/.claude/projects/-Users-haresh/memory/project_living_intelligence.md` to reflect:
- New data counts
- New verified data points
- New integrations or APIs in use
- Any new critical UI rules

### The check before committing

Before every `git commit`, mentally verify:
1. Does `docs/agents-and-architecture.md` describe the current state of all agents (including v2: research-agent, writer-agent, evaluator-agent, content-producer)?
2. Does `docs/integrations.md` list every external API currently in use?
3. Does `docs/architecture.md` show the correct company/entry counts (44 intelligence, 8 TL, 37 landscape)?
4. Does the memory file reflect what was built this session?

If any answer is no — update before committing.

**Current data counts (April 2026):** 44 intelligence entries (41 multi-source) · 8 thought leadership · 37 landscape companies · 42 logos

---

## Environment

```bash
# Node — must use fnm, not system node
export PATH="$HOME/.fnm/node-versions/v20.20.0/installation/bin:$PATH"

# Portal (this repo)
npx next dev --turbopack -p 3002     # localhost:3002
npx next build                        # production build check

# Intake Server (content discovery pipeline)
cd ../intake-server
node --env-file=.env server.js   # localhost:3003
```

**Git workflow — branching strategy:**

| Branch | Purpose | Railway deploys? |
|--------|---------|-----------------|
| `main` | Stable production — what subscribers and CXOs see | ✅ Portal (`living-intelligence` service) auto-deploys on push |
| `intake` | Active development — all code changes go here first (renamed from `dev` 2026-03-23) | ✅ Intake server (`proud-reflection`) deploys from `intake` |
| `feature/landing-page` | Public landing page `livingintel.ai` (`profound-wonder` service) | ✅ Separate Railway service |

**Version tags (semantic versioning — major milestones only):**
| Tag | What it is |
|-----|-----------|
| `v1.0` | Portal launch — intelligence feed, landscape, intake pipeline, Telegram digest |
| `v1.1` | Algorithm v2 — capability-led scoring, three-layer discovery, 25 audited entries |
| `v2.0` | Universal Inbox — editorial sign-off on everything, Editorial Studio UI revamp |

**Tagging convention:** Tag `main` after every significant stable milestone with `git tag -a vX.Y HEAD -m "vX.Y: short description" && git push origin vX.Y`
- Major version (v1→v2): architecture changes, new editorial workflow
- Minor version (v1.0→v1.1): significant new feature or algorithm upgrade

**To roll back to a previous version** (e.g. if v2.0 breaks):
```bash
git checkout v1.1          # inspect what v1.1 looks like
git checkout main
git revert HEAD            # safer: revert the bad commit, keep history
# OR for emergency rollback:
git reset --hard v1.1      # nuclear: resets main to v1.1 state
git push origin main --force
```

**Rules:**
1. **Never push untested code directly to `main`** — it immediately redeploys the public portal
2. **All code changes start on `intake`**: `git checkout intake` → develop → commit → push → test on Railway intake server
3. **Merge to `main` only when tested**: `git checkout main && git merge intake && git push origin main`
4. **Content publishing (approved stories)** always pushes to `main` directly — this is intentional, it triggers portal rebuild with new content
5. **`feature/landing-page`** is independent — developed separately, merged to `main` when landing page is ready to go live

**Railway deployment config (all confirmed):**
- Portal service (`living-intelligence`): deploys from `main` ✓
- Intake server (`proud-reflection`): deploys from `intake` ✓
- Landing page (`profound-wonder`): deploys from `feature/landing-page` ✓

---

## Critical Rules

- **Data lives in `data/` inside this repo** and is tracked in git. Never move it into `app/` or `lib/`.
- **No database.** Everything is flat JSON files read at build time via `lib/data.ts`.
- **`max-w-6xl mx-auto px-6`** on every page `<main>` for browse/list pages — must match header width.
- **Article detail pages** use `max-w-3xl mx-auto px-6` (centered reading column — WSJ/FT editorial style).
- **All page footers** must read: `AI in Wealth Management. All sources linked. Updated regularly.`
- **Never use external image URLs** for people/authors — use `<AuthorAvatar>` component (letter initials, deterministic color, zero dependencies).
- **Never use Clearbit or unavatar URLs** for company logos — they return broken images. Use local `/public/logos/*.svg|png` files only.
- **Nav active state:** `border-b-2 border-[#990F3D]` underline. Never use `bg-*` pill backgrounds for nav items.

---

## Brand

| Token | Value |
|---|---|
| Accent / claret | `#990F3D` (FT claret — nav underline, section labels, links, arrows) |
| Header bg (masthead) | `#1C1C2E` (dark slate) |
| Header bg (nav bar) | `#141420` |
| Body background | `#FDF8F2` (FT warm cream) |
| Active nav border | `border-[#990F3D]` |
| Section label | `text-[11px] font-semibold uppercase tracking-widest text-[#990F3D]` |

**Header structure (two-tier):**
- Top tier (56px, `#1C1C2E`): wordmark "AI in Wealth Management" left; "LIVING INTELLIGENCE" bold right (15px, font-bold, uppercase, tracking-widest, white) — no subtitle
- Bottom tier (40px, `#141420`): nav tabs left-flush (`pl-0 pr-6`) with `border-b-2` active underline

---

## Code Style

- TypeScript strict — no `any`, no `@ts-ignore`
- Tailwind only — no CSS modules, no inline `style=` unless dynamic (e.g. avatar background color)
- Server Components by default; `'use client'` only when hooks are needed (Header, interactive components)
- `async/await` — no `.then()` chains
- Prefer editing existing files over creating new ones

---

## Data Schema

```
data/
  intelligence/       ← news entries (IntelligenceEntry type)
  thought-leadership/ ← curated essays/reports (ThoughtLeadershipEntry type)
  competitors/        ← landscape companies (Competitor type)
  capabilities/       ← landscape capability dimensions (index.json)
  logos/              ← local SVG/PNG logos (24 companies)
  pulse/              ← (reserved)
```

To add a new intelligence entry: create a JSON file in `data/intelligence/` following the existing schema. The portal picks it up automatically at build time — no code changes needed.

To add a new landscape company: create a JSON file in `data/competitors/` with a valid `segment` key from `SEGMENT_LABELS` in `lib/constants.ts`.

---

## Segments (landscape)

`wirehouse` · `global_private_bank` · `regional_champion` · `asset_manager` · `digital_disruptor` · `ai_native` · `ria_independent` · `advisor_tools`

**Classification rules:**
- Large US advisor-network broker-dealers (Morgan Stanley, Merrill, Wells Fargo) → `wirehouse`
- HNW/UHNW focused institutions globally, whether standalone or bank division → `global_private_bank` (UBS, Goldman, Citi PB, HSBC PB, Julius Baer, BNP Paribas)
- Dominant in their home region, full-service banking + wealth → `regional_champion` (DBS, BBVA, StanChart, RBC)
- Large-scale fund managers with direct-to-investor and/or advisor-facing wealth platforms → `asset_manager` (Vanguard, Fidelity) — NOT `digital_disruptor`
- AI tools used BY advisors (Jump, Nevis, Zocks, Holistiplan) → `advisor_tools`, NOT `ai_native`
- AI-native wealth platforms built from scratch (Arta, Savvy) → `ai_native`

---

## Landscape — Maturity Levels

Five levels displayed as dots in the capabilities matrix:

| Level | Dot | Definition |
|-------|-----|-----------|
| `scaled` | Green | Capability is live, widely deployed across the firm, and measurably impacting business outcomes |
| `deployed` | Blue | Capability is live in production but adoption is still partial, regional, or limited in scope |
| `piloting` | Orange | Capability is being tested with select users or in a limited context; not yet broadly available |
| `announced` | Yellow | Publicly committed to building or acquiring this capability; not yet in production |
| `no_activity` | Gray | No public evidence of any activity in this capability area |

Ratings are based on publicly available evidence. All assessments are directional — not investment advice.

---

## Governance (intake server)

Every intelligence entry that goes through the intake pipeline receives a `_governance` audit block:

```json
"_governance": {
  "verdict": "PASS | REVIEW | FAIL",
  "confidence": 0-100,
  "verified_claims": [...],
  "unverified_claims": [...],
  "fabricated_claims": [...],
  "notes": "...",
  "paywall_caveat": false,
  "verified_at": "ISO timestamp",
  "human_approved": false,
  "approved_at": null
}
```

- **PASS** (score ≥ 75) → queued in Universal Inbox for editorial sign-off
- **REVIEW** (score 60–74) → queued in Universal Inbox, flagged for closer review
- **FAIL** (score < 60 or fabricated) → URL permanently blocked in `.governance-blocked.json`

**Nothing auto-publishes.** All stories require Haresh's approval in the Editorial Studio (`localhost:3003`) before going live. Approve → `POST /api/inbox/:id/approve-and-publish` (SSE, git push included). Reject → reason logged to `.rejection-log.json`.

`source_verified` on every entry always reflects the actual governance outcome — never hardcoded.

---

## Scripts (intake-server/scripts/)

| Script | Purpose | Usage |
|--------|---------|-------|
| `backfill-governance.js` | Run governance check on all existing entries that lack `_governance` | `node --env-file=.env scripts/backfill-governance.js` |
| `reprocess-failed.js` | Re-fetch + re-structure + re-verify all FAIL entries | `node --env-file=.env scripts/reprocess-failed.js` |
| `test-portal.js` | Health check all URLs + portal pages, auto-fix broken links | `node scripts/test-portal.js --fast` |

Run `test-portal.js` after any batch data change to catch broken `document_url`, `image_url`, or `author.photo_url` fields before they reach production.
