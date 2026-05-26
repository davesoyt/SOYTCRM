import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Plus, GitBranch, Calendar } from 'lucide-react'
import WorkflowCard from './WorkflowCard'

export const dynamic = 'force-dynamic'

const TRIGGER_COLORS: Record<string, string> = {
  Manual: 'bg-zinc-100 text-zinc-600',
  'Contact Created': 'bg-blue-100 text-blue-700',
  'Opportunity Created': 'bg-indigo-100 text-indigo-700',
  'Opportunity Stage Changed': 'bg-purple-100 text-purple-700',
  'Deal Created': 'bg-indigo-100 text-indigo-700',
  'Deal Stage Changed': 'bg-purple-100 text-purple-700',
  'Contact Enriched': 'bg-pink-100 text-pink-700',
  'Form Submitted': 'bg-teal-100 text-teal-700',
}

function nodeTypeSummary(nodesJson: string): { emails: number; waits: number; branches: number; tasks: number } {
  try {
    const nodes: { type: string }[] = JSON.parse(nodesJson)
    return {
      emails: nodes.filter((n) => n.type === 'email' || n.type === 'sms').length,
      waits: nodes.filter((n) => n.type === 'wait').length,
      branches: nodes.filter((n) => n.type === 'condition').length,
      tasks: nodes.filter((n) => n.type === 'task' || n.type === 'webhook' || n.type === 'updatescore' || n.type === 'moveopportunity').length,
    }
  } catch {
    return { emails: 0, waits: 0, branches: 0, tasks: 0 }
  }
}

export default async function SequencesPage() {
  const sequences = await prisma.sequence.findMany({
    include: {
      steps: true,
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Workflows</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Automate contact outreach with visual workflow builders</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sequences/history"
            className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Run History
          </Link>
          <Link
            href="/sequences/new"
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sequences.map((seq) => {
          const summary = nodeTypeSummary(seq.nodesJson)
          const stepCount = Math.max(seq.steps.length, summary.emails + summary.waits + summary.branches + summary.tasks)
          const triggerColor = TRIGGER_COLORS[seq.trigger] ?? 'bg-zinc-100 text-zinc-600'

          return (
            <WorkflowCard
              key={seq.id}
              id={seq.id}
              name={seq.name}
              description={seq.description}
              trigger={seq.trigger}
              isActive={seq.isActive}
              triggerColor={triggerColor}
              enrollmentCount={seq._count.enrollments}
              stepCount={stepCount}
              summary={summary}
            />
          )
        })}

        {!sequences.length && (
          <div className="col-span-full text-center py-20 text-zinc-400">
            <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium text-zinc-500">No workflows yet</p>
            <p className="text-sm mt-1">Build your first automated workflow to nurture contacts.</p>
            <Link
              href="/sequences/new"
              className="inline-flex items-center gap-2 mt-5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Workflow
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
