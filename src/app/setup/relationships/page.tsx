import { prisma } from '@/lib/prisma'
import RelationshipCanvas from './RelationshipCanvas'

export const dynamic = 'force-dynamic'

const STANDARD_BUILT_INS: Record<string, { label: string; fields: { key: string; label: string; fieldType: string }[] }> = {
  contact: {
    label: 'Contact',
    fields: [
      { key: 'firstName', label: 'First Name', fieldType: 'text' },
      { key: 'lastName',  label: 'Last Name',  fieldType: 'text' },
      { key: 'email',     label: 'Email',       fieldType: 'email' },
      { key: 'phone',     label: 'Phone',       fieldType: 'phone' },
      { key: 'title',     label: 'Job Title',   fieldType: 'text' },
      { key: 'leadScore', label: 'Lead Score',  fieldType: 'number' },
    ],
  },
  company: {
    label: 'Company',
    fields: [
      { key: 'name',     label: 'Company Name',  fieldType: 'text' },
      { key: 'domain',   label: 'Domain',        fieldType: 'text' },
      { key: 'industry', label: 'Industry',      fieldType: 'text' },
      { key: 'size',     label: 'Employee Size', fieldType: 'text' },
    ],
  },
  deal: {
    label: 'Deal',
    fields: [
      { key: 'name',  label: 'Deal Name', fieldType: 'text' },
      { key: 'value', label: 'Value ($)', fieldType: 'number' },
      { key: 'stage', label: 'Stage',     fieldType: 'select' },
    ],
  },
}

// Scan actual records for custom field keys not yet in FieldDefinition
async function scanRecordCustomKeys(slug: string): Promise<string[]> {
  const keys = new Set<string>()
  const parse = (json: string) => {
    try { Object.keys(JSON.parse(json || '{}')).forEach(k => keys.add(k)) } catch { /* */ }
  }
  if (slug === 'contact') {
    const rows = await prisma.contact.findMany({ select: { customFields: true } })
    rows.forEach(r => parse(r.customFields))
  } else if (slug === 'company') {
    const rows = await prisma.company.findMany({ select: { customFields: true } })
    rows.forEach(r => parse(r.customFields))
  }
  return [...keys]
}

export default async function RelationshipsPage() {
  const [fieldDefs, customObjectDefs, relationships] = await Promise.all([
    prisma.fieldDefinition.findMany({ orderBy: { order: 'asc' } }),
    prisma.customObjectDef.findMany({ include: { fields: { orderBy: { order: 'asc' } } } }),
    prisma.objectRelationship.findMany({ orderBy: { createdAt: 'asc' } }),
  ])

  const objects: { id: string; label: string; fields: { key: string; label: string; fieldType: string }[] }[] = []

  for (const [slug, meta] of Object.entries(STANDARD_BUILT_INS)) {
    const savedForObject = fieldDefs.filter(f => f.objectType === slug)
    const savedMap = new Map(savedForObject.map(f => [f.key, f]))

    // Built-in fields with saved label/type overrides applied
    const builtInFields = meta.fields.map(bf => {
      const saved = savedMap.get(bf.key)
      return {
        key: bf.key,
        label: saved?.label ?? bf.label,
        fieldType: saved?.fieldType ?? bf.fieldType,
      }
    })

    // Custom fields registered in FieldDefinition
    const definedCustomFields = savedForObject
      .filter(f => !f.isBuiltIn)
      .map(f => ({ key: f.key, label: f.label, fieldType: f.fieldType }))

    // Custom fields found in actual records but not yet in FieldDefinition
    const recordKeys = await scanRecordCustomKeys(slug)
    const definedKeys = new Set([
      ...meta.fields.map(f => f.key),
      ...definedCustomFields.map(f => f.key),
    ])
    const orphanFields = recordKeys
      .filter(k => !definedKeys.has(k))
      .map(k => ({
        key: k,
        label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        fieldType: 'text',
      }))

    objects.push({
      id: slug,
      label: meta.label,
      fields: [...builtInFields, ...definedCustomFields, ...orphanFields],
    })
  }

  for (const obj of customObjectDefs) {
    objects.push({
      id: obj.id,
      label: obj.name,
      fields: obj.fields.map(f => ({ key: f.key, label: f.label, fieldType: f.fieldType })),
    })
  }

  return (
    <RelationshipCanvas
      objects={objects}
      initialRelationships={relationships.map(r => ({
        id: r.id, fromObject: r.fromObject, fromField: r.fromField,
        toObject: r.toObject, toField: r.toField, relType: r.relType, label: r.label,
      }))}
    />
  )
}
