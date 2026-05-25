'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, GripVertical, CheckSquare, Square,
  ChevronDown, ChevronUp, Save, CheckCircle2, ClipboardList,
  AlignLeft, Hash, Calendar, Mail, Phone, Globe, List, ToggleLeft,
  Eye, Settings2,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { saveForm } from '@/app/actions'
import type { AvailableObject } from './page'

// ---- Types ----

type FormField = {
  id: string
  fieldKey: string
  objectType: string
  label: string
  required: boolean
  placeholder: string
  width: 1 | 2 | 3
}

type FormRow = {
  id: string
  columns: (FormField | null)[]
}

type FormSection = {
  id: string
  label: string
  rows: FormRow[]
}

// ---- Field type icon ----

function FieldTypeIcon({ type }: { type: string }) {
  const cls = 'w-3 h-3'
  switch (type) {
    case 'number': return <Hash className={cls} />
    case 'date': return <Calendar className={cls} />
    case 'email': return <Mail className={cls} />
    case 'phone': return <Phone className={cls} />
    case 'url': return <Globe className={cls} />
    case 'select': return <List className={cls} />
    case 'boolean': return <ToggleLeft className={cls} />
    default: return <AlignLeft className={cls} />
  }
}

function fieldTypeBadge(type: string): string {
  switch (type) {
    case 'number': return 'bg-blue-50 text-blue-600'
    case 'date': return 'bg-orange-50 text-orange-600'
    case 'email': return 'bg-pink-50 text-pink-600'
    case 'phone': return 'bg-green-50 text-green-600'
    case 'url': return 'bg-purple-50 text-purple-600'
    case 'select': return 'bg-yellow-50 text-yellow-600'
    case 'boolean': return 'bg-teal-50 text-teal-600'
    default: return 'bg-zinc-100 text-zinc-500'
  }
}

// ---- Drag payload types ----

type PalettePayload = {
  kind: 'palette'
  fieldKey: string
  objectType: string
  label: string
  fieldType: string
}

type ExistingPayload = {
  kind: 'existing'
  fieldId: string
  fromSectionId: string
  fromRowId: string
  fromColIndex: number
}

type DragPayload = PalettePayload | ExistingPayload

// ---- Column slot ----

function ColumnSlot({
  field,
  onDrop,
  onRemove,
  onFieldChange,
}: {
  field: FormField | null
  onDrop: (payload: DragPayload, colIndex?: number) => void
  onRemove: () => void
  onFieldChange: (updated: FormField) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const raw = e.dataTransfer.getData('field-designer')
    if (!raw) return
    try {
      const payload = JSON.parse(raw) as DragPayload
      onDrop(payload)
    } catch {}
  }

  if (!field) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 min-h-[64px] rounded-lg border-2 border-dashed flex items-center justify-center text-xs font-medium transition-colors ${
          dragOver
            ? 'border-violet-400 bg-violet-50 text-violet-600'
            : 'border-zinc-200 text-zinc-400 hover:border-zinc-300'
        }`}
      >
        Drop field here
      </div>
    )
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        const payload: ExistingPayload = {
          kind: 'existing',
          fieldId: field.id,
          fromSectionId: '',
          fromRowId: '',
          fromColIndex: -1,
        }
        e.dataTransfer.setData('field-designer', JSON.stringify(payload))
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 min-h-[64px] rounded-lg border bg-white shadow-sm transition-all ${
        dragOver ? 'border-violet-400 ring-2 ring-violet-200' : 'border-zinc-200'
      }`}
    >
      <div className="px-3 py-2">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <GripVertical className="w-3.5 h-3.5 text-zinc-300 shrink-0 cursor-grab" />
            <span className="text-sm font-medium text-zinc-900 truncate">{field.label}</span>
            <span className={`shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${fieldTypeBadge(field.objectType + ':' + field.fieldKey || 'text')}`}>
              <span className="capitalize text-zinc-500 text-[9px]">{field.objectType}</span>
            </span>
          </div>
          <button
            onClick={onRemove}
            className="shrink-0 p-0.5 text-zinc-300 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Placeholder input */}
        <input
          type="text"
          value={field.placeholder}
          onChange={(e) => onFieldChange({ ...field, placeholder: e.target.value })}
          placeholder="Placeholder text…"
          className="w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-400 bg-zinc-50"
        />

        {/* Required toggle */}
        <button
          onClick={() => onFieldChange({ ...field, required: !field.required })}
          className="flex items-center gap-1.5 mt-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          {field.required ? (
            <CheckSquare className="w-3.5 h-3.5 text-violet-600" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
          Required
        </button>
      </div>
    </div>
  )
}

// ---- Form Row ----

