---
name: Living Intelligence — Subscription Stack Decision
description: Stripe + Supabase Auth + Iubenda + Google Workspace. Pricing, implementation path, and product setup. Ready to implement when needed.
type: project
---

## Subscription Stack — Decided 2026-03-28

**Why:** Portal authentication (B2C) for wealth.tigerai.tech. 7-day trial, $400/mo founding, $500/mo standard.

| Layer | Choice | Cost |
|-------|--------|------|
| Payments | Stripe Checkout + Billing | 3.6% + $0.30/txn (~$18/subscriber/month) |
| Auth | Supabase Auth | Free (50K MAU) |
| Content gating | Next.js middleware | Free (code) |
| Legal | Iubenda Ultra | $129/year |
| Email | Google Workspace | $7/month |

**Total fixed cost:** ~$18/month. Keep ~96% of each subscription.

## Stripe Product Setup

| Product | Price | Trial | Notes |
|---------|-------|-------|-------|
| Founding Member Monthly | $400/mo | 7 days | Coupon: 20% off, max 50 redemptions, forever |
| Founding Member Annual | $4,000/yr | 7 days | Same coupon |
| Individual Monthly | $500/mo | 7 days | Standard (after first 50) |
| Individual Annual | $5,000/yr | 7 days | Save $1,000 messaging |
| Team | Custom | — | Manual invoicing |

## Implementation Path

1. Set up Google Workspace for hello@livingintel.ai
2. Create Stripe account + products/prices
3. Generate legal pages via Iubenda, add as /privacy and /terms routes
4. Clone Vercel nextjs-subscription-payments template, wire into existing portal
5. Add middleware to gate wealth.tigerai.tech routes
6. Update landing page CTAs to point to Stripe Checkout

## Why These Choices

- **Not Lemon Squeezy/Paddle:** 5-6.5% fees vs Stripe 3.6%. MoR not needed at launch.
- **Not Memberful:** Double-dips on fees (7.8% + $49/mo). WordPress-focused.
- **Not Ghost:** Requires CMS migration. Good economics but wrong architecture.
- **Supabase over Clerk:** Vercel has official template. Free tier covers 50K users.
- **Iubenda over Termly:** Better GDPR/UK compliance, $129/yr covers everything.

## How to apply

When Haresh says "let's set up subscriptions" or "let's do the auth" — reference this file for the decided stack. Don't re-research.
