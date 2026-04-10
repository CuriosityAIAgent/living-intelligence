---
name: Platform Architecture — Comprehensive Design Thinking
description: Seasoned architect-level thinking about the full platform. Analytics, API design, multi-tenant, scalability. Session 20 final thinking before build.
type: project
---

# Platform Architecture — Build It Right From Day One

**Context:** This is going to be a multi-million dollar, multi-vertical business. The foundation must be production-grade.

## Analytics / User Activity — Use External Service + Light DB Table

**Decision: Use PostHog (or Mixpanel) for behavioral analytics. Keep lightweight Supabase table for recommendations + ROI.**

| Need | Solution | Why not build it |
|------|----------|-----------------|
| Time on page, scroll depth, heatmaps | **PostHog** (free tier, self-hostable) | Would take months to build, PostHog does it in one JS snippet |
| Session recordings (watch what users click) | **PostHog Session Replay** | Impossible to replicate — shows exactly where users get stuck |
| Funnels (signup → onboarding → first read) | **PostHog Funnels** | Pre-built, visual, filterable by org/role |
| Retention (do users come back weekly?) | **PostHog Retention** | Automated cohort analysis |
| "Your team read 47 articles this quarter" | **Supabase `user_activity` table** | Simple query per org, powers ROI emails |
| "You might be interested in..." | **Supabase `user_activity` + vector search** | Needs to be in our DB to join with content |
| "Alert me about BofA" | **Supabase `user_watchlist`** | Needs to be in our DB to trigger notifications |

**PostHog setup:** One `<script>` tag in the portal. Auto-captures page views, clicks, and custom events. Free up to 1M events/month. No infrastructure to manage.

**What goes in Supabase `user_activity`:** Only the events WE need for product features (recommendations, ROI reports, watchlist triggers). PostHog handles the rest.

## Comprehensive Schema — 14 Tables + External Analytics

### Auth (2 tables)
- `organizations` — Stripe customer, tier, max seats, status, usage_stats
- `user_profiles` — auth user, org, role, preferences

### KB Core (8 tables)
- `sources` — raw markdown + embedding (the research library)
- `published_entries` — what we wrote + embedding (the magazine)
- `landscape_profiles` — AI strategy + capabilities + embedding (competitive context)
- `research_briefs` — structured research output (pipeline intermediate)
- `editorial_decisions` — approve/reject + reasons (persona training)
- `companies` + `company_verticals` — shared entities across verticals
- `verticals` — wealth, banking, insurance
- `pipeline_runs` — audit trail

### Engagement (4 tables)
- `user_activity` — page views, searches (light — PostHog handles heavy analytics)
- `user_watchlist` — company/capability alerts
- `entry_versions` — content versioning (safety net)
- `source_domains` — aggregate source reliability (quality flywheel)

### Key Fields Added to Existing Tables
- `deleted_at` on all content tables (soft delete)
- `supersedes`, `related_landscape_ids`, `tags` on published_entries
- `evidence_entry_ids` on landscape_profiles
- `search_vector tsvector` on published_entries (full-text search)
- RLS policies on user_activity, user_watchlist

## Scalability Considerations (Seasoned Architect Perspective)

### 1. API-First Design
Portal should consume content via Supabase client, not just static JSON. This enables:
- Real-time updates (new entry appears without git push + rebuild)
- Future mobile app (same API)
- Partner integrations / white-labeling
- API access as premium tier feature

**Migration path:** Start with static JSON (current), add Supabase reads for recommendations + activity. Gradually shift content serving to Supabase as subscriber count grows. No big bang migration needed.

### 2. Event-Driven Architecture
When things happen, fire events:
- New entry published → notify watchlist subscribers
- Landscape capability upgraded → notify followers of that company
- New subscriber signs up → trigger welcome sequence
- Entry version changed → log to entry_versions

**Implementation:** Supabase has built-in Realtime (WebSocket) + Database Webhooks. Can trigger Edge Functions on insert/update. No external queue needed at this scale.

### 3. Multi-Tenant Data Isolation
- RLS on all user-facing tables (Supabase native)
- org_id on user_activity, user_watchlist — one firm can't see another's data
- Content tables (entries, landscape) are shared — all subscribers see same intelligence
- Future: per-org custom views / dashboards

