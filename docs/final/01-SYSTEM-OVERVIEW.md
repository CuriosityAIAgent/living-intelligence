# Living Intelligence — System Overview
**Definitive Reference — April 17, 2026 | Sessions 1–44**

---

## What We Built

A premium executive intelligence platform ($4,500–$5,000/year) tracking AI adoption across 37+ wealth management firms. Two systems, three deployments, one content pipeline.

**Product:** CEO-facing intelligence feed — consulting-quality analysis of how wealth management firms are deploying AI, with a competitive landscape matrix, thought leadership curation, and editorial governance on every claim.

**Moat:** Not the pipeline (reproducible). The moat is: (1) the landscape capability matrix (37 firms × 7 dimensions, all evidence-sourced), (2) verified thought leadership curation, (3) governance provenance (`_governance` block inline in every published entry).

---

## Architecture — Two Systems

### System 1: Portal (What Subscribers See)
- **Tech:** Next.js 16, static build, reads JSON files from `data/`
- **Deployment:** Railway `living-intelligence` service ← `main` branch ← `wealth.tigerai.tech` (frozen JPM demo) / `livingintel.ai` (primary, `feature/landing-page`)
- **Port:** 3002 (local dev)
- **Auth:** Supabase (Google OAuth + magic link + password), Stripe billing

### System 2: Intake Server (Internal Tool)
- **Tech:** Node.js/Express, Vite React UI (Editorial Studio)
- **Deployment:** Railway `proud-reflection` service ← `intake` branch
- **Port:** 3003 (local dev)
- **Auth:** Basic Auth (STUDIO_USER/STUDIO_PASS)

### System 3: Landing Page
- **Tech:** Next.js, same repo
- **Deployment:** Railway `profound-wonder` service ← `feature/landing-page` branch ← `livingintel.ai`

---

## Data Counts (April 2026)

| Asset | Count | Location |
|-------|-------|----------|
| Intelligence entries | 43 (41 multi-source) | `data/intelligence/` |
| Thought leadership | 8 | `data/thought-leadership/` |
| Landscape companies | 37 (8 segments) | `data/competitors/` |
| Company logos | 42 (local SVG/PNG) | `data/logos/` |
| Capability dimensions | 7 | `data/capabilities/index.json` |
| KB sources (Supabase) | 265 (all embedded) | `sources` table |
| KB entries (Supabase) | 51 | `entries` table |
| KB profiles (Supabase) | 37 | `profiles` table |

---

## Deployment Map

| Railway Service | Git Branch | Domain | What Deploys |
|----------------|------------|--------|--------------|
| `living-intelligence` | `main` | `wealth.tigerai.tech` | Portal — what subscribers/CXOs see |
| `proud-reflection` | `intake` | (internal) | Editorial Studio + pipeline server |
| `profound-wonder` | `feature/landing-page` | `livingintel.ai` | Public landing page |

### What Goes Where

| Change Type | Branch | Effect |
|------------|--------|--------|
| Portal UI (app/, components/, lib/) | `main` | Portal rebuilds on `wealth.tigerai.tech` |
| Pipeline/agents/Editorial Studio | `intake` | Intake server rebuilds on Railway |
| Published content (approved stories) | `main` (auto via publisher.js) | Portal rebuilds with new content |
| Landing page | `feature/landing-page` | Landing page rebuilds on `livingintel.ai` |

---

## Database & Infrastructure

| Service | Purpose | Tier |
|---------|---------|------|
| Supabase | Auth + Knowledge Base (pgvector) | Pro, Europe |
| Stripe | Billing ($4,500 Founding / $5,000 Standard annual) | Live |
| Railway | Hosting (3 services) | — |
| PostHog | Analytics (stub installed, not wired) | — |

### Supabase Tables (14 total)

**Auth (2):** `user_profiles`, `organizations`
**KB (8):** `sources`, `entries`, `profiles`, `research_briefs`, `editorial_decisions`, `pipeline_runs`, `prompt_versions`, `source_embeddings`
**Engagement (4):** `user_activity`, `user_watchlist`, `entry_versions`, `source_domains`

---

## External APIs

| API | Purpose | Cost |
|-----|---------|------|
| Anthropic Claude | Structuring, writing (Opus), evaluation, fabrication, governance | ~$60/month (mostly Phase 1) |
| Jina AI | Article extraction (r.jina.ai), search (s.jina.ai), embeddings, reranker | ~$10/month |
| DataForSEO | Google News, Organic, Content Analysis, Images, Backlinks | ~$15/month |
| NewsAPI.ai | Trade press discovery (80K+ sources) | ~$5/month |

**Phase 2 cost:** $0 (Remote Trigger uses Max tokens via Claude Opus)

---

## Version History

| Version | Milestone |
|---------|-----------|
| v1.0 | Portal launch — feed, landscape, intake pipeline, Telegram digest |
| v1.1 | Algorithm v2 — capability-led scoring, three-layer discovery |
| v2.0 | Universal Inbox — editorial sign-off on everything, Editorial Studio |

---

## Key Directories

```
/Users/haresh/Desktop/Living Intelligence/living-intelligence/
├── app/                    # Next.js portal pages
├── components/             # Portal React components
├── lib/                    # Data loading, constants, utilities
├── data/                   # ALL content (JSON, git-tracked)
│   ├── intelligence/       # 43 IntelligenceEntry files
│   ├── thought-leadership/ # 8 ThoughtLeadershipEntry files
│   ├── competitors/        # 37 Competitor files
│   ├── capabilities/       # 7 capability dimensions
│   └── logos/              # Local SVG/PNG logos
├── intake-server/          # Node.js backend
│   ├── server.js           # Express server, all API routes
│   ├── agents/             # 27 agent files (18 active, 9 legacy)
│   ├── prompts/            # Versioned prompt files (5)
│   ├── scripts/            # CLI tools (tests, backfill, audit)
│   ├── client/             # Editorial Studio React app (Vite)
│   └── public/             # Built client assets
├── docs/                   # Architecture docs
│   └── final/              # THIS FOLDER — definitive references
├── supabase/               # DDL schemas
└── scripts/                # Portal-level scripts
```
