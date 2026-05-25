import type { WebhookFieldTransform } from '@/lib/webhooks/types'
import { getByPath, stringifyPathValue } from '@/lib/webhooks/pathExtract'

function formatAmountMajor(cents: unknown): string {
  const n = typeof cents === 'number' ? cents : parseFloat(String(cents ?? ''))
  if (Number.isNaN(n)) return ''
  return (n / 100).toFixed(2)
}

function formatAmountDisplay(cents: unknown, currency: unknown): string {
  const major = formatAmountMajor(cents)
  if (!major) return ''
  const cur = stringifyPathValue(currency).toUpperCase() || 'USD'
  return `${major} ${cur}`
}

function formatUnixDate(unix: unknown): string {
  const n = typeof unix === 'number' ? unix : parseFloat(String(unix ?? ''))
  if (Number.isNaN(n)) return ''
  return new Date(n * 1000).toISOString().slice(0, 10)
}

export function applyTransform(
  transform: WebhookFieldTransform | undefined,
  raw: unknown,
  eventPayload: unknown,
): string {
  if (transform === 'amount_major') return formatAmountMajor(raw)
  if (transform === 'amount_display') {
    const currency = getByPath(eventPayload, 'data.object.currency')
    return formatAmountDisplay(raw, currency)
  }
  if (transform === 'unix_date') return formatUnixDate(raw)
  return stringifyPathValue(raw)
}
