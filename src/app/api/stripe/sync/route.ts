import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripeSecretKey, stripeSyncSecret } from '@/lib/stripe/config'
import {
  getVbObjectDef,
  mapStripeEventToVbData,
  upsertVbFromStripeData,
  type VbSyncResult,
} from '@/lib/stripe/vbSync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorizeSync(request: Request): boolean {
  const secret = stripeSyncSecret()
  if (!secret) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

/**
 * Backfill Venue Billing (VB) records from recent Stripe payment intents.
 * POST /api/stripe/sync?limit=100
 * Header: Authorization: Bearer <STRIPE_SYNC_SECRET>
 */
export async function POST(request: Request) {
  if (!authorizeSync(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 1), 500)

  try {
    const stripe = new Stripe(stripeSecretKey())
    const vbDef = await getVbObjectDef()
    const intents = await stripe.paymentIntents.list({ limit })

    const results: VbSyncResult[] = []
    for (const pi of intents.data) {
      if (pi.status !== 'succeeded') continue
      const fakeEvent = {
        id: `sync_pi_${pi.id}`,
        type: 'payment_intent.succeeded',
        data: { object: pi },
      } as Stripe.Event
      const payload = mapStripeEventToVbData(fakeEvent)
      if (!payload) continue
      const result = await upsertVbFromStripeData(vbDef.id, payload, 'create_only')
      results.push(result)
    }

    const summary = {
      scanned: intents.data.length,
      created: results.filter((r) => r.action === 'created').length,
      skipped: results.filter((r) => r.action === 'skipped').length,
      updated: results.filter((r) => r.action === 'updated').length,
    }

    return NextResponse.json({ ok: true, ...summary, results })
  } catch (err) {
    console.error('[stripe sync]', err)
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
