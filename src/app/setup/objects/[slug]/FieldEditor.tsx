'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, GripVertical, Check, ChevronDown, ChevronUp, Star } from 'lucide-react'
import { saveFieldDefinitions } from '@/app/actions'

type FieldDef = {
  id?: string
  _uid?: string     // stable render key, never changes after creation
  key: string
  label: string
  fieldType: string
  selectOptions: string[]
  required: boolean
  isPrimary: boolean
  order: number
  isBuiltIn: boolean
}

const FIELD_TYPES = [
  { value: 'text',    label: 'Text' },
  { value: 'number',  label: 'Number' },
  { value: 'date',    label: 'Date' },
  { value: 'email',   label: 'Email' },
  { value: 'phone',   label: 'Phone' },
  { value: 'url',     label: 'URL' },
  { value: 'select',  label: 'Select (dropdown)' },
  { value: 'boolean', label: 'Yes / No' },
]

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function FieldRow({
  field,
  isPrimaryKey,
  onSetPrimary,
  onChange,
  onRemove,
}: {
  field: FieldDef
  isPrimaryKey: boolean
  onSetPrimary: () => void
  onChange: (patch: Partial<FieldDef>) => void
  onRemove?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [optionInput, setOptionInput] = useState('')

  return (
    <div className={`border rounded-xl bg-white overflow-hidden transition-colors ${isPrimaryKey ? 'border-amber-300 ring-1 ring-amber-200' : 'border-zinc-200'}`}>
      <div className="flex items-center gap-2 px-3 py-3">
        <GripVertical className="w-4 h-4 text-zinc-300 shrink-0 cursor-grab" />

        {/* Primary key star */}
        <button
          onClick={onSetPrimary}
          title={isPrimaryKey ? 'Primary field' : 'Set as primary field'}
          className={`shrink-0 transition-colors ${isPrimaryKey ? 'text-amber-400' : 'text-zinc-200 hover:text-amber-300'}`}
        >
          <Star className="w-4 h-4" fill={isPrimaryKey ? 'currentColor' : 'none'} />
        </button>

        <div className="flex-1 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-0.5">Label</label>
            <input
              value={field.label}
              onChange={e => {
                const label = e.target.value
                onChange({ label, ...(!field.id && !field.isBuiltIn ? { key: slugify(label) } : {}) })
              }}
              placeholder="Field label"
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-0.5">Type</label>
            <select
              value={field.fieldType}
              onChange={e => onChange({ fieldType: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
            >
              {FIELD_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {field.isBuiltIn && (
            <span className="text-xs text-zinc-400 px-2 py-0.5 rounded bg-zinc-100">Built-in</span>
          )}
          {isPrimaryKey && (
            <span className="text-xs text-amber-600 px-2 py-0.5 rounded bg-amber-50 font-medium">Primary</span>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-zinc-100 space-y-3 bg-zinc-50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-0.5">Field key</label>
              <input
                value={field.key}
                onChange={e => onChange({ key: e.target.value })}
                disabled={field.isBuiltIn}
                placeholder="field_key"
                className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400"
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={e => onChange({ required: e.target.checked })}
                  className="rounded border-zinc-300"
                />
                Required
              </label>
            </div>
          </div>

          {field.fieldType === 'select' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Options</label>
              <div className="space-y-1 mb-2">
                {field.selectOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={opt}
                      onChange={e => {
                        const newOpts = [...field.selectOptions]
                        newOpts[i] = e.target.value
                        onChange({ selectOptions: newOpts })
                      }}
                      className="flex-1 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                    <button
                      onClick={() => onChange({ selectOptions: field.selectOptions.filter((_, j) => j !== i) })}
                      className="text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={optionInput}
                  onChange={e => setOptionInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && optionInput.trim()) {
                      onChange({ selectOptions: [...field.selectOptions, optionInput.trim()] })
                      setOptionInput('')
                    }
                  }}
                  placeholder="Add option…"
                  className="flex-1 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <button
                  onClick={() => {
                    if (optionInput.trim()) {
                      onChange({ selectOptions: [...field.selectOptions, optionInput.trim()] })
                      setOptionInput('')
                    }
                  }}
                  className="px-2 py-1 rounded border border-zinc-200 text-sm hover:bg-zinc-100"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FieldEditor({
  objectType,
  customObjectDefId,
  fields: initialFields,
}: {
  objectType: string | null
  customObjectDefId: string | null
  fields: FieldDef[]
}) {
  const [fields, setFields] = useState(() =>
    initialFields.map((f, i) => ({ ...f, _uid: f.id ?? `init-${i}` }))
  )
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const primaryKey = fields.find(f => f.isPrimary)?.key ?? null

  function setPrimary(key: string) {
    setFields(prev => prev.map(f => ({ ...f, isPrimary: f.key === key })))
  }

  function updateField(i: number, patch: Partial<FieldDef>) {
    setFields(prev => prev.map((f, j) => j === i ? { ...f, ...patch } : f))
  }

  function removeField(i: number) {
    setFields(prev => prev.filter((_, j) => j !== i))
  }

  function addField() {
    const order = fields.length
    setFields(prev => [...prev, {
      _uid: `new-${Date.now()}`,
      key: '',
      label: '',
      fieldType: 'text',
      selectOptions: [],
      required: false,
      isPrimary: false,
      order,
      isBuiltIn: false,
    }])
  }

  function save() {
    const indexed = fields.map((f, i) => ({ ...f, order: i }))
    startTransition(async () => {
      await saveFieldDefinitions(objectType, customObjectDefId, indexed)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="space-y-4">
      {/* Primary field legend */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
        <span>Click the star on any field to mark it as the <strong>primary field</strong> — used as the record display name throughout the CRM.</span>
      </div>

      <div className="space-y-2">
        {fields.map((f, i) => (
          <FieldRow
            key={f._uid}
            field={f}
            isPrimaryKey={f.isPrimary}
            onSetPrimary={() => setPrimary(f.key || '')}
            onChange={patch => updateField(i, patch)}
            onRemove={f.isBuiltIn ? undefined : () => removeField(i)}
          />
        ))}

        {fields.length === 0 && (
          <div className="text-sm text-zinc-400 py-8 text-center border border-dashed border-zinc-200 rounded-xl">
            No fields yet. Add one below.
          </div>
        )}
      </div>

      <button
        onClick={addField}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <Plus className="w-4 h-4" /> Add field
      </button>

      <div className="pt-2 border-t border-zinc-200">
        <button
          onClick={save}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save fields'}
        </button>
      </div>
    </div>
  )
}
