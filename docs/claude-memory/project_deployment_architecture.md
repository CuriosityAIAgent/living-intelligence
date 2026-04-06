---
name: Deployment Architecture — livingintel.ai is the product
description: livingintel.ai (profound-wonder, feature/landing-page branch) is the full product. wealth.tigerai.tech (main) is frozen for JPM. Decision made session 22.
type: project
---

# Deployment Architecture (Session 22, 2026-04-05)

## The Three Services

| Service | Branch | Domain | Role |
|---------|--------|--------|------|
| `profound-wonder` | `feature/landing-page` | livingintel.ai | **THE product** — landing page + auth + portal. All new work goes here. |
| `proud-reflection` | `intake` | (internal) | Intake server / Editorial Studio. Unchanged. |
| `living-intelligence` | `main` | wealth.tigerai.tech | **FROZEN** — shared internally at JP Morgan. Do NOT push changes. Will be retired in ~2 months. |

**Why:** Haresh shared wealth.tigerai.tech with people inside JPM. Pushing auth or any breaking changes there would disrupt their access. All new development (auth, checkout, portal improvements) goes to `feature/landing-page` → livingintel.ai.

**How to apply:**
- NEVER push portal changes to `main` until Haresh explicitly says to retire wealth.tigerai.tech
- All portal + auth + landing page work → `feature/landing-page` branch
- Content publishing (intake pipeline) still pushes to `main` — this is fine (just adds JSON data files, doesn't break anything)
- When ready to retire: point wealth.tigerai.tech to livingintel.ai via redirect, then decommission `living-intelligence` service
