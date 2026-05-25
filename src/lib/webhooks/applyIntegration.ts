import { prisma } from '@/lib/prisma'
import { loadSchemaFields } from '@/lib/objectSchema'
import type { WebhookApplyResult, WebhookIntegrationConfig, WebhookFieldMapping } from '@/lib/webhooks/types'
import { getByPath } from '@/lib/webhooks/pathExtract'
import { applyTransform } from '@/lib/webhooks/transforms'

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

export function mapPayloadToFields(
  eventPayload: unknown,
  mappings: WebhookFieldMapping[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of mappings) {
    if (m.staticValue != null && m.staticValue !== '') {
      out[m.targetField] = m.staticValue
      continue
    }
    const raw = getByPath(eventPayload, m.sourcePath)
    out[m.targetField] = applyTransform(m.transform ?? 'text', raw, eventPayload)
  }
  return out
}

async function findCustomRecord(objectDefId: string, fieldKey: string, value: string) {
  if (!value.trim()) return null
  const rows = await prisma.$queryRaw<{ id: string; data: string }[]>`
    SELECT id, data FROM "CustomObjectRecord"
    WHERE "objectDefId" = ${objectDefId}
    AND data::jsonb->>  ${fieldKey} = ${value}
    LIMIT 1
  `
  return rows[0] ?? null
}

async function upsertCustomRecord(
  objectDefId: string,
  upsertFieldKey: string,
  fields: Record<string, string>,
): Promise<WebhookApplyResult> {
  const upsertValue = fields[upsertFieldKey]?.trim()
  if (!upsertFieldKey || !upsertValue) {
    return { action: 'skipped', reason: `missing upsert field "${upsertFieldKey}"` }
  }

  const existing = await findCustomRecord(objectDefId, upsertFieldKey, upsertValue)
  if (existing) {
    const prev = parseRecordData(existing.data)
    const merged = { ...prev, ...fields }
    await prisma.customObjectRecord.update({
      where: { id: existing.id },
      data: { data: JSON.stringify(merged) },
    })
    return { action: 'updated', recordId: existing.id }
  }

  const created = await prisma.customObjectRecord.create({
    data: { objectDefId, data: JSON.stringify(fields) },
  })
  return { action: 'created', recordId: created.id }
}

type StandardType = 'contact' | 'company' | 'opportunity'

