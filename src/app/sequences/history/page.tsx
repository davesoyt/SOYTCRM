import { prisma } from '@/lib/prisma'
import WorkflowHistoryClient from './WorkflowHistoryClient'

export const dynamic = 'force-dynamic'

export default async function WorkflowHistoryPage() {
  const [enrollments, sequences] = await Promise.all([
    prisma.enrollment.findMany({
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        sequence: { select: { id: true, name: true, trigger: true } },
        runLogs: { orderBy: { executedAt: 'asc' } },
      },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.sequence.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const serialized = enrollments.map(e => ({
    id: e.id,
    contactId: e.contactId,
    contact: e.contact,
    recordType: e.recordType,
    recordId: e.recordId,
    recordLabel: e.recordLabel || (e.contact ? `${e.contact.firstName} ${e.contact.lastName}` : e.recordId),
    sequenceId: e.sequenceId,
    sequence: e.sequence,
    currentStep: e.currentStep,
    currentNodeId: e.currentNodeId,
    resumeAt: e.resumeAt?.toISOString() ?? null,
    active: e.active,
    startedAt: e.startedAt.toISOString(),
    completedAt: e.completedAt?.toISOString() ?? null,
    runLogs: e.runLogs.map(l => ({
      id: l.id,
      stepIndex: l.stepIndex,
      nodeType: l.nodeType,
      nodeLabel: l.nodeLabel,
      dataJson: l.dataJson,
      status: l.status,
      executedAt: l.executedAt.toISOString(),
    })),
  }))

  return <WorkflowHistoryClient enrollments={serialized} sequences={sequences} />
}
