'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { Play, GitBranch, Mail, Clock, Users, Zap, Trash2 } from 'lucide-react'
import { deleteSequence } from '@/app/actions'

type WorkflowCardProps = {
  id: string
  name: string
  description: string | null
  trigger: string
  isActive: boolean
  triggerColor: string
  enrollmentCount: number
  stepCount: number
  summary: { emails: number; waits: number; branches: number; tasks: number }
}

export default function WorkflowCard({
  id,
  name,
  description,
  trigger,
  isActive,
  triggerColor,
  enrollmentCount,
  stepCount,
  summary,
}: WorkflowCardProps) {
  const [isPending, startTransition] = useTransition()

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete workflow "${name}"? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteSequence(id)
    })
  }

  return (
    <article className="flex flex-col bg-white rounded-xl border border-zinc-200 hover:border-zinc-400 hover:shadow-sm transition-all overflow-hidden">
      <div className="flex items-start justify-between gap-2 border-b border-zinc-100 bg-zinc-50/80 px-4 py-3">
        <div className="min-w-0 flex-1">
          <Link href={`/sequences/${id}`} className="block min-w-0">
            <p className="font-semibold text-zinc-900 truncate hover:underline">{name}</p>
          </Link>
          {description && (
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap ${
              isActive
                ? 'bg-emerald-500 text-white ring-emerald-600'
                : 'bg-amber-400 text-amber-950 ring-amber-500'
            }`}
          >
            {isActive ? 'Active' : 'Draft'}
          </span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
            title="Delete workflow"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      </div>

      <Link href={`/sequences/${id}`} className="flex flex-1 flex-col p-4 pt-3">
        <div className="mb-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg ${triggerColor}`}>
            <Play className="w-3 h-3" />
            {trigger}
          </span>
        </div>

        <div className="flex gap-3 text-xs text-zinc-500 mb-3">
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

        <div className="mt-auto flex items-center justify-between pt-3 border-t border-zinc-100">
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <Users className="w-3 h-3" />
            {enrollmentCount} enrolled
          </span>
          <span className="text-xs text-zinc-400">
            {stepCount} step{stepCount !== 1 ? 's' : ''}
          </span>
        </div>
      </Link>
    </article>
  )
}
