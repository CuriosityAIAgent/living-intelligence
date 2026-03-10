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
npx next dev --turbopack      # localhost:3002
npx next build                # production build check

# Intake Server (content discovery pipeline)
cd ../intake-server
node --env-file=.env server.js   # localhost:3003
```

**Git workflow:** all changes → `dev` branch. Merge `dev` → `main` to deploy (Railway auto-deploys on push to main).

---

## Critical Rules

- **Data lives in `data/` inside this repo** and is tracked in git. Never move it into `app/` or `lib/`.
- **No database.** Everything is flat JSON files read at build time via `lib/data.ts`.
- **`max-w-6xl mx-auto px-6`** on every page `<main>` — must match header width or content misaligns visually.
- **All page footers** must read: `AI in Wealth Management. All sources linked. Updated regularly.`
- **Never use external image URLs** for people/authors — use `<AuthorAvatar>` component (letter initials, deterministic color, zero dependencies).
- **Nav active state:** `border-b-2 border-[#1B2E5E]` underline. Never use `bg-*` pill backgrounds for nav items.

---

## Brand

| Token | Value |
|---|---|
| Primary navy | `#1B2E5E` |
| Active nav border | `border-[#1B2E5E]` |
| Section label | `text-[11px] font-semibold uppercase tracking-widest text-[#1B2E5E]` |
| Page wordmark | `text-[13px] font-bold tracking-widest uppercase text-[#1B2E5E]` |

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
../data/
  intelligence/       ← news entries (IntelligenceEntry type)
  thought-leadership/ ← curated essays/reports (ThoughtLeadershipEntry type)
  competitors/        ← landscape companies (Competitor type)
  capabilities/       ← landscape capability dimensions (index.json)
  pulse/              ← (reserved)
```

To add a new intelligence entry: create a JSON file in `../data/intelligence/` following the existing schema. The portal picks it up automatically at build time — no code changes needed.

To add a new landscape company: create a JSON file in `../data/competitors/` with a valid `segment` key from `SEGMENT_LABELS` in `lib/constants.ts`.

---

## Segments (landscape)

`global_bank` · `global_private_bank` · `regional_champion` · `digital_disruptor` · `ai_native` · `ria_independent` · `advisor_tools`

**Classification rules:**
- Large advisor-network wealth managers (Morgan Stanley, Merrill) → `wirehouse` ("Full-Service Wealth")
- HNW/UHNW focused institutions globally, whether standalone or bank division → `global_private_bank` (UBS, Goldman, Citi PB, HSBC PB, Julius Baer, BNP Paribas)
- Dominant in their home region, full-service banking + wealth → `regional_champion` (DBS, BBVA, StanChart, RBC)
- AI tools used BY advisors (Jump, Nevis, Zocks, Holistiplan) → `advisor_tools`, NOT `ai_native`
- AI-native wealth platforms built from scratch (Arta, Savvy) → `ai_native`
