import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { vbObjectSlug } from '@/lib/stripe/config'

export type VbRecordData = {
  business_name: string
  date: string
  source: string
  amount: string
  trx_id: string
  notes: string
}

export type VbSyncResult =
  | { action: 'skipped'; reason: string }
  | { action: 'created'; recordId: string; trxId: string }
  | { action: 'updated'; recordId: string; trxId: string }

const SUPPORTED_TYPES = new Set([
  'payment_intent.succeeded',
  'charge.succeeded',
  'invoice.paid',
  'invoice.payment_succeeded',
])

function formatAmount(cents: number | null | undefined, currency?: string): string {
  if (cents == null) return ''
  const major = (cents / 100).toFixed(2)
  const cur = (currency ?? 'usd').toUpperCase()
  return `${major} ${cur}`
}

function formatDate(unixSeconds: number | null | undefined): string {
  if (unixSeconds == null) return new Date().toISOString().slice(0, 10)
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

function parseRecordData(json: string): Record<string, string> {
  try {
    const v = JSON.parse(json || '{}')
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, String(val ?? '')]),
      )
    }
  } catch { /* ignore */ }
  return {}
}

export async function getVbObjectDef() {
  const slug = vbObjectSlug()
  const def = await prisma.customObjectDef.findUnique({ where: { slug } })
  if (!def) {
    throw new Error(
      `Venue Billing object not found (slug "${slug}"). Create it in Setup → Objects or set STRIPE_VB_OBJECT_SLUG.`,
    )
  }
  return def
}

export async function findVbRecordByTrxId(objectDefId: string, trxId: string) {
  const rows = await prisma.$queryRaw<{ id: string; data: string }[]>`
    SELECT id, data FROM "CustomObjectRecord"
    WHERE "objectDefId" = ${objectDefId}
    AND data::jsonb->>'trx_id' = ${trxId}
    LIMIT 1
  `
  return rows[0] ?? null
}

function buildNotes(parts: Record<string, string | undefined>): string {
  return Object.entries(parts)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

export function mapStripeEventToVbData(event: Stripe.Event): VbRecordData | null {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      const trxId = pi.id
      const meta = (pi.metadata ?? {}) as Record<string, string>
      return {
        business_name:
          meta.business_name?.trim() ||
          meta.venue_name?.trim() ||
          (typeof pi.description === 'string' ? pi.description : '') ||
          pi.receipt_email ||
          'Stripe payment',
        date: formatDate(pi.created),
        source: 'stripe',
        amount: formatAmount(pi.amount_received ?? pi.amount, pi.currency),
        trx_id: trxId,
        notes: buildNotes({
          event: event.id,
          type: event.type,
          customer: typeof pi.customer === 'string' ? pi.customer : undefined,
          status: pi.status,
        }),
      }
    }
    case 'charge.succeeded': {
      const ch = event.data.object as Stripe.Charge
      const trxId = ch.payment_intent
        ? typeof ch.payment_intent === 'string'
          ? ch.payment_intent
          : ch.payment_intent.id
        : ch.id
      const meta = (ch.metadata ?? {}) as Record<string, string>
      return {
        business_name:
          meta.business_name?.trim() ||
          meta.venue_name?.trim() ||
          ch.billing_details?.name ||
          ch.billing_details?.email ||
          'Stripe charge',
        date: formatDate(ch.created),
        source: 'stripe',
        amount: formatAmount(ch.amount, ch.currency),
        trx_id: trxId,
        notes: buildNotes({
          event: event.id,
          type: event.type,
          charge: ch.id,
          customer: typeof ch.customer === 'string' ? ch.customer : undefined,
        }),
      }
    }
    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      const inv = event.data.object as Stripe.Invoice
      return {
        business_name:
          inv.customer_name ||
          inv.customer_email ||
          (typeof inv.description === 'string' ? inv.description : '') ||
          'Stripe invoice',
        date: formatDate(inv.status_transitions?.paid_at ?? inv.created),
        source: 'stripe',
        amount: formatAmount(inv.amount_paid, inv.currency),
        trx_id: inv.id,
        notes: buildNotes({
          event: event.id,
          type: event.type,
          customer: typeof inv.customer === 'string' ? inv.customer : undefined,
          number: inv.number ?? undefined,
          status: inv.status ?? undefined,
        }),
      }
    }
    default:
      return null
  }
}

export async function upsertVbFromStripeData(
  objectDefId: string,
  payload: VbRecordData,
  mode: 'create_only' | 'upsert' = 'upsert',
): Promise<VbSyncResult> {
  if (!payload.trx_id.trim()) {
    return { action: 'skipped', reason: 'missing trx_id' }
  }

  const existing = await findVbRecordByTrxId(objectDefId, payload.trx_id)
  if (existing) {
    if (mode === 'create_only') {
      return { action: 'skipped', reason: 'record already exists' }
    }
    const prev = parseRecordData(existing.data)
    const merged: VbRecordData = {
      business_name: payload.business_name || prev.business_name || '',
      date: payload.date || prev.date || '',
      source: payload.source || prev.source || 'stripe',
      amount: payload.amount || prev.amount || '',
      trx_id: payload.trx_id,
      notes: payload.notes ? `${prev.notes ? `${prev.notes}\n` : ''}${payload.notes}` : prev.notes || '',
    }
    await prisma.customObjectRecord.update({
      where: { id: existing.id },
      data: { data: JSON.stringify(merged) },
    })
    return { action: 'updated', recordId: existing.id, trxId: payload.trx_id }
  }

  await prisma.customObjectRecord.create({
    data: {
      objectDefId,
      data: JSON.stringify(payload),
    },
  })
  const created = await findVbRecordByTrxId(objectDefId, payload.trx_id)
  return {
    action: 'created',
    recordId: created?.id ?? '',
    trxId: payload.trx_id,
  }
}

export async function syncStripeEventToVb(event: Stripe.Event): Promise<VbSyncResult> {
  if (!SUPPORTED_TYPES.has(event.type)) {
    return { action: 'skipped', reason: `unsupported event type: ${event.type}` }
  }

  const payload = mapStripeEventToVbData(event)
  if (!payload) {
    return { action: 'skipped', reason: 'could not map event to VB fields' }
  }

  const vbDef = await getVbObjectDef()
  return upsertVbFromStripeData(vbDef.id, payload, 'upsert')
}

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<{
  duplicate: boolean
  result: VbSyncResult
}> {
  const seen = await prisma.processedStripeEvent.findUnique({ where: { id: event.id } })
  if (seen) {
    return { duplicate: true, result: { action: 'skipped', reason: 'already processed' } }
  }

  const result = await syncStripeEventToVb(event)

  await prisma.processedStripeEvent.create({
    data: { id: event.id, type: event.type },
  })

  return { duplicate: false, result }
}
