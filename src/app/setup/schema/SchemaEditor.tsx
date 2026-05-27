'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Check, Star, AlertCircle } from 'lucide-react'
import { saveFieldDefinitions } from '@/app/actions'
import type { SchemaField } from '@/lib/objectSchemaShared'

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'auto_increment', label: 'Auto Increment (integer)' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
  { value: 'select', label: 'Dropdown' },
  { value: 'boolean', label: 'Yes / No' },
]

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

type Row = SchemaField & { _uid: string }

export default function SchemaEditor({
  objectType,
  customObjectDefId,
  fields: initialFields,
}: {
  objectType: string | null
  customObjectDefId: string | null
  fields: SchemaField[]
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialFields.map((f, i) => ({ ...f, _uid: f.id ?? `init-${i}` })),
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, j) => j !== i))
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        _uid: `new-${Date.now()}`,
        key: '',
        label: '',
        fieldType: 'text',
        selectOptions: [],
        required: false,
        isPrimary: false,
        order: prev.length,
        isBuiltIn: false,
      },
    ])
  }

  function setPrimary(key: string) {
    setRows((prev) => prev.map((r) => ({ ...r, isPrimary: r.key === key })))
  }

  function save() {
    setError(null)
    const keys = rows.map((r) => r.key.trim()).filter(Boolean)
    if (new Set(keys).size !== keys.length) {
      setError('Duplicate field keys are not allowed.')
      return
    }
    if (rows.some((r) => !r.isBuiltIn && (!r.key.trim() || !r.label.trim()))) {
      setError('Every custom field needs a label and key.')
      return
    }

    const payload = rows.map((r, i) => ({
      id: r.id,
      key: r.key.trim(),
      label: r.label.trim(),
      fieldType: r.fieldType,
      selectOptions: r.selectOptions,
      required: r.required,
      isPrimary: r.isPrimary,
      order: i,
      isBuiltIn: r.isBuiltIn,
    }))

    startTransition(async () => {
      try {
        await saveFieldDefinitions(objectType, customObjectDefId, payload)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save schema')
      }
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Add, rename, or remove fields. Custom field changes update stored record data. Built-in columns
        keep their database key; removing one hides it from forms and lists.
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2 w-32">Type</th>
              <th className="px-3 py-2 w-16 text-center">Req.</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row, i) => (
              <tr key={row._uid} className="group hover:bg-zinc-50/50">
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => setPrimary(row.key || row._uid)}
                    title="Primary display field"
                    className={`p-1 rounded ${row.isPrimary ? 'text-amber-500' : 'text-zinc-300 hover:text-amber-400'}`}
                  >
                    <Star className="w-4 h-4" fill={row.isPrimary ? 'currentColor' : 'none'} />
                  </button>
                </td>
                <td className="px-2 py-2">
                  <input
                    value={row.label}
                    onChange={(e) => {
                      const label = e.target.value
                      updateRow(i, {
                        label,
                        ...(!row.id && !row.isBuiltIn ? { key: slugify(label) } : {}),
                      })
                    }}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    placeholder="Field label"
                  />
                  {row.isBuiltIn && (
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">Built-in</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <input
                    value={row.key}
                    onChange={(e) => updateRow(i, { key: e.target.value })}
                    disabled={row.isBuiltIn}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400"
                    placeholder="field_key"
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    value={row.fieldType}
                    onChange={(e) => {
                      const nextType = e.target.value
                      updateRow(i, {
                        fieldType: nextType,
                        ...(nextType === 'auto_increment' ? { required: false } : {}),
                      })
                    }}
                    className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={row.required}
                    onChange={(e) => updateRow(i, { required: e.target.checked })}
                    disabled={row.fieldType === 'auto_increment'}
                    className="rounded border-zinc-300"
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={row.isBuiltIn ? 'Hide field' : 'Remove field and delete data'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
                  No fields. Add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900"
      >
        <Plus className="w-4 h-4" /> Add field
      </button>

      <div className="flex items-center gap-3 pt-2 border-t border-zinc-200">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" /> Saved
            </>
          ) : isPending ? (
            'Saving…'
          ) : (
            'Save schema'
          )}
        </button>
      </div>
    </div>
  )
}
