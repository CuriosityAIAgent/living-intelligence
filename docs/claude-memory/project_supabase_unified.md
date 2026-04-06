---
name: Unified Supabase Plan — Auth + Stripe Billing + KB
description: Supabase for auth (Google + magic link + password), Stripe owns billing, friends get 100% off coupon (no card). Final design session 20.
type: project
---

# Unified Supabase Plan

**Status:** AUTH BUILT + DEPLOYMENT READY (session 21, 2026-04-05). Supabase project live (Pro, Micro, Europe, "Curiosity AI"). Google OAuth working. 14 tables deployed. 10 auth files built. PostHog added. Local build passes. Code sitting on main (uncommitted) — ready to commit + push. Not yet deployed to production. Stripe checkout not yet tested end-to-end. Session 22 = push to main + set Railway env vars + test Stripe end-to-end.

## Architecture

| Platform | Owns | Managed via |
|----------|------|-------------|
| **Stripe** | Payments, subscriptions, invoices, customer portal, coupons (friend access) | Stripe Dashboard |
| **Supabase** | Auth (3 methods), user profiles, organizations | Supabase Dashboard |
| **Portal middleware** | One check: logged in + org active | Code |

## Login — Three Methods

| Method | For whom |
|--------|----------|
| **Google OAuth** | Startups, fintechs, smaller firms with Google Workspace |
| **Magic link** | Bank CXOs, enterprise users where Google OAuth is blocked |
| **Email + password** | Anyone who prefers traditional login |

All capture email. Supabase Auth supports all three — one config toggle each.

## Friends — No Credit Card

Stripe Checkout with `payment_method_collection: 'if_required'` + 100% off coupon skips card form entirely. Friend enters email + name → $0 → access.

## Supabase Schema (2 tables)

```sql
CREATE TABLE organizations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT,
  stripe_customer_id  TEXT UNIQUE,
  tier                TEXT DEFAULT 'standard',  -- 'founding', 'standard', 'free'
  max_seats           INTEGER DEFAULT 5,
  status              TEXT DEFAULT 'active',
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT,
  company     TEXT,
  org_id      UUID REFERENCES organizations(id),
  role        TEXT DEFAULT 'member',     -- 'admin' or 'member'
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

## Supabase Auth Config

- Providers: Email (magic link + password), Google OAuth
- Site URL: https://wealth.tigerai.tech
- Redirect URLs: https://wealth.tigerai.tech/api/auth/callback
- Session duration: 30 days

## Flows

**Paid customer:** Landing page → Stripe Checkout ($4,500/$5,000) → webhook → create org + admin → redirect to portal → "Add your team" (up to 5 emails) → team gets invite email → login

**Friend (free):** Haresh shares link with coupon FRIEND2026 → Stripe Checkout → $0, no card → same webhook → same flow

**Login:** Google (one click) / magic link (check inbox) / password — all on same /login page

**Manage billing:** Portal link → Stripe Customer Portal (hosted)

**Middleware:** logged in? → email in user_profiles? → org active? → allow. Otherwise → /login.

## Stripe Setup

- Products: Founding $4,500/yr, Standard $5,000/yr
- Coupon: FRIEND2026, 100% off, 1 month duration, max 20 redemptions
- Checkout: payment_method_collection 'if_required', collect email + name + company
- Success URL: wealth.tigerai.tech/onboarding
- Customer Portal: enabled (update payment, view invoices, cancel)

## Files to Build (7)

| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Browser + server clients |
| `middleware.ts` | Session + org check |
| `app/login/page.tsx` | Google button + email + magic link/password toggle |
| `app/api/auth/callback/route.ts` | OAuth + magic link redirect handler |
| `app/api/webhooks/stripe/route.ts` | Checkout → create org + admin profile |
| `app/onboarding/page.tsx` | "Add your team" (up to 5 emails) |
| `app/join/page.tsx` | Reads ?coupon= param, redirects to Stripe Checkout |

## Env Vars

**Note (2026-04-05):** Supabase has renamed API keys. The old `anon` key is now called **Publishable** key (`sb_publishable_...`). The old `service_role` key is now called **Secret** key (`sb_secret_...`). Functionality is identical — just new naming. Legacy keys still visible under "Legacy anon, service_role API Keys" link.

Portal: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
Stripe: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, price IDs

## Build Sequence

1. Haresh: Create Supabase project + enable Google OAuth + share keys
2. Claude: Run DDL, build 7 files, test locally
3. Haresh: Create Stripe account + products + FRIEND2026 coupon + share keys
4. Claude: Wire webhook + checkout + test end-to-end
5. Push to main → Railway deploys

## Phase 3: Knowledge Base (LATER)

Same Supabase project, add KB tables. No conflicts. Full schema at project_knowledge_base.md.
