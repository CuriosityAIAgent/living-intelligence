import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  try {
    const { coupon, tier } = await request.json()

    // Get authenticated user (if signed in) to link Stripe checkout to Supabase user
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? 'https://livingintel.ai' : 'http://localhost:3002'

    // Map tier to price ID
    const selectedPrice = tier === 'founding'
      ? process.env.STRIPE_PRICE_FOUNDING
      : process.env.STRIPE_PRICE_STANDARD

    const sessionParams: Record<string, unknown> = {
      mode: 'subscription',
      line_items: [{ price: selectedPrice, quantity: 1 }],
      success_url: `${baseUrl}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/join`,
      // Collect customer details
      customer_creation: 'always',
      billing_address_collection: 'required',
      // Allow promotion codes (including FRIEND2026)
      allow_promotion_codes: true,
      // Link to Supabase user for reliable webhook matching
      ...(user?.id && { client_reference_id: user.id }),
      ...(user?.email && { customer_email: user.email }),
    }

    // If a coupon code is provided directly, apply it
    if (coupon) {
      // Use discounts instead of allow_promotion_codes when coupon is pre-applied
      delete sessionParams.allow_promotion_codes
      sessionParams.discounts = [{ coupon }]
      // Friends with 100% coupon don't need a card
      sessionParams.payment_method_collection = 'if_required'
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err)
    const message = err instanceof Error ? err.message : 'Failed to create checkout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
