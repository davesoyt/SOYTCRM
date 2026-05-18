import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Plus, Play, GitBranch, Mail, Clock, Users, Zap } from 'lucide-react'

const TRIGGER_COLORS: Record<string, string> = {
  Manual: 'bg-zinc-100 text-zinc-600',
  'Contact Created': 'bg-blue-100 text-blue-700',
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
      tasks: nodes.filter((n) => n.type === 'task' || n.type === 'webhook' || n.type === 'updatescore' || n.type === 'movedeal').length,
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
        <Link
          href="/sequences/new"
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sequences.map((seq) => {
          const summary = nodeTypeSummary(seq.nodesJson)
          const stepCount = Math.max(seq.steps.length, summary.emails + summary.waits + summary.branches + summary.tasks)
          const triggerColor = TRIGGER_COLORS[seq.trigger] ?? 'bg-zinc-100 text-zinc-600'

          return (
            <Link
              key={seq.id}
              href={`/sequences/${seq.id}`}
              className="block bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="font-semibold text-zinc-900 truncate">{seq.name}</p>
                  {seq.description && (
                    <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{seq.description}</p>
                  )}
                </div>
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${seq.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                  {seq.isActive ? 'Active' : 'Draft'}
                </span>
              </div>

              {/* Trigger badge */}
              <div className="mb-4">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg ${triggerColor}`}>
                  <Play className="w-3 h-3" />
                  {seq.trigger}
                </span>
              </div>

              {/* Step type breakdown */}
              <div className="flex gap-3 text-xs text-zinc-500 mb-4">
                {summary.emails > 0 && (
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{summary.emails}</span>
                )}
                {summary.waits > 0 && (
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{summary.waits}</span>
                )}
                {summary.branches > 0 && (
                  <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" />{summary.branches}</span>
                )}
                {summary.tasks > 0 && (
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{summary.tasks}</span>
                )}
                {stepCount === 0 && (
                  <span className="italic text-zinc-300">No steps yet</span>
                )}
              </div>

              {/* Footer stats */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                <span className="flex items-center gap-1 text-xs text-zinc-500">
                  <Users className="w-3 h-3" />
                  {seq._count.enrollments} enrolled
                </span>
                <span className="text-xs text-zinc-400">
                  {stepCount} step{stepCount !== 1 ? 's' : ''}
                </span>
              </div>
            </Link>
          )
        })}

        {/* Empty state */}
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