### 4. White-Label / B2B2B Potential
A consulting firm buys 10 seats and resells to their clients under their brand.
- `organizations.parent_org_id` — enables reseller hierarchy
- `organizations.branding JSONB` — custom logo, colors, domain
- Don't build now, but schema supports it with one field addition

### 5. API Access as Premium Tier
Enterprise customers ($25K+/yr) might want API access to feed intelligence into their own dashboards.
- Supabase generates API keys per org
- Rate limiting via Supabase Edge Functions
- Metered billing via Stripe usage-based pricing
- Schema already supports it — just add an API key table when needed

### 6. Content Delivery Evolution
```
Phase 1 (now):     Static JSON in git → Next.js SSG → fast, simple
Phase 2 (soon):    Static JSON + Supabase for recommendations/activity
Phase 3 (scale):   Supabase as primary content store → Next.js ISR/SSR
Phase 4 (future):  CDN-cached API responses → sub-100ms globally
```

### 7. Notification System
- Email: Resend or SendGrid (not Supabase — use purpose-built tools)
- In-app: Supabase Realtime (WebSocket push)
- Watchlist triggers: Supabase Database Webhook on published_entries insert → Edge Function → email
- Don't build notification tables — use external service with webhooks

### 8. Compliance / Enterprise Readiness
Financial services clients will ask about:
- **Data residency:** Supabase supports region selection (EU, US, APAC)
- **SOC 2:** Supabase is SOC 2 Type II compliant
- **Audit logs:** user_activity table + PostHog = full audit trail
- **Data export:** GDPR requires it — Supabase has built-in export
- **SSO (SAML):** Supabase supports SAML for enterprise SSO (when clients demand it)
- **Encryption:** Supabase encrypts at rest + in transit by default

### 9. Backup & Disaster Recovery
- Supabase Pro: daily backups, 7-day retention, point-in-time recovery
- Portal content: also in git (double backup)
- Critical: test restore once before launch

### 10. Performance at Scale
- Vector search: IVFFlat index fine for <100K rows. Switch to HNSW at 500K+.
- Full-text search: GIN index on tsvector — PostgreSQL handles millions of rows
- Connection pooling: Supabase PgBouncer built-in (Railway + CLI + portal all connecting)
- Caching: Next.js ISR caches pages, Supabase has built-in response caching

## Cost at Scale

| Scale | Supabase | PostHog | Stripe | Resend | Total |
|-------|----------|---------|--------|--------|-------|
| 0-50 orgs | $25/mo | Free | 3.6% | Free | ~$30/mo |
| 50-200 orgs | $25/mo | Free | 3.6% | $20/mo | ~$50/mo |
| 200-1000 orgs | $599/mo (Team) | $450/mo | 3.6% | $100/mo | ~$1,150/mo |
| Revenue at 200 orgs × $5K | | | | | $1M ARR |

At $1M ARR, infrastructure costs ~$14K/year (1.4%). Excellent unit economics.

## What NOT to Build

- ❌ Custom analytics dashboard (use PostHog)
- ❌ Email delivery system (use Resend/SendGrid)
- ❌ Payment/billing UI (use Stripe)
- ❌ Session management (use Supabase Auth)
- ❌ CDN (Railway/Vercel handles this)
- ❌ Search engine (PostgreSQL tsvector + pgvector is enough)
- ❌ Notification queue (Supabase webhooks + Edge Functions)

## Build Sequence (Updated)

```
SESSION 21:
  1. Create Supabase project
  2. Run ALL DDL (14 tables + indexes + RLS + functions)
  3. Build auth (middleware, login, webhook) — 7 files
  4. Add PostHog snippet to portal
  5. Stripe products + coupon
  6. Test end-to-end: signup → login → portal access

SESSION 22:
  7. Build kb-client.js
  8. Run backfill (sources + published_entries + landscape_profiles)
  9. Build recommendation queries
  10. Add "Related reading" to portal article pages

SESSION 23:
  11. Content producer CLI (research → write → evaluate → refine)
  12. Watchlist + notification triggers
  13. ROI report query ("your team read X articles")

SESSION 24:
  14. Pipeline integration (scheduler stores to KB)
  15. Editorial decision capture
  16. Source domain reliability tracking
```
