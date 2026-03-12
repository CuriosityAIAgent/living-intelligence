# AI in Wealth Management — Intelligence Portal

Executive intelligence platform tracking AI adoption across wealth management firms globally.
Internal use only — built by AI of the Tiger.

## What It Is

A living intelligence portal that tracks AI developments, thought leadership, and capability maturity across 26 wealth management firms. Bloomberg/FT editorial style. No database — all content is flat JSON tracked in git.

## Quick Start

```bash
# Requires Node 20+ (via fnm)
export PATH="$HOME/.fnm/node-versions/v20.20.0/installation/bin:$PATH"

# Portal
npx next dev --turbopack -p 3002     # → localhost:3002

# Intake server (content pipeline)
cd ../intake-server
node --env-file=.env server.js       # → localhost:3003
```

## Structure

```
living-intelligence/      ← this repo (Next.js portal)
  app/                    ← Next.js pages
  components/             ← shared React components
  lib/                    ← data loading + constants
  data/                   ← all content (tracked in git)
    intelligence/         ← 33 news entries
    thought-leadership/   ← 7 curated essays/reports
    competitors/          ← 26 landscape companies
    capabilities/         ← 7 capability dimensions
    logos/                ← local company logos (SVG/PNG)
  docs/                   ← architecture + integration notes
  public/logos/           ← logo files served at runtime

../intake-server/         ← content discovery pipeline
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Latest intelligence feed — lead story + grid |
| `/intelligence` | All 33 intelligence entries with filters |
| `/intelligence/[slug]` | Article detail — formatted summary, source, tags |
| `/thought-leadership` | All 7 thought leadership pieces |
| `/thought-leadership/[slug]` | Piece detail — insight, summary, quotes |
| `/landscape` | AI capabilities matrix — 26 companies × 7 dimensions |
| `/competitors/[slug]` | Company detail page |

## Deployment

Railway — auto-deploys on push to `main`. Work on `dev` branch, merge to `main` to publish.

See `CLAUDE.md` for full development instructions and `docs/` for architecture notes.
