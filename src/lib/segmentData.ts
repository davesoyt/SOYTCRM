import { prisma } from '@/lib/prisma'
import {
  flattenContact,
  flattenCompany,
  flattenOpportunity,
  applyFiltersForObjectTypes,
  memberKey,
  CONTACT_FIELDS,
  COMPANY_FIELDS,
  OPPORTUNITY_FIELDS,
  TEXT_OPS,
  NUM_OPS,
  SELECT_OPS,
  GEO_OPS,
  type StandardObjectType,
  type FlatRecord,
  type FieldMeta,
  type SegmentFilter,
} from '@/lib/filters'
import { getCustomDefId, isStandardObjectType, parseSegmentObjectTypes } from '@/lib/segmentObjects'

export type SegmentForResolution = {
  objectType: string
  objectTypesJson?: string | null
  filtersJson: string
  listType: string
  memberIds: string
}

function flattenCustomRecord(
  record: { id: string; data: string; createdAt: Date },
  def: { id: string; pluralName: string; fields: { key: string; label: string; fieldType: string; isPrimary: boolean }[] },
): FlatRecord {
  let data: Record<string, string> = {}
  try { data = JSON.parse(record.data) } catch { /* */ }
  const primary = def.fields.find(f => f.isPrimary) ?? def.fields.find(f => f.fieldType === 'text') ?? def.fields[0]
  const displayName = primary ? (data[primary.key] || '—') : record.id.slice(0, 8)
  const subtext = def.fields
    .filter(f => f !== primary)
    .slice(0, 2)
    .map(f => data[f.key])
    .filter(Boolean)
    .join(' · ')

  const flat: FlatRecord = {
    _id: record.id,
    _href: `/objects/${def.id}/${record.id}`,
    _displayName: displayName,
    _subtext: subtext || def.pluralName,
    _initials: displayName.charAt(0).toUpperCase() || '?',
    createdAt: record.createdAt.toISOString(),
  }
  for (const [k, v] of Object.entries(data)) {
    flat[k] = v
    flat[`custom_${k}`] = v
  }
  return flat
}

