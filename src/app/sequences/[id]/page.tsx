import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { processSequenceStep } from '@/app/actions'
import { ArrowLeft, CheckCircle2, Clock, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import WorkflowCanvas from './WorkflowCanvas'
import type { Node, Edge } from '@xyflow/react'

export default async function SequencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [sequence, users, segments, forms] = await Promise.all([
    prisma.sequence.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: 'asc' } },
        enrollments: {
          include: { contact: true },
          orderBy: { startedAt: 'desc' },
        },
      },
    }),
    prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.segment.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.form.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  if (!sequence) notFound()

  // Parse saved workflow state, or build default from legacy steps
  let initialNodes: Node[] = []
  let initialEdges: Edge[] = []

  try {
    initialNodes = JSON.parse(sequence.nodesJson || '[]')
    initialEdges = JSON.parse(sequence.edgesJson || '[]')
  } catch {
    initialNodes = []
    initialEdges = []
  }

  // Seed a default canvas if empty
  if (initialNodes.length === 0) {
    initialNodes = [
      {
        id: 'trigger_0',
        type: 'trigger',
        position: { x: 250, y: 40 },
        data: { label: 'Trigger', config: { event: sequence.trigger ?? 'Manual' } },
      },
      ...sequence.steps.map((step, i) => ({
        id: `email_${i}`,
        type: 'email',
        position: { x: 250, y: 160 + i * 140 },
        data: { label: 'Send Email', config: { subject: step.subject, body: step.body } },
      })),
    ]
    initialEdges = sequence.steps.map((_, i) => ({
      id: `e${i}`,
      source: i === 0 ? 'trigger_0' : `email_${i - 1}`,
      target: `email_${i}`,
      animated: true,
      style: { stroke: '#71717a', strokeWidth: 2 },
    }))
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-zinc-200 bg-white shrink-0">
        <Link href="/sequences" className="text-zinc-400 hover:text-zinc-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-zinc-900 leading-tight">{sequence.name}</h1>
          {sequence.description && <p className="text-xs text-zinc-400">{sequence.description}</p>}
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {sequence.enrollments.length} enrolled
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sequence.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
            {sequence.isActive ? 'Active' : 'Draft'}
          </span>
        </div>
      </div>

      {/* Main area: canvas + enrollments sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 bg-zinc-50 min-h-0" style={{ height: '100%' }}>
          <WorkflowCanvas
            sequenceId={sequence.id}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            isActive={sequence.isActive}
            users={users}
            segments={segments}
            forms={forms}
          />
        </div>

        {/* Enrollments panel */}
        <div className="w-72 shrink-0 border-l border-zinc-200 bg-white flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">Enrolled Contacts</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{sequence.enrollments.length} total</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-50">
            {sequence.enrollments.map((e) => {
              const totalSteps = sequence.steps.length
              const progress = totalSteps ? Math.round((e.currentStep / totalSteps) * 100) : 0
              const advanceAction = processSequenceStep.bind(null, e.id)
              return (
                <div key={e.id} className="p-4">
                  <div className="flex items-start justify-between mb-1.5">
                    <Link href={`/contacts/${e.contactId}`} className="text-sm font-medium hover:underline text-zinc-900">
                      {e.contact.firstName} {e.contact.lastName}
                    </Link>
                    <span className={`flex items-center gap-1 text-xs font-medium shrink-0 ml-2 ${e.active ? 'text-green-600' : 'text-zinc-400'}`}>
                      {e.active ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      {e.active ? `Step ${e.currentStep + 1}` : 'Done'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-2">
                    {formatDistanceToNow(new Date(e.startedAt), { addSuffix: true })}
                  </p>
                  <div className="w-full h-1 rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-zinc-900 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  {e.active && totalSteps > 0 && (
                    <form action={advanceAction} className="mt-2">
                      <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
                        → Send next step
                      </button>
                    </form>
                  )}
                </div>
              )
            })}
            {!sequence.enrollments.length && (
              <div className="p-4 text-xs text-zinc-400 text-center py-8">
                No contacts enrolled yet.<br />Enroll from a contact page.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
