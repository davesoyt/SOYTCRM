import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { applyWebhookIntegration } from '@/lib/webhooks/applyIntegration'
import { integrationFromRow, type WebhookApplyResult } from '@/lib/webhooks/types'

export type StripeDeliveryResult = {
  integrationId: string
  integrationName: string
  duplicate: boolean
  result: WebhookApplyResult
}

function resolveWebhookSecret(integrationSecret: string): string {
  if (integrationSecret.trim()) return integrationSecret.trim()
  const env = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (env) return env
  throw new Error('Webhook signing secret not configured on integration or STRIPE_WEBHOOK_SECRET')
}

export async function verifyStripeEvent(
  body: string,
  signature: string,
  secret: string,
): Promise<Stripe.Event> {
  return Stripe.webhooks.constructEvent(body, signature, secret)
}

export async function processStripeEventForIntegration(
  integrationId: string,
  event: Stripe.Event,
): Promise<StripeDeliveryResult> {
  const row = await prisma.webhookIntegration.findUnique({ where: { id: integrationId } })
  if (!row) throw new Error('Webhook integration not found')
  const integration = integrationFromRow(row)

  const seen = await prisma.processedWebhookDelivery.findUnique({
    where: { integrationId_eventId: { integrationId, eventId: event.id } },
  })
  if (seen) {
    return {
      integrationId,
      integrationName: integration.name,
      duplicate: true,
      result: { action: 'skipped', reason: 'already processed' },
    }
  }

  const result = await applyWebhookIntegration(integration, event, event.type)

  await prisma.processedWebhookDelivery.create({
    data: {
      integrationId,
      eventId: event.id,
      eventType: event.type,
    },
  })

  return {
    integrationId,
    integrationName: integration.name,
    duplicate: false,
    result,
  }
}

export async function processStripeEventAllIntegrations(
  event: Stripe.Event,
): Promise<StripeDeliveryResult[]> {
  const rows = await prisma.webhookIntegration.findMany({
    where: { provider: 'stripe', enabled: true },
    orderBy: { createdAt: 'asc' },
  })

  const results: StripeDeliveryResult[] = []
  for (const row of rows) {
    const integration = integrationFromRow(row)
    if (integration.eventTypes.length > 0 && !integration.eventTypes.includes(event.type)) {
      continue
    }
    results.push(await processStripeEventForIntegration(row.id, event))
  }
  return results
}

export async function getIntegrationWebhookSecret(integrationId: string): Promise<string> {
  const row = await prisma.webhookIntegration.findUnique({ where: { id: integrationId } })
  if (!row) throw new Error('Webhook integration not found')
  return resolveWebhookSecret(row.webhookSecret)
}
