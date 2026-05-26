import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SegmentBuilder from './SegmentBuilder'
import { parseObjectTypes, type FieldMeta, type FlatRecord } from '@/lib/filters'
import { buildObjectTypeMeta } from '@/lib/segmentObjects'
import { loadRecordsForType, loadFieldsForType } from '@/lib/segmentData'

export const dynamic = 'force-dynamic'

export default async function SegmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [segment, users, workflowLinks, allSequences, customObjects] = await Promise.all([
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
    prisma.customObjectDef.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, pluralName: true, icon: true, color: true },
    }),
  ])
  if (!segment) notFound()

  const objectTypes = parseObjectTypes(segment)
  const objectTypeMeta = buildObjectTypeMeta(customObjects)

  const recordsByType: Record<string, FlatRecord[]> = {}
  const fieldsByType: Record<string, FieldMeta[]> = {}

  await Promise.all(
    objectTypes.map(async (type) => {
      const [records, { baseFields, extraFields }] = await Promise.all([
        loadRecordsForType(type),
        loadFieldsForType(type, []),
      ])
      recordsByType[type] = records
      fieldsByType[type] = [...baseFields, ...extraFields]
    }),
  )

  const sequences = objectTypes.includes('contact')
    ? allSequences
    : []

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
      objectTypes={objectTypes}
      recordsByType={recordsByType}
      fieldsByType={fieldsByType}
      objectTypeMeta={objectTypeMeta}
      sequences={sequences}
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
