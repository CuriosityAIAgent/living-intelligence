---
name: Supabase + Stripe — Design Preferences
description: User preferences for auth/subscription implementation. Solo founder — minimize custom code, use platform features. Final decisions from session 20.
type: feedback
---

Use Stripe for EVERYTHING billing-related — no local subscription tables, no custom management UI.

**Why:** Haresh is a solo founder doing everything. Every custom-built piece is maintenance burden. Stripe Dashboard, Customer Portal, and webhooks handle 95% of subscription management.

**How to apply:**
- Friends access = Stripe 100% off coupon (not a separate invite code system)
- Coupon management (disable, expiry, max uses) = Stripe Dashboard
- Subscription cancellation = Stripe Dashboard → webhook updates org status
- Team seat management = simple onboarding page only (admin enters emails)
- Login = Google + magic link + password (3 options, covers enterprise + startups)
- Welcome emails = Stripe templates or single API call in webhook
- No separate system for any use case that Stripe/Supabase already handles
