export type WebhookFieldTransform =
  | 'text'
  | 'amount_major'
  | 'amount_display'
  | 'unix_date'

export type WebhookFieldMapping = {
  sourcePath: string
  targetField: string
  transform?: WebhookFieldTransform
  staticValue?: string
}

export type WebhookIntegrationConfig = {
  id: string
  name: string
  provider: string
  enabled: boolean
  targetKind: 'standard' | 'custom'
  targetSlug: string
  eventTypes: string[]
  fieldMappings: WebhookFieldMapping[]
  upsertFieldKey: string
  webhookSecret: string
}

export type WebhookApplyResult =
  | { action: 'skipped'; reason: string }
  | { action: 'created'; recordId: string }
  | { action: 'updated'; recordId: string }

export const STRIPE_EVENT_OPTIONS = [
  { value: 'payment_intent.succeeded', label: 'Payment Intent succeeded' },
  { value: 'charge.succeeded', label: 'Charge succeeded' },
  { value: 'invoice.paid', label: 'Invoice paid' },
  { value: 'invoice.payment_succeeded', label: 'Invoice payment succeeded' },
  { value: 'customer.created', label: 'Customer created' },
  { value: 'customer.updated', label: 'Customer updated' },
  { value: 'customer.subscription.created', label: 'Subscription created' },
  { value: 'customer.subscription.updated', label: 'Subscription updated' },
  { value: 'checkout.session.completed', label: 'Checkout session completed' },
] as const

export const STRIPE_PATH_HINTS = [
  { path: 'id', label: 'Event id' },
  { path: 'type', label: 'Event type' },
  { path: 'data.object.id', label: 'Object id' },
  { path: 'data.object.amount', label: 'Amount (cents)' },
  { path: 'data.object.amount_received', label: 'Amount received (cents)' },
  { path: 'data.object.amount_paid', label: 'Amount paid (cents)' },
  { path: 'data.object.currency', label: 'Currency' },
  { path: 'data.object.created', label: 'Created (unix)' },
  { path: 'data.object.description', label: 'Description' },
  { path: 'data.object.receipt_email', label: 'Receipt email' },
  { path: 'data.object.customer', label: 'Customer id' },
  { path: 'data.object.customer_email', label: 'Customer email' },
  { path: 'data.object.customer_name', label: 'Customer name' },
  { path: 'data.object.metadata.business_name', label: 'Metadata: business_name' },
  { path: 'data.object.metadata.venue_name', label: 'Metadata: venue_name' },
  { path: 'data.object.billing_details.name', label: 'Billing name' },
  { path: 'data.object.billing_details.email', label: 'Billing email' },
  { path: 'data.object.status', label: 'Status' },
  { path: 'data.object.number', label: 'Invoice number' },
] as const

export function parseJsonArray<T>(json: string, fallback: T[] = []): T[] {
  try {
    const v = JSON.parse(json || '[]')
    return Array.isArray(v) ? (v as T[]) : fallback
  } catch {
    return fallback
  }
}

export function integrationFromRow(row: {
  id: string
  name: string
  provider: string
  enabled: boolean
  targetKind: string
  targetSlug: string
  eventTypes: string
  fieldMappings: string
  upsertFieldKey: string
  webhookSecret: string
}): WebhookIntegrationConfig {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    enabled: row.enabled,
    targetKind: row.targetKind as 'standard' | 'custom',
    targetSlug: row.targetSlug,
    eventTypes: parseJsonArray<string>(row.eventTypes),
    fieldMappings: parseJsonArray<WebhookFieldMapping>(row.fieldMappings),
    upsertFieldKey: row.upsertFieldKey,
    webhookSecret: row.webhookSecret,
  }
}
