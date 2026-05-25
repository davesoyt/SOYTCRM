import { NextResponse } from 'next/server'
import {
  getIntegrationWebhookSecret,
  processStripeEventForIntegration,
  verifyStripeEvent,
} from '@/lib/webhooks/stripeProcess'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ integrationId: string }> }

/** Stripe webhook for a single configured integration (recommended). */
export async function POST(request: Request, context: RouteContext) {
  const { integrationId } = await context.params
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let secret: string
  try {
    secret = await getIntegrationWebhookSecret(integrationId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Integration not found'
    return NextResponse.json({ error: message }, { status: 404 })
  }

  try {
    const event = await verifyStripeEvent(body, signature, secret)
    const delivery = await processStripeEventForIntegration(integrationId, event)
    return NextResponse.json({
      ok: true,
      eventId: event.id,
      eventType: event.type,
      ...delivery,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed'
    console.error('[stripe webhook]', integrationId, message)
    const status = message.includes('signature') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
