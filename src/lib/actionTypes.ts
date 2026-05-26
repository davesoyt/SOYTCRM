import type { WebhookFieldMapping } from '@/lib/webhooks/types'

export type ImportTask = { targetId: 'contact' | 'company'; mappedData: Record<string, string>[] }

export type ImportConflict = {
  targetId: string
  existingId: string
  identifier: string
  type: string
  diffs: Record<string, { current: string; import: string }>
}

export type SaveWebhookIntegrationInput = {
  name: string
  enabled: boolean
  targetKind: 'standard' | 'custom'
  targetSlug: string
  eventTypes: string[]
  fieldMappings: WebhookFieldMapping[]
  upsertFieldKey: string
  webhookSecret: string
}

export type AddWebhookTargetFieldInput = {
  key: string
  label: string
  fieldType?: string
}
