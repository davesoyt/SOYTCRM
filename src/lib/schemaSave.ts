import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { STANDARD_META, type SchemaField } from '@/lib/objectSchemaShared'
import { purgeFieldFromRecords, renameFieldInRecords } from '@/lib/objectSchema'

type FieldDefInput = {
  id?: string
  key: string
  label: string
  fieldType: string
  selectOptions: string[]
  required: boolean
  isPrimary: boolean
  order: number
  isBuiltIn: boolean
}

export async function saveSchemaFields(
  objectType: string | null,
  customObjectDefId: string | null,
  fields: FieldDefInput[],
) {
  const scopeWhere = objectType
    ? { objectType }
    : { customObjectDefId: customObjectDefId! }

  const previous = await prisma.fieldDefinition.findMany({ where: scopeWhere })
  const nextIds = new Set(fields.filter((f) => f.id).map((f) => f.id as string))
  const nextKeys = new Set(fields.map((f) => f.key))

  for (const prev of previous) {
    if (prev.isBuiltIn) continue
    const stillPresent = (prev.id && nextIds.has(prev.id)) || nextKeys.has(prev.key)
    if (!stillPresent) {
      await purgeFieldFromRecords(objectType, customObjectDefId, prev.key)
    }
  }

  for (const f of fields) {
    if (!f.id || f.isBuiltIn) continue
    const prev = previous.find((p) => p.id === f.id)
    if (prev && prev.key !== f.key) {
      await renameFieldInRecords(objectType, customObjectDefId, prev.key, f.key)
    }
  }

  if (objectType && objectType in STANDARD_META) {
    const meta = STANDARD_META[objectType]
    const visibleBuiltInKeys = new Set(fields.filter((f) => f.isBuiltIn).map((f) => f.key))
    for (const bf of meta.builtInFields) {
      if (visibleBuiltInKeys.has(bf.key)) continue
      const existing = previous.find((p) => p.key === bf.key && p.isBuiltIn)
      const payload = {
        objectType,
        key: bf.key,
        label: bf.label,
        fieldType: bf.fieldType,
        selectOptions: JSON.stringify(
          bf.key === 'stage' ? ['Prospect', 'Qualified', 'Proposal', 'Closed Won', 'Closed Lost'] : [],
        ),
        required: false,
        isPrimary: false,
        order: meta.builtInFields.findIndex((b) => b.key === bf.key),
        isBuiltIn: true,
        hidden: true,
      }
      if (existing) {
        await prisma.fieldDefinition.update({ where: { id: existing.id }, data: payload })
      } else {
        await prisma.fieldDefinition.create({ data: payload })
      }
    }
  }

  const existingIds = fields.filter((f) => f.id).map((f) => f.id as string)
  await prisma.fieldDefinition.deleteMany({
    where: {
      ...scopeWhere,
      id: { notIn: existingIds },
      isBuiltIn: false,
    },
  })

  for (const f of fields) {
    const payload = {
      objectType: objectType ?? undefined,
      customObjectDefId: customObjectDefId ?? undefined,
      key: f.key.trim(),
      label: f.label.trim(),
      fieldType: f.fieldType,
      selectOptions: JSON.stringify(f.selectOptions),
      required: f.required,
      isPrimary: f.isPrimary,
      order: f.order,
      isBuiltIn: f.isBuiltIn,
      hidden: false,
    }
    if (!payload.key || !payload.label) continue

    if (f.id) {
      await prisma.fieldDefinition.update({ where: { id: f.id }, data: payload })
    } else {
      await prisma.fieldDefinition.create({ data: payload })
    }
  }

  const slug = objectType ?? customObjectDefId!
  revalidatePath(`/setup/objects/${slug}`)
  revalidatePath(`/setup/schema/${slug}`)
  revalidatePath('/setup/schema')
  revalidatePath('/setup/objects')
  revalidatePath('/setup')
  if (objectType === 'contact') revalidatePath('/contacts')
  if (objectType === 'company') revalidatePath('/companies')
  if (objectType === 'opportunity') revalidatePath('/opportunities')
  if (customObjectDefId) revalidatePath(`/objects/${customObjectDefId}`)
}

export type { SchemaField }