async function findStandardRecord(
  objectType: StandardType,
  upsertFieldKey: string,
  value: string,
) {
  if (!value.trim()) return null
  if (objectType === 'contact') {
    if (upsertFieldKey === 'id') return prisma.contact.findUnique({ where: { id: value } })
    if (upsertFieldKey === 'email') return prisma.contact.findUnique({ where: { email: value } })
    if (upsertFieldKey === 'phone') return prisma.contact.findFirst({ where: { phone: value } })
    const rows = await prisma.$queryRaw<{ id: string; customFields: string }[]>`
      SELECT id, "customFields" FROM "Contact"
      WHERE "customFields"::jsonb->> ${upsertFieldKey} = ${value}
      LIMIT 1
    `
    return rows[0] ? prisma.contact.findUnique({ where: { id: rows[0].id } }) : null
  }
  if (objectType === 'company') {
    if (upsertFieldKey === 'id') return prisma.company.findUnique({ where: { id: value } })
    if (upsertFieldKey === 'domain') return prisma.company.findFirst({ where: { domain: value } })
    if (upsertFieldKey === 'name') return prisma.company.findFirst({ where: { name: value } })
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Company"
      WHERE "customFields"::jsonb->> ${upsertFieldKey} = ${value}
      LIMIT 1
    `
    return rows[0] ? prisma.company.findUnique({ where: { id: rows[0].id } }) : null
  }
  if (objectType === 'opportunity') {
    if (upsertFieldKey === 'id') return prisma.opportunity.findUnique({ where: { id: value } })
    if (upsertFieldKey === 'name') return prisma.opportunity.findFirst({ where: { name: value } })
  }
  return null
}

const CONTACT_BUILTIN = new Set(['firstName', 'lastName', 'email', 'phone', 'title', 'linkedin', 'leadScore', 'street', 'city', 'state', 'zip', 'country'])
const COMPANY_BUILTIN = new Set(['name', 'domain', 'industry', 'size', 'website'])
const OPPORTUNITY_BUILTIN = new Set(['name', 'value', 'stage'])

async function upsertStandardRecord(
  objectType: StandardType,
  upsertFieldKey: string,
  fields: Record<string, string>,
): Promise<WebhookApplyResult> {
  const upsertValue = fields[upsertFieldKey]?.trim()
  if (!upsertFieldKey || !upsertValue) {
    return { action: 'skipped', reason: `missing upsert field "${upsertFieldKey}"` }
  }

  const existing = await findStandardRecord(objectType, upsertFieldKey, upsertValue)
  const builtInSet =
    objectType === 'contact' ? CONTACT_BUILTIN
      : objectType === 'company' ? COMPANY_BUILTIN
        : OPPORTUNITY_BUILTIN

  const updateData: Record<string, unknown> = {}
  let customPatch: Record<string, string> = {}

  for (const [key, val] of Object.entries(fields)) {
    if (builtInSet.has(key)) {
      if (objectType === 'opportunity' && key === 'value') {
        const num = parseFloat(val)
        if (!Number.isNaN(num)) updateData.value = num
      } else if (objectType === 'contact' && key === 'leadScore') {
        const num = parseInt(val, 10)
        if (!Number.isNaN(num)) updateData.leadScore = num
      } else {
        updateData[key] = val || null
      }
    } else {
      customPatch[key] = val
    }
  }

  if (existing) {
    if (Object.keys(customPatch).length > 0) {
      const prev = parseRecordData((existing as { customFields?: string }).customFields ?? '{}')
      updateData.customFields = JSON.stringify({ ...prev, ...customPatch })
    }
    if (Object.keys(updateData).length === 0) {
      return { action: 'skipped', reason: 'no fields to update' }
    }
    if (objectType === 'contact') {
      await prisma.contact.update({ where: { id: existing.id }, data: updateData })
    } else if (objectType === 'company') {
      await prisma.company.update({ where: { id: existing.id }, data: updateData })
    } else {
      await prisma.opportunity.update({ where: { id: existing.id }, data: updateData })
    }
    return { action: 'updated', recordId: existing.id }
  }

  // Create new record
  if (objectType === 'contact') {
    const email =
      fields.email?.trim() ||
      (upsertFieldKey === 'email' ? upsertValue : `stripe+${upsertValue.replace(/[^a-zA-Z0-9._-]/g, '_')}@import.local`)
    const firstName = fields.firstName?.trim() || fields.business_name?.trim() || 'Stripe'
    const lastName = fields.lastName?.trim() || 'Import'
    const created = await prisma.contact.create({
      data: {
        firstName,
        lastName,
        email,
        phone: fields.phone || null,
        title: fields.title || null,
        customFields: JSON.stringify(customPatch),
        ...Object.fromEntries(
          Object.entries(updateData).filter(([k]) => CONTACT_BUILTIN.has(k) && k !== 'email' && k !== 'firstName' && k !== 'lastName'),
        ),
      },
    })
    return { action: 'created', recordId: created.id }
  }

  if (objectType === 'company') {
    const name = fields.name?.trim() || fields.business_name?.trim() || upsertValue
    const created = await prisma.company.create({
      data: {
        name,
        domain: fields.domain || null,
        industry: fields.industry || null,
        size: fields.size || null,
        website: fields.website || null,
        customFields: JSON.stringify(customPatch),
      },
    })
    return { action: 'created', recordId: created.id }
  }

  const name = fields.name?.trim() || upsertValue
  const value = parseFloat(fields.value ?? '0')
  const created = await prisma.opportunity.create({
    data: {
      name,
      value: Number.isNaN(value) ? 0 : value,
      stage: fields.stage || 'Prospect',
    },
  })
  return { action: 'created', recordId: created.id }
}

export async function applyWebhookIntegration(
  integration: WebhookIntegrationConfig,
  eventPayload: unknown,
  eventType: string,
): Promise<WebhookApplyResult> {
  if (!integration.enabled) {
    return { action: 'skipped', reason: 'integration disabled' }
  }
  if (integration.eventTypes.length > 0 && !integration.eventTypes.includes(eventType)) {
    return { action: 'skipped', reason: `event type not configured: ${eventType}` }
  }
  if (integration.fieldMappings.length === 0) {
    return { action: 'skipped', reason: 'no field mappings configured' }
  }

  const fields = mapPayloadToFields(eventPayload, integration.fieldMappings)

  if (integration.targetKind === 'custom') {
    const def = await prisma.customObjectDef.findFirst({
      where: { OR: [{ slug: integration.targetSlug }, { id: integration.targetSlug }] },
    })
    if (!def) {
      return { action: 'skipped', reason: `custom object not found: ${integration.targetSlug}` }
    }
    return upsertCustomRecord(def.id, integration.upsertFieldKey, fields)
  }

  const objectType = integration.targetSlug as StandardType
  if (!['contact', 'company', 'opportunity'].includes(objectType)) {
    return { action: 'skipped', reason: `unknown standard object: ${integration.targetSlug}` }
  }
  return upsertStandardRecord(objectType, integration.upsertFieldKey, fields)
}

export async function getTargetFieldOptions(
  targetKind: 'standard' | 'custom',
  targetSlug: string,
): Promise<{ key: string; label: string }[]> {
  if (targetKind === 'custom') {
    const def = await prisma.customObjectDef.findFirst({
      where: { OR: [{ slug: targetSlug }, { id: targetSlug }] },
      include: { fields: { where: { hidden: false }, orderBy: { order: 'asc' } } },
    })
    return (def?.fields ?? []).map((f) => ({ key: f.key, label: f.label }))
  }
  const schema = await loadSchemaFields(targetSlug)
  return schema.fields.map((f) => ({ key: f.key, label: f.label }))
}

export async function listWebhookTargetOptions(): Promise<
  { kind: 'standard' | 'custom'; slug: string; label: string }[]
> {
  const custom = await prisma.customObjectDef.findMany({ orderBy: { name: 'asc' } })
  return [
    { kind: 'standard', slug: 'contact', label: 'Contacts' },
    { kind: 'standard', slug: 'company', label: 'Companies' },
    { kind: 'standard', slug: 'opportunity', label: 'Opportunities' },
    ...custom.map((o) => ({ kind: 'custom' as const, slug: o.slug, label: o.pluralName })),
  ]
}
