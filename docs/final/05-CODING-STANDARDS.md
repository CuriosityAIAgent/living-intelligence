# Coding Standards & Quality Gates
**Definitive Reference — April 17, 2026**

---

## Code Style

- **TypeScript strict** — no `any`, no `@ts-ignore`
- **Tailwind only** — no CSS modules, no inline `style=` unless dynamic (Note: Editorial Studio uses inline styles because Tailwind v4 utility classes are unreliable in Vite build)
- **Server Components by default** — `'use client'` only when hooks needed
- **async/await** — no `.then()` chains
- **Prefer editing existing files** over creating new ones
- **No database for portal** — everything is flat JSON files read at build time via `lib/data.ts`
- **Single config file** — `intake-server/agents/config.js` is source of truth for all paths, thresholds, constants. No agent defines its own paths.

---

## Git Workflow

### Branching Rules

| Branch | Purpose | Auto-deploys |
|--------|---------|-------------|
| `main` | Stable production | Portal on `wealth.tigerai.tech` |
| `intake` | Active development | Intake server on Railway |
| `feature/landing-page` | Public landing page | `livingintel.ai` |

### Rules

1. **Never push untested code directly to `main`** — immediately redeploys public portal
2. **All code changes start on `intake`** → develop → commit → push → test on Railway
3. **Merge to `main` only when tested**: `git checkout main && git merge intake && git push`
4. **Content publishing** pushes directly to `main` (intentional — triggers portal rebuild)
5. **`feature/landing-page`** is independent

### Semantic Versioning

Tag `main` after significant milestones: `git tag -a vX.Y HEAD -m "vX.Y: description" && git push origin vX.Y`

- Major (v1→v2): architecture changes, new editorial workflow
- Minor (v1.0→v1.1): significant new feature

---

## Hooks — Automated Quality Gates

### PreToolUse (Blocking)

| Hook | Fires On | What It Does |
|------|----------|-------------|
| `check-push-main.sh` | `git push` | Currently a no-op (allows pushes to main for portal deploys) |
| `pre-commit-checks.sh` | `git commit` | `node --check` on .js, `tsc --noEmit` on .ts/.tsx |
| `enforce-doc-updates.sh` | `git commit` | **BLOCKS** if agent code changed without docs/ staged |
| `pre-push-tests.sh` | `git push` | Smoke tests (intake) or build (main). Checks `.evaluator-pass` stamp. |
| `enforce-memory-on-push.sh` | `git push` | **BLOCKS** if memory files not updated since last commit |
| `code-evaluator.sh` | `git commit` | Sonnet code review via API. FAIL blocks commit. PASS writes `.evaluator-pass` stamp. |

### PostToolUse (Advisory)

| Hook | Fires On | What It Does |
|------|----------|-------------|
| `check-banned-urls.sh` | Write/Edit | Blocks clearbit/unavatar URLs in data files |
| `compact-reminder.sh` | Write/Edit | Reminds to compact after 40 edits |
| `check-ai-patterns.sh` | Write/Edit | Flags AI writing patterns in data content files |
| `post-commit-memory-reminder.sh` | `git commit` | Reminds to update memory files |

### SessionStart

| Hook | Fires On | What It Does |
|------|----------|-------------|
| `session-start-audit.sh` | Session start | Smoke tests + stale docs check |

### Enforcement Chain

```
git add → stage files
git commit → code-evaluator.sh → Sonnet reviews diff → PASS writes .evaluator-pass
         → pre-commit-checks.sh → syntax/type checks
         → enforce-doc-updates.sh → docs staged?
git push → pre-push-tests.sh → smoke tests + .evaluator-pass check
        → enforce-memory-on-push.sh → memory files updated?
```

---

## Testing

### Unit Tests
- **135 tests** across 15 suites
- Run: `cd intake-server && node --env-file=.env scripts/run-tests.js`

### Smoke Tests
- **7 data integrity checks** (JSON validity, required fields, slug consistency, banned URLs)
- Run: `cd intake-server && node scripts/smoke-test.js`

### E2E Tests
- **58 tests** — Playwright + Chromium
- Sections: landing page, auth gate, authenticated portal, editorial studio, performance
- Auth: Supabase admin API creates test user (no Google/magic link needed)
- Run: `cd intake-server && node scripts/e2e-test.cjs --auth --screenshots`

### Portal Health
- URL verification for all intelligence + TL entries
- Run: `cd intake-server && node scripts/test-portal.js --fast`

### Before Every Push

| Branch | Required |
|--------|----------|
| `intake` | Smoke tests + unit tests + `.evaluator-pass` stamp |
| `main` | `npx next build` (full portal build) |

---

## Documentation Mandate

**Every code change MUST update affected docs before committing.** Enforced by `enforce-doc-updates.sh` hook.

| Changed | Update |
|---------|--------|
| `intake-server/agents/` | `docs/agents-and-architecture.md` |
| External API calls | `docs/integrations.md` |
| Data counts | `docs/architecture.md` + memory files |
| API routes | `docs/agents-and-architecture.md` API table |
| Brand/UI rules | CLAUDE.md Brand section |

### Before Every Commit (Mental Checklist)

1. Does `docs/agents-and-architecture.md` describe current agents?
2. Does `docs/integrations.md` list all external APIs?
3. Does `docs/architecture.md` show correct counts (43 intel, 8 TL, 37 landscape)?
4. Does memory file reflect what was built?

---

## Skills (7 Total)

| Skill | Trigger | Status |
|-------|---------|--------|
| `/add-entry` | Add intelligence entry | Production-ready |
| `/add-company` | Add landscape company | Production-ready |
| `/add-tl` | Add thought leadership | Production-ready |
| `/produce` | Run v2 content production | Production-ready |
| `/catchup` | Session start briefing | Production-ready |
| `/audit` | Content quality audit | Needs v2 update (missing KB health checks) |
| `/new-vertical` | Set up new vertical | Production-ready |
| `/humanizer` | Remove AI writing patterns | Production-ready (global skill) |

---

## Environment Variables

### Intake Server (.env)
```
ANTHROPIC_API_KEY=          # Claude API (Phase 1 agents)
JINA_API_KEY=               # Article extraction + search + embeddings
DATAFORSEO_LOGIN=           # Discovery + backlinks
DATAFORSEO_PASSWORD=
NEWSAPI_KEY=                # Trade press discovery (optional)
SUPABASE_URL=               # Knowledge Base
SUPABASE_SERVICE_KEY=       # KB admin access
TRIGGER_SECRET=             # Remote Trigger bearer token auth
STUDIO_USER=                # Basic Auth for Editorial Studio
STUDIO_PASS=
STATE_DIR=                  # Railway: /data (persistent volume). Local: defaults to data/
```

### Portal (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=       # For SSR auth
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_POSTHOG_KEY=    # Analytics (stub)
```
