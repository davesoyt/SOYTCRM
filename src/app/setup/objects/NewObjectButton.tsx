'use client'

import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { createCustomObjectDef } from '@/app/actions'

export default function NewObjectButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [pluralName, setPluralName] = useState('')
  const [isPending, startTransition] = useTransition()

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  }

  function submit() {
    if (!name.trim() || !pluralName.trim()) return
    startTransition(async () => {
      await createCustomObjectDef({
        name: name.trim(),
        pluralName: pluralName.trim(),
        slug: slugify(pluralName.trim()),
        icon: 'Box',
        color: '#6366f1',
      })
    })
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
        <Plus className="w-4 h-4" /> New Object
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">New Custom Object</h2>
          <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Singular name</label>
          <input value={name} onChange={e => { setName(e.target.value); if (!pluralName) setPluralName(e.target.value + 's') }}
            placeholder="e.g. Project"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Plural name</label>
          <input value={pluralName} onChange={e => setPluralName(e.target.value)}
            placeholder="e.g. Projects"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          <p className="text-xs text-zinc-400 mt-1">URL: /objects/{slugify(pluralName || 'projects')}</p>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={submit} disabled={isPending || !name.trim() || !pluralName.trim()}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors">
            Create Object
          </button>
          <button onClick={() => setOpen(false)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
