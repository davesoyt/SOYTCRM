import { NextResponse } from 'next/server'
import { processStripeEventAllIntegrations, verifyStripeEvent } from '@/lib/webhooks/stripeProcess'
import { stripeWebhookSecret } from '@/lib/stripe/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Stripe webhook — runs all enabled integrations matching the event type. */
export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let secret: string
  try {
    secret = stripeWebhookSecret()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook secret not configured'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  try {
    const event = await verifyStripeEvent(body, signature, secret)
    const results = await processStripeEventAllIntegrations(event)
    return NextResponse.json({
      ok: true,
      eventId: event.id,
      eventType: event.type,
      results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    console.error('[stripe webhook]', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
