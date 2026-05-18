'use client'

import { useState, useTransition } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'
import { clearAllRecords } from '@/app/actions'

type Target = 'contacts' | 'companies' | 'deals'

const TARGETS: { id: Target; label: string; warning: string }[] = [
  { id: 'contacts', label: 'All Contacts', warning: 'This will permanently delete all contacts, their activities, and enrollments. Deals will be unlinked.' },
  { id: 'companies', label: 'All Companies', warning: 'This will permanently delete all companies and their activities. Contacts and deals will be unlinked.' },
  { id: 'deals', label: 'All Deals', warning: 'This will permanently delete all deals and deal-related activities.' },
]

export default function DashboardActions() {
  const [confirming, setConfirming] = useState<Target | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(target: Target) {
    startTransition(async () => {
      await clearAllRecords(target)
      setConfirming(null)
    })
  }

  const target = confirming ? TARGETS.find(t => t.id === confirming) : null

  return (
    <>
      <div className="mt-8 border-t border-zinc-200 pt-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Danger Zone</h2>
        <div className="flex flex-wrap gap-3">
          {TARGETS.map(t => (
            <button
              key={t.id}
              onClick={() => setConfirming(t.id)}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete {t.label}
            </button>
          ))}
        </div>
      </div>

      {confirming && target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-semibold text-zinc-900">Delete {target.label}?</h3>
            </div>
            <p className="text-sm text-zinc-600 mb-5">{target.warning}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirming(null)}
                disabled={isPending}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirming)}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isPending ? 'Deleting…' : 'Yes, delete all'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
