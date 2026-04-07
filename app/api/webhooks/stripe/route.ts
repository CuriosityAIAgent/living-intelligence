import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  // If webhook secret is set, verify signature. Otherwise accept (for testing).
  let event: Stripe.Event

  if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  } else {
    event = JSON.parse(body) as Stripe.Event
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutComplete(session)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCancelled(subscription)
        break
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const { createAdminClient } = await import('@/lib/supabase-server')
  const supabase = createAdminClient()

  const customerId = session.customer as string
  const userId = session.client_reference_id // Supabase user ID (set in checkout route)
  const customerEmail = session.customer_details?.email
  const customerName = session.customer_details?.name

  if (!customerEmail && !userId) {
    console.error('No email or user ID in checkout session')
    return
  }

  // Determine tier from price
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
  const priceId = lineItems.data[0]?.price?.id
  let tier = 'standard'
  if (priceId === process.env.STRIPE_PRICE_FOUNDING) {
    tier = 'founding'
  }

  // Check if org already exists for this Stripe customer
  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  let orgId: string

  if (existingOrg) {
    orgId = existingOrg.id
    // Update org status to active (in case of resubscription)
    await supabase
      .from('organizations')
      .update({ status: 'active', tier })
      .eq('id', orgId)
  } else {
    // Create new organization
    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: customerName || customerEmail?.split('@')[0] || 'New Organization',
        stripe_customer_id: customerId,
        tier,
        max_seats: 5,
        status: 'active',
      })
      .select('id')
      .single()

    if (orgError) {
      console.error('Failed to create org:', orgError)
      return
    }
    orgId = newOrg.id
  }

  // Link user profile to org — prefer client_reference_id (reliable), fall back to email match
  let profileId: string | null = null

  if (userId) {
    // Direct match via Supabase user ID (set as client_reference_id in checkout)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single()
    if (profile) profileId = profile.id
  }

  if (!profileId && customerEmail) {
    // Fallback: match by email (handles cases where user wasn't signed in during checkout)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', customerEmail)
      .single()
    if (profile) profileId = profile.id
  }

  if (profileId) {
    // Link user to org as admin
    await supabase
      .from('user_profiles')
      .update({ org_id: orgId, role: 'admin' })
      .eq('id', profileId)
    console.log(`Org ${orgId} linked to user ${profileId} as admin`)
  } else {
    console.log(`Org ${orgId} created for ${customerEmail} — awaiting first login`)
  }
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const { createAdminClient } = await import('@/lib/supabase-server')
  const supabase = createAdminClient()

  const customerId = subscription.customer as string

  await supabase
    .from('organizations')
    .update({ status: 'cancelled' })
    .eq('stripe_customer_id', customerId)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const { createAdminClient } = await import('@/lib/supabase-server')
  const supabase = createAdminClient()

  const customerId = subscription.customer as string
  const status = subscription.status === 'active' ? 'active' : 'inactive'

  await supabase
    .from('organizations')
    .update({ status })
    .eq('stripe_customer_id', customerId)
}