export async function loadRecordsForType(type: string): Promise<FlatRecord[]> {
  if (isStandardObjectType(type)) {
    return loadStandardRecords(type)
  }
  const defId = getCustomDefId(type)
  if (!defId) return []

  const def = await prisma.customObjectDef.findUnique({
    where: { id: defId },
    include: {
      fields: { orderBy: { order: 'asc' }, select: { key: true, label: true, fieldType: true, isPrimary: true } },
      records: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!def) return []
  return def.records.map(r => flattenCustomRecord(r, def))
}

async function loadStandardRecords(type: StandardObjectType): Promise<FlatRecord[]> {
  if (type === 'contact') {
    const contacts = await prisma.contact.findMany({
      include: {
        company: { select: { id: true, name: true, domain: true, industry: true, size: true } },
        opportunities: { select: { stage: true, value: true } },
        activities: { select: { type: true } },
        enrollments: { select: { sequenceId: true } },
      },
      orderBy: { leadScore: 'desc' },
    })
    return contacts.map(flattenContact)
  }
  if (type === 'company') {
    const companies = await prisma.company.findMany({
      include: {
        contacts: { select: { id: true, lat: true, lng: true } },
        opportunities: { select: { stage: true, value: true } },
        activities: { select: { type: true } },
      },
      orderBy: { name: 'asc' },
    })
    return companies.map(flattenCompany)
  }
  const opportunities = await prisma.opportunity.findMany({
    include: {
      contact: { select: { firstName: true, lastName: true, email: true, title: true, leadScore: true, lat: true, lng: true } },
      company: { select: { name: true, industry: true } },
      activities: { select: { type: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return opportunities.map(flattenOpportunity)
}

export async function loadFieldsForType(
  type: string,
  records: FlatRecord[],
): Promise<{ baseFields: FieldMeta[]; extraFields: FieldMeta[] }> {
  const defId = getCustomDefId(type)
  if (defId) {
    return loadCustomFields(defId, records)
  }
  if (!isStandardObjectType(type)) {
    return { baseFields: [], extraFields: [] }
  }
  return loadStandardFields(type, records)
}

async function loadCustomFields(
  defId: string,
  records: FlatRecord[],
): Promise<{ baseFields: FieldMeta[]; extraFields: FieldMeta[] }> {
  const fieldDefs = await prisma.fieldDefinition.findMany({
    where: { customObjectDefId: defId, hidden: false },
    orderBy: { order: 'asc' },
    select: { key: true, label: true, fieldType: true, selectOptions: true },
  })

  function opsForType(fieldType: string) {
    if (fieldType === 'number') return NUM_OPS
    if (fieldType === 'select' || fieldType === 'boolean') return SELECT_OPS
    return TEXT_OPS
  }
  function valueTypeForType(fieldType: string): FieldMeta['valueType'] {
    if (fieldType === 'number') return 'number'
    if (fieldType === 'select') return 'select'
    if (fieldType === 'boolean') return 'boolean'
    return 'text'
  }

  const baseFields: FieldMeta[] = fieldDefs.map(f => {
    const selectOptions = f.selectOptions ? JSON.parse(f.selectOptions) : []
    return {
      key: f.key,
      label: f.label,
      group: 'Fields',
      valueType: valueTypeForType(f.fieldType),
      operators: opsForType(f.fieldType),
      ...(selectOptions.length > 0 ? { options: selectOptions } : {}),
    }
  })

  const extraFields: FieldMeta[] = [
    {
      key: 'createdAt',
      label: 'Created',
      group: 'Record',
      valueType: 'text',
      operators: TEXT_OPS,
    },
  ]

  const hasGeoColumns = records.some((record) => {
    const lat = record.lat
    const lng = record.lng
    return typeof lat === 'number' && !Number.isNaN(lat) && typeof lng === 'number' && !Number.isNaN(lng)
  })
  if (hasGeoColumns) {
    extraFields.unshift({
      key: 'geo',
      label: 'Distance from…',
      group: 'Location',
      valueType: 'geo',
      operators: GEO_OPS,
    })
  }

  return { baseFields, extraFields }
}

async function loadStandardFields(
  type: StandardObjectType,
  records: FlatRecord[],
): Promise<{ baseFields: FieldMeta[]; extraFields: FieldMeta[] }> {
  const fieldDefs = await prisma.fieldDefinition.findMany({
    where: { objectType: type },
    orderBy: { order: 'asc' },
    select: { key: true, label: true, fieldType: true, selectOptions: true, isBuiltIn: true, hidden: true },
  })
  const fieldDefMap = new Map(fieldDefs.map(f => [f.key, f]))

  const hasGeoColumns = records.some((record) => {
    const lat = record.lat
    const lng = record.lng
    return typeof lat === 'number' && !Number.isNaN(lat) && typeof lng === 'number' && !Number.isNaN(lng)
  })

  const hardcodedBase =
    type === 'contact' ? CONTACT_FIELDS
    : type === 'company' ? COMPANY_FIELDS
    : OPPORTUNITY_FIELDS

  const baseFields: FieldMeta[] = hardcodedBase.flatMap(hf => {
    if (hf.key === 'geo' && !hasGeoColumns) return []
    const saved = fieldDefMap.get(hf.key)
    if (saved?.hidden) return []
    if (!saved) return [hf]
    return [{
      ...hf,
      label: saved.label,
      ...(saved.fieldType === 'number' && hf.valueType !== 'number'
        ? { valueType: 'number' as const, operators: NUM_OPS }
        : saved.fieldType === 'select' && hf.valueType !== 'select'
        ? { valueType: 'select' as const, operators: SELECT_OPS }
        : {}),
    }]
  })

  function opsForType(fieldType: string) {
    if (fieldType === 'number') return NUM_OPS
    if (fieldType === 'select' || fieldType === 'boolean') return SELECT_OPS
    return TEXT_OPS
  }
  function valueTypeForType(fieldType: string): FieldMeta['valueType'] {
    if (fieldType === 'number') return 'number'
    if (fieldType === 'select') return 'select'
    if (fieldType === 'boolean') return 'boolean'
    return 'text'
  }

  const extraFields: FieldMeta[] = fieldDefs
    .filter((f) => !f.isBuiltIn && !f.hidden)
    .map((def) => {
      const key = `custom_${def.key}`
      const fieldType = def.fieldType ?? 'text'
      const selectOptions = def.selectOptions ? JSON.parse(def.selectOptions) : []
    return {
      key,
      label: def.label,
      group: 'Custom Fields',
      valueType: valueTypeForType(fieldType),
      operators: opsForType(fieldType),
      ...(selectOptions.length > 0 ? { options: selectOptions } : {}),
    }
  })

  return { baseFields, extraFields }
}

/** Resolve segment member count without building full record objects where possible. */
export async function resolveSegmentCount(segment: SegmentForResolution): Promise<number> {
  const objectTypes = parseSegmentObjectTypes(segment)

  if (segment.listType === 'static') {
    try {
      const ids = JSON.parse(segment.memberIds) as string[]
      return ids.length
    } catch {
      return 0
    }
  }

  let filters: SegmentFilter[] = []
  try { filters = JSON.parse(segment.filtersJson) } catch { /* */ }

  if (filters.length === 0) {
    const counts = await Promise.all(
      objectTypes.map(async (type) => {
        if (type === 'contact') return prisma.contact.count()
        if (type === 'company') return prisma.company.count()
        if (type === 'opportunity') return prisma.opportunity.count()
        const defId = getCustomDefId(type)
        if (!defId) return 0
        return prisma.customObjectRecord.count({ where: { objectDefId: defId } })
      }),
    )
    return counts.reduce((a, b) => a + b, 0)
  }

  const members = await resolveSegmentMembers(segment)
  return members.length
}

/** Resolve segment members using the same rules as the segment builder UI. */
export async function resolveSegmentMembers(segment: SegmentForResolution): Promise<FlatRecord[]> {
  const objectTypes = parseSegmentObjectTypes(segment)
  const multiObject = objectTypes.length > 1

  const recordsByType: Partial<Record<string, FlatRecord[]>> = {}
  await Promise.all(
    objectTypes.map(async (type) => {
      recordsByType[type] = await loadRecordsForType(type)
    }),
  )

  if (segment.listType === 'static') {
    let memberIdSet: Set<string>
    try {
      memberIdSet = new Set(JSON.parse(segment.memberIds) as string[])
    } catch {
      memberIdSet = new Set()
    }
    return objectTypes.flatMap((type) => {
      const records = recordsByType[type] ?? []
      return records
        .filter((r) => {
          const key = memberKey(type, r._id, multiObject)
          return memberIdSet.has(key) || memberIdSet.has(r._id)
        })
        .map((r) => ({ ...r, _objectType: type }))
    })
  }

  let filters: SegmentFilter[] = []
  try {
    filters = JSON.parse(segment.filtersJson)
  } catch {
    filters = []
  }
  return applyFiltersForObjectTypes(recordsByType, filters, objectTypes)
}

export type WorkflowRecordLink = {
  contactId?: string | null
  companyId?: string | null
  opportunityId?: string | null
}

export function memberObjectType(member: FlatRecord, defaultType: string): string {
  return (member._objectType as string) ?? defaultType
}

/** Prisma task/enrollment link fields for a segment member record. */
export function workflowLinkForMember(objectType: string, recordId: string): WorkflowRecordLink {
  if (objectType === 'contact') return { contactId: recordId }
  if (objectType === 'company') return { companyId: recordId }
  if (objectType === 'opportunity') return { opportunityId: recordId }
  return {}
}

/** Map segment members to contact IDs for workflow enrollment. */
export async function resolveSegmentContactIds(segment: SegmentForResolution): Promise<string[]> {
  const members = await resolveSegmentMembers(segment)
  const objectTypes = parseSegmentObjectTypes(segment)
  const defaultType = objectTypes[0]
  const contactIds = new Set<string>()
  const companyIds = new Set<string>()
  const opportunityIds = new Set<string>()

  for (const m of members) {
    const type = (m._objectType as string) ?? defaultType
    if (type === 'contact') contactIds.add(m._id)
    else if (type === 'company') companyIds.add(m._id)
    else if (type === 'opportunity') opportunityIds.add(m._id)
  }

  if (companyIds.size > 0) {
    const contacts = await prisma.contact.findMany({
      where: { companyId: { in: [...companyIds] } },
      select: { id: true },
    })
    contacts.forEach((c) => contactIds.add(c.id))
  }

  if (opportunityIds.size > 0) {
    const opportunities = await prisma.opportunity.findMany({
      where: { id: { in: [...opportunityIds] } },
      select: { contactId: true, companyId: true },
    })
    const opportunityCompanyIds = new Set<string>()
    for (const d of opportunities) {
      if (d.contactId) contactIds.add(d.contactId)
      if (d.companyId) opportunityCompanyIds.add(d.companyId)
    }
    if (opportunityCompanyIds.size > 0) {
      const contacts = await prisma.contact.findMany({
        where: { companyId: { in: [...opportunityCompanyIds] } },
        select: { id: true },
      })
      contacts.forEach((c) => contactIds.add(c.id))
    }
  }

  return [...contactIds]
}

/** Contacts in the segment result set, with relations needed for workflow actions. */
export async function loadContactsForWorkflow(segment: SegmentForResolution) {
  const ids = await resolveSegmentContactIds(segment)
  if (ids.length === 0) return []
  return prisma.contact.findMany({
    where: { id: { in: ids } },
    include: {
      company: { select: { id: true, name: true, domain: true, industry: true, size: true } },
      opportunities: { select: { stage: true, value: true } },
      activities: { select: { type: true } },
      enrollments: { select: { sequenceId: true } },
    },
  })
}
