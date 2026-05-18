'use client'

import { useState, useTransition } from 'react'
import { Trash2, X } from 'lucide-react'
import { clearAllRecords } from '@/app/actions'

export default function DeleteAllButton({
  target,
  count,
}: {
  target: 'contacts' | 'companies' | 'deals'
  count: number
}) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (!count) return null

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Delete All
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2">
      <span className="text-sm text-red-700 font-medium">
        Delete all {count} {target}?
      </span>
      <button
        onClick={() => startTransition(async () => { await clearAllRecords(target) })}
        disabled={isPending}
        className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Deleting…' : 'Yes, delete all'}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-red-400 hover:text-red-700 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
