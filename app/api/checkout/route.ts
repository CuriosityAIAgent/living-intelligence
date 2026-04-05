import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  try {
    const { coupon, priceId } = await request.json()

    // Default to standard price if not specified
    const selectedPrice = priceId || process.env.STRIPE_PRICE_STANDARD

    const sessionParams: Record<string, unknown> = {
      mode: 'subscription',
      line_items: [{ price: selectedPrice, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'https://livingintel.ai' : 'http://localhost:3002'}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'https://livingintel.ai' : 'http://localhost:3002'}/join`,
      // Collect customer details
      customer_creation: 'always',
      billing_address_collection: 'required',
      // Allow promotion codes (including FRIEND2026)
      allow_promotion_codes: true,
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
