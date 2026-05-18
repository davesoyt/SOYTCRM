'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Trash2 } from 'lucide-react'
import { updateCustomObjectRecord, deleteCustomObjectRecord } from '@/app/actions'

type FieldMeta = { key: string; label: string; fieldType: string; selectOptions: string[] }

export default function RecordDetailClient({
  defId,
  recordId,
  fields,
  initialData,
}: {
  defId: string
  recordId: string
  fields: FieldMeta[]
  initialData: Record<string, string>
}) {
  const [editing, setEditing] = useState(false)
  const [data, setData] = useState(initialData)
  const [draft, setDraft] = useState(initialData)
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      await updateCustomObjectRecord(recordId, defId, draft)
      setData(draft)
      setEditing(false)
    })
  }

  function cancel() {
    setDraft(data)
    setEditing(false)
  }

  function remove() {
    startTransition(async () => {
      await deleteCustomObjectRecord(recordId, defId)
    })
  }

  const renderInput = (f: FieldMeta) => {
    if (f.fieldType === 'select') {
      return (
        <select value={draft[f.key] ?? ''} onChange={e => setDraft(v => ({ ...v, [f.key]: e.target.value }))}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900">
          <option value="">— Select —</option>
          {f.selectOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    if (f.fieldType === 'boolean') {
      return (
        <select value={draft[f.key] ?? ''} onChange={e => setDraft(v => ({ ...v, [f.key]: e.target.value }))}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900">
          <option value="">—</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      )
    }
    return (
      <input
        type={f.fieldType === 'number' ? 'number' : f.fieldType === 'date' ? 'date' : f.fieldType === 'email' ? 'email' : 'text'}
        value={draft[f.key] ?? ''}
        onChange={e => setDraft(v => ({ ...v, [f.key]: e.target.value }))}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
      />
    )
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-zinc-700">Details</h2>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={save} disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors">
                <Check className="w-4 h-4" /> Save
              </button>
              <button onClick={cancel}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 transition-colors">
                <X className="w-4 h-4" /> Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 transition-colors">
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button onClick={remove} disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-zinc-400">No fields defined for this object.</p>
      )}

      {editing ? (
        <div className="space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">{f.label}</label>
              {renderInput(f)}
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {fields.map(f => (
            <div key={f.key} className="flex items-baseline gap-2 py-2">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide w-32 shrink-0">{f.label}</span>
              <span className="text-sm text-zinc-800">{data[f.key] || <span className="text-zinc-300">—</span>}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
