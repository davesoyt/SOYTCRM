import { prisma } from '@/lib/prisma'
import { STANDARD_META, type SchemaField } from '@/lib/objectSchemaShared'

export type {
  SchemaFieldType,
  BuiltInFieldMeta,
  SchemaField,
} from '@/lib/objectSchemaShared'
export { STANDARD_META, STANDARD_OBJECTS } from '@/lib/objectSchemaShared'

function stageOptions(slug: string, key: string) {
  return slug === 'opportunity' && key === 'stage'
    ? ['Prospect', 'Qualified', 'Proposal', 'Closed Won', 'Closed Lost']
    : []
}

type SavedFieldRow = {
  id: string
  key: string
  label: string
  fieldType: string
  selectOptions: string
  required: boolean
  isPrimary: boolean
  order: number
  isBuiltIn: boolean
  hidden: boolean
}

function mergeStandardSchemaFields(
  slug: string,
  savedRows: SavedFieldRow[],
): { fields: SchemaField[]; allFields: SchemaField[] } {
  const meta = STANDARD_META[slug]
  const builtIn: SchemaField[] = meta.builtInFields.map((bf, i) => {
    const savedForKey = savedRows.filter((sf) => sf.key === bf.key && sf.isBuiltIn)
    const active = savedForKey.find((sf) => !sf.hidden)
    const hiddenOnly = !active && savedForKey.some((sf) => sf.hidden)
    const saved = active ?? savedForKey[0]
    return {
      id: saved?.id,
      key: bf.key,
      label: saved?.label ?? bf.label,
      fieldType: saved?.fieldType ?? bf.fieldType,
      selectOptions: saved
        ? JSON.parse(saved.selectOptions || '[]')
        : stageOptions(slug, bf.key),
      required: saved?.required ?? false,
      isPrimary: savedForKey.some((sf) => sf.isPrimary) || (bf.key === 'firstName' || bf.key === 'name'),
      order: saved?.order ?? i,
      isBuiltIn: true,
      hidden: hiddenOnly,
    }
  })

  const customByKey = new Map<string, SchemaField>()
  for (const row of savedRows.filter((f) => !f.isBuiltIn)) {
    const existing = customByKey.get(row.key)
    if (!existing || (existing.hidden && !row.hidden)) {
      customByKey.set(row.key, {
        id: row.id,
        key: row.key,
        label: row.label,
        fieldType: row.fieldType,
        selectOptions: JSON.parse(row.selectOptions || '[]') as string[],
        required: row.required,
        isPrimary: row.isPrimary,
        order: row.order,
        isBuiltIn: false,
        hidden: row.hidden,
      })
    }
  }

  const allFields = [...builtIn, ...customByKey.values()].sort((a, b) => a.order - b.order)
  return { fields: allFields.filter((f) => !f.hidden), allFields }
}

export async function loadSchemaFields(slug: string): Promise<{
  objectType: string | null
  customObjectDefId: string | null
  label: string
  /** Visible fields (not hidden in schema). */
  fields: SchemaField[]
  /** All defined fields, including hidden in schema — for display-field picker. */
  allFields: SchemaField[]
  isStandard: boolean
}> {
  const isStandard = slug in STANDARD_META

  if (isStandard) {
    const meta = STANDARD_META[slug]
    const savedRows = await prisma.fieldDefinition.findMany({
      where: { objectType: slug },
      orderBy: { order: 'asc' },
    })
    const { fields, allFields } = mergeStandardSchemaFields(slug, savedRows)

    return {
      objectType: slug,
      customObjectDefId: null,
      label: meta.label,
      fields,
      allFields,
      isStandard: true,
    }
  }

  const obj = await prisma.customObjectDef.findFirst({
    where: { OR: [{ id: slug }, { slug }] },
    include: { fields: { orderBy: { order: 'asc' } } },
  })
  if (!obj) throw new Error('Object not found')

  const allFields: SchemaField[] = obj.fields.map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    fieldType: f.fieldType,
    selectOptions: JSON.parse(f.selectOptions || '[]') as string[],
    required: f.required,
    isPrimary: f.isPrimary,
    order: f.order,
    isBuiltIn: false,
    hidden: f.hidden,
  }))

  return {
    objectType: null,
    customObjectDefId: obj.id,
    label: obj.pluralName,
    fields: allFields.filter((f) => !f.hidden),
    allFields,
    isStandard: false,
  }
}

