# AI in Wealth Management — Intelligence Portal

Executive intelligence platform tracking AI adoption across wealth management.
Two systems: **Portal** (this repo, Next.js) + **Intake Server** (`../intake-server`, Node.js port 3003).

See @docs/architecture.md for full system design and @docs/integrations.md for all external APIs.

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

**Git workflow:** all changes → `dev` branch. Merge `dev` → `main` to deploy (Railway auto-deploys on push to main).

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
- Top tier (56px, `#1C1C2E`): wordmark "AI in Wealth Management" left; "Living Intelligence" + "AI of the Tiger" stacked top-right
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

`wirehouse` · `global_private_bank` · `regional_champion` · `digital_disruptor` · `ai_native` · `ria_independent` · `advisor_tools`

**Classification rules:**
- Large US advisor-network broker-dealers (Morgan Stanley, Merrill, Wells Fargo) → `wirehouse`
- HNW/UHNW focused institutions globally, whether standalone or bank division → `global_private_bank` (UBS, Goldman, Citi PB, HSBC PB, Julius Baer, BNP Paribas)
- Dominant in their home region, full-service banking + wealth → `regional_champion` (DBS, BBVA, StanChart, RBC)
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

- **PASS** → `source_verified: true`, publish immediately
- **REVIEW** → held in pending queue at `/api/pending`, requires human approval at `localhost:3003`
- **FAIL** → URL permanently blocked in `.governance-blocked.json`, cannot be resubmitted

`source_verified` on every entry always reflects the actual governance outcome — never hardcoded.

---

## Scripts (intake-server/scripts/)

| Script | Purpose | Usage |
|--------|---------|-------|
| `backfill-governance.js` | Run governance check on all existing entries that lack `_governance` | `node --env-file=.env scripts/backfill-governance.js` |
| `reprocess-failed.js` | Re-fetch + re-structure + re-verify all FAIL entries | `node --env-file=.env scripts/reprocess-failed.js` |
| `test-portal.js` | Health check all URLs + portal pages, auto-fix broken links | `node scripts/test-portal.js --fast` |

Run `test-portal.js` after any batch data change to catch broken `document_url`, `image_url`, or `author.photo_url` fields before they reach production.
