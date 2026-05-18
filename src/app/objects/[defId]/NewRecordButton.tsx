'use client'

import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { createCustomObjectRecord } from '@/app/actions'

type FieldMeta = { key: string; label: string; fieldType: string; selectOptions: string[] }

export default function NewRecordButton({ defId, fields }: { defId: string; fields: FieldMeta[] }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      await createCustomObjectRecord(defId, values)
    })
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
        <Plus className="w-4 h-4" /> New Record
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">New Record</h2>
          <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        {fields.length === 0 && (
          <p className="text-sm text-zinc-400">No fields defined. Add fields in Setup → Objects.</p>
        )}
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">{f.label}</label>
            {f.fieldType === 'select' ? (
              <select value={values[f.key] ?? ''} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900">
                <option value="">— Select —</option>
                {f.selectOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.fieldType === 'boolean' ? (
              <select value={values[f.key] ?? ''} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900">
                <option value="">—</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            ) : (
              <input
                type={f.fieldType === 'number' ? 'number' : f.fieldType === 'date' ? 'date' : f.fieldType === 'email' ? 'email' : 'text'}
                value={values[f.key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            )}
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <button onClick={submit} disabled={isPending}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors">
            Create
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
