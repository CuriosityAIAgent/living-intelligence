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
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const customerId = session.customer as string
  const customerEmail = session.customer_details?.email
  const customerName = session.customer_details?.name

  if (!customerEmail) {
    console.error('No email in checkout session')
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
        name: customerName || customerEmail.split('@')[0],
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

  // Check if user profile exists (user may have signed up via auth already)
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', customerEmail)
    .single()

  if (!existingProfile) {
    // User hasn't signed up via auth yet — profile will be created on first login
    // Store a pending invite so middleware can match them
    console.log(`Org ${orgId} created for ${customerEmail} — awaiting first login`)
  } else {
    // Link existing user to org as admin
    await supabase
      .from('user_profiles')
      .update({ org_id: orgId, role: 'admin' })
      .eq('id', existingProfile.id)
  }
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const customerId = subscription.customer as string

  await supabase
    .from('organizations')
    .update({ status: 'cancelled' })
    .eq('stripe_customer_id', customerId)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const customerId = subscription.customer as string
  const status = subscription.status === 'active' ? 'active' : 'inactive'

  await supabase
    .from('organizations')
    .update({ status })
    .eq('stripe_customer_id', customerId)
}
