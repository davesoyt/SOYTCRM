export function stripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return key
}

export function stripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  return secret
}

/** Custom object slug for Venue Billing (default: vb). */
export function vbObjectSlug(): string {
  return process.env.STRIPE_VB_OBJECT_SLUG?.trim() || 'vb'
}

export function stripeSyncSecret(): string | undefined {
  return process.env.STRIPE_SYNC_SECRET?.trim() || undefined
}