function parseJsonRecord(json: string): Record<string, unknown> {
  try {
    const v = JSON.parse(json || '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function renameFieldInRecords(
  objectType: string | null,
  customObjectDefId: string | null,
  oldKey: string,
  newKey: string,
) {
  if (oldKey === newKey) return

  if (objectType === 'contact') {
    const rows = await prisma.contact.findMany({ select: { id: true, customFields: true } })
    const updates = []
    for (const row of rows) {
      const data = parseJsonRecord(row.customFields)
      if (!(oldKey in data)) continue
      data[newKey] = data[oldKey]
      delete data[oldKey]
      updates.push(prisma.contact.update({
        where: { id: row.id },
        data: { customFields: JSON.stringify(data) },
      }))
    }
    if (updates.length) await prisma.$transaction(updates)
    return
  }

  if (objectType === 'company') {
    const rows = await prisma.company.findMany({ select: { id: true, customFields: true } })
    const updates = []
    for (const row of rows) {
      const data = parseJsonRecord(row.customFields)
      if (!(oldKey in data)) continue
      data[newKey] = data[oldKey]
      delete data[oldKey]
      updates.push(prisma.company.update({
        where: { id: row.id },
        data: { customFields: JSON.stringify(data) },
      }))
    }
    if (updates.length) await prisma.$transaction(updates)
    return
  }

  if (customObjectDefId) {
    const rows = await prisma.customObjectRecord.findMany({
      where: { objectDefId: customObjectDefId },
      select: { id: true, data: true },
    })
    const updates = []
    for (const row of rows) {
      const data = parseJsonRecord(row.data)
      if (!(oldKey in data)) continue
      data[newKey] = data[oldKey]
      delete data[oldKey]
      updates.push(prisma.customObjectRecord.update({
        where: { id: row.id },
        data: { data: JSON.stringify(data) },
      }))
    }
    if (updates.length) await prisma.$transaction(updates)
  }
}

export async function purgeFieldFromRecords(
  objectType: string | null,
  customObjectDefId: string | null,
  key: string,
) {
  if (objectType === 'contact') {
    const rows = await prisma.contact.findMany({ select: { id: true, customFields: true } })
    const updates = []
    for (const row of rows) {
      const data = parseJsonRecord(row.customFields)
      if (!(key in data)) continue
      delete data[key]
      updates.push(prisma.contact.update({
        where: { id: row.id },
        data: { customFields: JSON.stringify(data) },
      }))
    }
    if (updates.length) await prisma.$transaction(updates)
    return
  }

  if (objectType === 'company') {
    const rows = await prisma.company.findMany({ select: { id: true, customFields: true } })
    const updates = []
    for (const row of rows) {
      const data = parseJsonRecord(row.customFields)
      if (!(key in data)) continue
      delete data[key]
      updates.push(prisma.company.update({
        where: { id: row.id },
        data: { customFields: JSON.stringify(data) },
      }))
    }
    if (updates.length) await prisma.$transaction(updates)
    return
  }

  if (customObjectDefId) {
    const rows = await prisma.customObjectRecord.findMany({
      where: { objectDefId: customObjectDefId },
      select: { id: true, data: true },
    })
    const updates = []
    for (const row of rows) {
      const data = parseJsonRecord(row.data)
      if (!(key in data)) continue
      delete data[key]
      updates.push(prisma.customObjectRecord.update({
        where: { id: row.id },
        data: { data: JSON.stringify(data) },
      }))
    }
    if (updates.length) await prisma.$transaction(updates)
  }
}