function FormRowComponent({
  row,
  sectionId,
  onDrop,
  onRemoveField,
  onFieldChange,
  onDeleteRow,
  onChangeColumns,
}: {
  row: FormRow
  sectionId: string
  onDrop: (sectionId: string, rowId: string, colIndex: number, payload: DragPayload) => void
  onRemoveField: (sectionId: string, rowId: string, colIndex: number) => void
  onFieldChange: (sectionId: string, rowId: string, colIndex: number, updated: FormField) => void
  onDeleteRow: (sectionId: string, rowId: string) => void
  onChangeColumns: (sectionId: string, rowId: string, count: 1 | 2 | 3) => void
}) {
  const colCount = row.columns.length as 1 | 2 | 3

  return (
    <div className="group relative mb-2">
      <div className="flex items-center gap-2">
        {row.columns.map((field, colIndex) => (
          <ColumnSlot
            key={`${row.id}-${colIndex}`}
            field={field}
            onDrop={(payload) => onDrop(sectionId, row.id, colIndex, payload)}
            onRemove={() => onRemoveField(sectionId, row.id, colIndex)}
            onFieldChange={(updated) => onFieldChange(sectionId, row.id, colIndex, updated)}
          />
        ))}

        {/* Row controls */}
        <div className="flex flex-col gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-0.5">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                onClick={() => onChangeColumns(sectionId, row.id, n)}
                className={`w-5 h-5 rounded text-[9px] font-bold transition-colors ${
                  colCount === n
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={() => onDeleteRow(sectionId, row.id)}
            className="w-full p-1 rounded bg-zinc-100 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Form Section ----

function FormSectionComponent({
  section,
  onDrop,
  onRemoveField,
  onFieldChange,
  onDeleteRow,
  onChangeColumns,
  onAddRow,
  onDeleteSection,
  onLabelChange,
}: {
  section: FormSection
  onDrop: (sectionId: string, rowId: string, colIndex: number, payload: DragPayload) => void
  onRemoveField: (sectionId: string, rowId: string, colIndex: number) => void
  onFieldChange: (sectionId: string, rowId: string, colIndex: number, updated: FormField) => void
  onDeleteRow: (sectionId: string, rowId: string) => void
  onChangeColumns: (sectionId: string, rowId: string, count: 1 | 2 | 3) => void
  onAddRow: (sectionId: string) => void
  onDeleteSection: (sectionId: string) => void
  onLabelChange: (sectionId: string, label: string) => void
}) {
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelValue, setLabelValue] = useState(section.label)

  function commitLabel() {
    setEditingLabel(false)
    onLabelChange(section.id, labelValue.trim() || 'Section')
  }

  return (
    <div className="mb-4 rounded-xl border border-zinc-200 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 border-l-4 border-l-violet-500">
        {editingLabel ? (
          <input
            autoFocus
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') commitLabel() }}
            className="flex-1 bg-transparent text-sm font-semibold text-zinc-900 focus:outline-none border-b border-violet-400"
          />
        ) : (
          <button
            onClick={() => setEditingLabel(true)}
            className="flex-1 text-left text-sm font-semibold text-zinc-900 hover:text-violet-700 transition-colors"
          >
            {section.label}
          </button>
        )}
        <button
          onClick={() => onDeleteSection(section.id)}
          className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Rows */}
      <div className="p-3">
        {section.rows.map((row) => (
          <FormRowComponent
            key={row.id}
            row={row}
            sectionId={section.id}
            onDrop={onDrop}
            onRemoveField={onRemoveField}
            onFieldChange={onFieldChange}
            onDeleteRow={onDeleteRow}
            onChangeColumns={onChangeColumns}
          />
        ))}

        {section.rows.length === 0 && (
          <p className="text-xs text-zinc-400 text-center py-4 italic">
            No rows yet — click Add Row
          </p>
        )}

        <button
          onClick={() => onAddRow(section.id)}
          className="mt-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-violet-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Row
        </button>
      </div>
    </div>
  )
}

// ---- Main FormDesigner ----

type FormProps = {
  form: {
    id: string
    name: string
    description: string
    objectTypes: string
    layoutJson: string
  }
  availableObjects: AvailableObject[]
}

export default function FormDesigner({ form, availableObjects }: FormProps) {
  const [name, setName] = useState(form.name)
  const [description, setDescription] = useState(form.description)
  const [tab, setTab] = useState<'design' | 'preview'>('design')
  const [selectedObjectTypes, setSelectedObjectTypes] = useState<string[]>(() => {
    try { return JSON.parse(form.objectTypes) } catch { return [] }
  })
  const [sections, setSections] = useState<FormSection[]>(() => {
    try { return JSON.parse(form.layoutJson) } catch { return [] }
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeObjectTab, setActiveObjectTab] = useState<string>('')

  // Determine active palette object
  const paletteObjects = availableObjects.filter(o => selectedObjectTypes.includes(o.id))
  const activeTabId = activeObjectTab && paletteObjects.find(o => o.id === activeObjectTab)
    ? activeObjectTab
    : paletteObjects[0]?.id ?? ''

  const activeObject = paletteObjects.find(o => o.id === activeTabId)

  // ---- Section / Row mutations ----

  const addSection = useCallback(() => {
    setSections(prev => [...prev, {
      id: nanoid(),
      label: `Section ${prev.length + 1}`,
      rows: [],
    }])
  }, [])

  const deleteSection = useCallback((sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId))
  }, [])

  const updateSectionLabel = useCallback((sectionId: string, label: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, label } : s))
  }, [])

  const addRow = useCallback((sectionId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      return { ...s, rows: [...s.rows, { id: nanoid(), columns: [null] }] }
    }))
  }, [])

  const deleteRow = useCallback((sectionId: string, rowId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      return { ...s, rows: s.rows.filter(r => r.id !== rowId) }
    }))
  }, [])

  const changeRowColumns = useCallback((sectionId: string, rowId: string, count: 1 | 2 | 3) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        rows: s.rows.map(r => {
          if (r.id !== rowId) return r
          const cols = Array.from({ length: count }, (_, i) => r.columns[i] ?? null)
          return { ...r, columns: cols }
        }),
      }
    }))
  }, [])

  const removeField = useCallback((sectionId: string, rowId: string, colIndex: number) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        rows: s.rows.map(r => {
          if (r.id !== rowId) return r
          const cols = [...r.columns]
          cols[colIndex] = null
          return { ...r, columns: cols }
        }),
      }
    }))
  }, [])

  const updateField = useCallback((sectionId: string, rowId: string, colIndex: number, updated: FormField) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        rows: s.rows.map(r => {
          if (r.id !== rowId) return r
          const cols = [...r.columns]
          cols[colIndex] = updated
          return { ...r, columns: cols }
        }),
      }
    }))
  }, [])

  // ---- Drop handler ----

  const handleDrop = useCallback((sectionId: string, rowId: string, colIndex: number, payload: DragPayload) => {
    if (payload.kind === 'palette') {
      const newField: FormField = {
        id: nanoid(),
        fieldKey: payload.fieldKey,
        objectType: payload.objectType,
        label: payload.label,
        required: false,
        placeholder: '',
        width: 1,
      }
      setSections(prev => prev.map(s => {
        if (s.id !== sectionId) return s
        return {
          ...s,
          rows: s.rows.map(r => {
            if (r.id !== rowId) return r
            const cols = [...r.columns]
            cols[colIndex] = newField
            return { ...r, columns: cols }
          }),
        }
      }))
    } else if (payload.kind === 'existing') {
      // Find the field by id across all sections
      let found: FormField | null = null
      let fromSectionId = ''
      let fromRowId = ''
      let fromColIndex = -1

      for (const s of sections) {
        for (const r of s.rows) {
          for (let ci = 0; ci < r.columns.length; ci++) {
            const f = r.columns[ci]
            if (f && f.id === payload.fieldId) {
              found = f
              fromSectionId = s.id
              fromRowId = r.id
              fromColIndex = ci
            }
          }
        }
      }

      if (!found) return
      const fieldToMove = found
      const fsi = fromSectionId
      const fri = fromRowId
      const fci = fromColIndex

      setSections(prev => {
        // Get target field if any (for swap)
        let targetField: FormField | null = null
        for (const s of prev) {
          if (s.id === sectionId) {
            for (const r of s.rows) {
              if (r.id === rowId) {
                targetField = r.columns[colIndex]
              }
            }
          }
        }

        return prev.map(s => {
          return {
            ...s,
            rows: s.rows.map(r => {
              const cols = [...r.columns]
              if (s.id === sectionId && r.id === rowId) {
                cols[colIndex] = fieldToMove
              }
              if (s.id === fsi && r.id === fri) {
                cols[fci] = targetField
              }
              return { ...r, columns: cols }
            }),
          }
        })
      })
    }
  }, [sections])

  // ---- Save ----

  async function handleSave() {
    setSaving(true)
    await saveForm(form.id, {
      name,
      description,
      objectTypes: JSON.stringify(selectedObjectTypes),
      layoutJson: JSON.stringify(sections),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function switchToPreview() {
    await handleSave()
    setTab('preview')
  }

  // ---- Object type toggle ----

  function toggleObjectType(id: string) {
    setSelectedObjectTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 bg-white shrink-0">
        <Link href="/forms" className="text-zinc-400 hover:text-zinc-700 transition-colors p-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ClipboardList className="w-4 h-4 text-violet-600 shrink-0" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="font-semibold text-zinc-900 bg-transparent focus:outline-none border-b border-transparent hover:border-zinc-300 focus:border-violet-500 transition-colors text-base leading-tight min-w-0 flex-1"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description…"
            className="text-sm text-zinc-500 bg-transparent focus:outline-none border-b border-transparent hover:border-zinc-300 focus:border-violet-500 transition-colors hidden sm:block w-44"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1 shrink-0">
          <button
            onClick={() => setTab('design')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'design' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            <Settings2 className="w-3.5 h-3.5" /> Design
          </button>
          <button
            onClick={switchToPreview}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'preview' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors shrink-0"
        >
          {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {tab === 'preview' && (
        <div className="flex-1 min-h-0">
          <iframe
            src={`/forms/${form.id}/preview`}
            className="w-full h-full border-none"
            title="Form Preview"
          />
        </div>
      )}

      {tab === 'design' && <div className="flex flex-1 overflow-hidden">
        {/* ---- Left Palette Panel ---- */}
        <div className="w-72 shrink-0 border-r border-zinc-200 bg-white flex flex-col overflow-hidden">
          {/* Object type selector */}
          <div className="px-4 py-3 border-b border-zinc-100">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Objects</p>
            <div className="flex flex-col gap-1.5">
              {availableObjects.map(obj => (
                <button
                  key={obj.id}
                  onClick={() => toggleObjectType(obj.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedObjectTypes.includes(obj.id)
                      ? 'bg-violet-50 text-violet-700 border border-violet-200'
                      : 'text-zinc-600 hover:bg-zinc-50 border border-transparent'
                  }`}
                >
                  {selectedObjectTypes.includes(obj.id) ? (
                    <CheckSquare className="w-4 h-4 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 shrink-0" />
                  )}
                  {obj.label}
                </button>
              ))}
            </div>
          </div>

          {/* Field palette */}
          <div className="flex-1 overflow-y-auto">
            {paletteObjects.length === 0 ? (
              <div className="px-4 py-6 text-xs text-zinc-400 text-center">
                Select an object above to see its fields
              </div>
            ) : (
              <>
                {/* Object tabs */}
                {paletteObjects.length > 1 && (
                  <div className="flex border-b border-zinc-100 px-2 pt-2 gap-1">
                    {paletteObjects.map(obj => (
                      <button
                        key={obj.id}
                        onClick={() => setActiveObjectTab(obj.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
                          activeTabId === obj.id
                            ? 'bg-white border border-b-white border-zinc-200 text-zinc-900 -mb-px'
                            : 'text-zinc-500 hover:text-zinc-800'
                        }`}
                      >
                        {obj.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Field chips */}
                <div className="p-3 flex flex-col gap-1.5">
                  {activeObject?.fields.map(field => (
                    <div
                      key={`${activeObject.id}:${field.key}`}
                      draggable
                      onDragStart={(e) => {
                        const payload: PalettePayload = {
                          kind: 'palette',
                          fieldKey: field.key,
                          objectType: activeObject.id,
                          label: field.label,
                          fieldType: field.fieldType,
                        }
                        e.dataTransfer.setData('field-designer', JSON.stringify(payload))
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200 cursor-grab hover:bg-zinc-100 hover:border-zinc-300 transition-all select-none active:cursor-grabbing"
                    >
                      <GripVertical className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                      <span className="flex-1 text-sm font-medium text-zinc-800 truncate">{field.label}</span>
                      <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${fieldTypeBadge(field.fieldType)}`}>
                        <FieldTypeIcon type={field.fieldType} />
                        {field.fieldType}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ---- Right Canvas Panel ---- */}
        <div className="flex-1 overflow-y-auto bg-zinc-50 p-6">
          {sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <ClipboardList className="w-10 h-10 text-zinc-300 mb-3" />
              <p className="text-zinc-500 font-medium">Your form is empty</p>
              <p className="text-zinc-400 text-sm mt-1">Click &ldquo;Add Section&rdquo; to start building your form</p>
              <button
                onClick={addSection}
                className="mt-4 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Section
              </button>
            </div>
          ) : (
            <>
              <div className="max-w-3xl mx-auto">
                {sections.map(section => (
                  <FormSectionComponent
                    key={section.id}
                    section={section}
                    onDrop={handleDrop}
                    onRemoveField={removeField}
                    onFieldChange={updateField}
                    onDeleteRow={deleteRow}
                    onChangeColumns={changeRowColumns}
                    onAddRow={addRow}
                    onDeleteSection={deleteSection}
                    onLabelChange={updateSectionLabel}
                  />
                ))}

                <button
                  onClick={addSection}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-500 hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50 transition-all w-full justify-center"
                >
                  <Plus className="w-4 h-4" />
                  Add Section
                </button>
              </div>
            </>
          )}
        </div>
      </div>}
    </div>
  )
}
