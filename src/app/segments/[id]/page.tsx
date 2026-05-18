import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SegmentBuilder from './SegmentBuilder'
import {
  flattenContact, flattenCompany, flattenDeal,
  CONTACT_FIELDS, COMPANY_FIELDS, DEAL_FIELDS,
  TEXT_OPS, NUM_OPS, SELECT_OPS, BOOL_OPS,
  type ObjectType, type FlatRecord, type FieldMeta,
} from '@/lib/filters'

export const dynamic = 'force-dynamic'

export default async function SegmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [segment, users, workflowLinks, allSequences] = await Promise.all([
    prisma.segment.findUnique({
      where: { id },
      include: { assignments: { include: { user: true } } },
    }),
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
    prisma.segmentWorkflowLink.findMany({
      where: { segmentId: id },
      include: { sequence: { select: { id: true, name: true } } },
    }),
    prisma.sequence.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  if (!segment) notFound()

  const objectType = (segment.objectType || 'contact') as ObjectType

  let records: FlatRecord[] = []
  let sequences: { id: string; name: string }[] = []

  if (objectType === 'contact') {
    const [contacts, seqs] = await Promise.all([
      prisma.contact.findMany({
        include: {
          company: { select: { id: true, name: true, domain: true, industry: true, size: true } },
          deals: { select: { stage: true, value: true } },
          activities: { select: { type: true } },
          enrollments: { select: { sequenceId: true } },
        },
        orderBy: { leadScore: 'desc' },
      }),
      prisma.sequence.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ])
    records = contacts.map(flattenContact)
    sequences = seqs
  } else if (objectType === 'company') {
    const companies = await prisma.company.findMany({
      include: {
        contacts: { select: { id: true } },
        deals: { select: { stage: true, value: true } },
        activities: { select: { type: true } },
      },
      orderBy: { name: 'asc' },
    })
    records = companies.map(flattenCompany)
  } else if (objectType === 'deal') {
    const deals = await prisma.deal.findMany({
      include: {
        contact: { select: { firstName: true, lastName: true, email: true, title: true, leadScore: true } },
        company: { select: { name: true, industry: true } },
        activities: { select: { type: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    records = deals.map(flattenDeal)
  }

  // Fetch ALL field definitions for this object type (built-in overrides + custom)
  const fieldDefs = await prisma.fieldDefinition.findMany({
    where: { objectType },
    orderBy: { order: 'asc' },
    select: { key: true, label: true, fieldType: true, selectOptions: true, isBuiltIn: true },
  })
  const fieldDefMap = new Map(fieldDefs.map(f => [f.key, f]))

  // ── Base fields: hardcoded list with saved label/type overrides applied ───────
  const hardcodedBase = objectType === 'contact' ? CONTACT_FIELDS
    : objectType === 'company' ? COMPANY_FIELDS
    : DEAL_FIELDS

  const baseFields: FieldMeta[] = hardcodedBase.map(hf => {
    const saved = fieldDefMap.get(hf.key)
    if (!saved) return hf
    return {
      ...hf,
      label: saved.label,  // use saved label
      // fieldType changes may affect operators — remap if needed
      ...(saved.fieldType === 'number' && hf.valueType !== 'number'
        ? { valueType: 'number' as const, operators: NUM_OPS }
        : saved.fieldType === 'select' && hf.valueType !== 'select'
        ? { valueType: 'select' as const, operators: SELECT_OPS }
        : {}),
    }
  })

  // ── Custom fields: from records + DB definitions ───────────────────────────
  const customKeySet = new Set<string>()
  for (const r of records) {
    for (const k of Object.keys(r)) {
      if (k.startsWith('custom_')) customKeySet.add(k)
    }
  }

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

  const extraFields: FieldMeta[] = [...customKeySet].sort().map(key => {
    const rawKey = key.slice(7)
    const def = fieldDefMap.get(rawKey)
    const fieldType = def?.fieldType ?? 'text'
    const selectOptions = def?.selectOptions ? JSON.parse(def.selectOptions) : []
    return {
      key,
      label: def?.label ?? rawKey.replace(/_/g, ' '),
      group: 'Custom Fields',
      valueType: valueTypeForType(fieldType),
      operators: opsForType(fieldType),
      ...(selectOptions.length > 0 ? { options: selectOptions } : {}),
    }
  })

  return (
    <SegmentBuilder
      segment={{
        id: segment.id,
        name: segment.name,
        description: segment.description,
        filtersJson: segment.filtersJson,
        objectType: segment.objectType,
        listType: segment.listType as 'dynamic' | 'static',
        memberIds: segment.memberIds,
        lastEvaluatedAt: segment.lastEvaluatedAt ? segment.lastEvaluatedAt.toISOString() : null,
      }}
      objectType={objectType}
      records={records}
      sequences={sequences}
      baseFields={baseFields}
      extraFields={extraFields}
      users={users}
      assignments={segment.assignments.map(a => ({
        id: a.id,
        userId: a.userId,
        user: { id: a.user.id, name: a.user.name, color: a.user.color },
      }))}
      workflowLinks={workflowLinks.map(l => ({
        id: l.id,
        sequenceId: l.sequenceId,
        assignedUserId: l.assignedUserId,
        sequence: l.sequence,
      }))}
      allSequences={allSequences}
    />
  )
}
