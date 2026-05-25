'use client'

import { useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { nanoid } from 'nanoid'
import {
  ArrowLeft, Plus, Trash2, GripVertical, Save, CheckCircle2,
  BarChart2, ChevronDown, ChevronRight, X, Eye, Settings2,
  AlignLeft, Hash, Calendar, Mail, Phone, Globe, List, ToggleLeft,
  Layers, Table,
} from 'lucide-react'
import { saveReport } from '@/app/actions'
import type { AvailableReportObject, ReportColumn, ReportSection, ReportConfig } from '@/lib/reportTypes'
import { BUILT_IN_RELATIONSHIPS } from '@/lib/reportTypes'

// ---- Field type icon ----

function FieldTypeIcon({ type }: { type: string }) {
  const cls = 'w-3 h-3'
  switch (type) {
    case 'number':  return <Hash className={cls} />
    case 'date':    return <Calendar className={cls} />
    case 'email':   return <Mail className={cls} />
    case 'phone':   return <Phone className={cls} />
    case 'url':     return <Globe className={cls} />
    case 'select':  return <List className={cls} />
    case 'boolean': return <ToggleLeft className={cls} />
    default:        return <AlignLeft className={cls} />
  }
}

// ---- Props ----

type Props = {
  report: { id: string; name: string; description: string; configJson: string }
  availableObjects: AvailableReportObject[]
}

// ---- Main component ----

export default function ReportDesigner({ report, availableObjects }: Props) {
  const [name, setName] = useState(report.name)
  const [description, setDescription] = useState(report.description)
  const [tab, setTab] = useState<'design' | 'preview'>('design')

  function parseConfig(json: string): ReportConfig {
    try {
      const parsed = JSON.parse(json)
      return { sections: Array.isArray(parsed?.sections) ? parsed.sections : [] }
    } catch {
      return { sections: [] }
    }
  }

  const [config, setConfig] = useState<ReportConfig>(() => parseConfig(report.configJson))
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      await saveReport(report.id, {
        name,
        description,
        configJson: JSON.stringify(config),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  // ---- Section helpers ----

  function addSection(objectType: string, label: string, parentObjectType?: string, parentLinkField?: string) {
    const obj = availableObjects.find(o => o.id === objectType)
    const section: ReportSection = {
      id: nanoid(8),
      label: label || (obj?.label ?? objectType),
      objectType,
      columns: [],
      ...(parentObjectType ? { parentObjectType, parentLinkField } : {}),
    }
    setConfig(c => ({ ...c, sections: [...c.sections, section] }))
  }

  function removeSection(sectionId: string) {
    setConfig(c => ({ ...c, sections: c.sections.filter(s => s.id !== sectionId) }))
  }

  function updateSection(sectionId: string, patch: Partial<ReportSection>) {
    setConfig(c => ({
      ...c,
      sections: c.sections.map(s => s.id === sectionId ? { ...s, ...patch } : s),
    }))
  }

  function addColumn(sectionId: string, fieldKey: string, label: string) {
    setConfig(c => ({
      ...c,
      sections: c.sections.map(s => {
        if (s.id !== sectionId) return s
        if (s.columns.some(col => col.fieldKey === fieldKey)) return s
        return { ...s, columns: [...s.columns, { id: nanoid(6), fieldKey, label }] }
      }),
    }))
  }

  function removeColumn(sectionId: string, colId: string) {
    setConfig(c => ({
      ...c,
      sections: c.sections.map(s =>
        s.id === sectionId
          ? { ...s, columns: s.columns.filter(col => col.id !== colId) }
          : s,
      ),
    }))
  }

  function moveColumn(sectionId: string, from: number, to: number) {
    setConfig(c => ({
      ...c,
      sections: c.sections.map(s => {
        if (s.id !== sectionId) return s
        const cols = [...s.columns]
        const [item] = cols.splice(from, 1)
        cols.splice(to, 0, item)
        return { ...s, columns: cols }
      }),
    }))
  }

  const primarySection = config.sections[0]
  const subSections = config.sections.slice(1)

  // ---- Determine available sub-report options ----
  function getAvailableSubReports(): { objectType: string; label: string; linkField: string; objectLabel: string }[] {
    if (!primarySection) return []
    const builtIn = BUILT_IN_RELATIONSHIPS
      .filter(r => r.parentObject === primarySection.objectType)
      .map(r => ({
        objectType: r.childObject,
        label: r.label,
        linkField: r.childLinkField,
        objectLabel: availableObjects.find(o => o.id === r.childObject)?.label ?? r.childObject,
      }))
    return builtIn
  }

  const availableSubReports = getAvailableSubReports()
  const alreadyAdded = new Set(subSections.map(s => s.objectType))

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-50">
      {/* Top bar */}
      <div className="shrink-0 bg-white border-b border-zinc-200 px-4 py-3 flex items-center gap-3">
        <Link href="/reports" className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="text-base font-semibold text-zinc-900 bg-transparent border-none outline-none focus:ring-0 min-w-0 flex-1"
            placeholder="Report name"
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="text-sm text-zinc-400 bg-transparent border-none outline-none focus:ring-0 min-w-0 max-w-xs hidden sm:block"
            placeholder="Description (optional)"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          <button
            onClick={() => setTab('design')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'design' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            <Settings2 className="w-3.5 h-3.5" /> Design
          </button>
          <button
            onClick={() => { setTab('preview'); save() }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'preview' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
        </div>

        <button
          onClick={save}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {saved ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {tab === 'design' ? (
        <DesignTab
          config={config}
          availableObjects={availableObjects}
          availableSubReports={availableSubReports}
          alreadyAdded={alreadyAdded}
          primarySection={primarySection}
          subSections={subSections}
          addSection={addSection}
          removeSection={removeSection}
          updateSection={updateSection}
          addColumn={addColumn}
          removeColumn={removeColumn}
          moveColumn={moveColumn}
        />
      ) : (
        <PreviewTab reportId={report.id} />
      )}
    </div>
  )
}

// ---- Design Tab ----

function DesignTab({
  config, availableObjects, availableSubReports, alreadyAdded,
  primarySection, subSections,
  addSection, removeSection, updateSection, addColumn, removeColumn, moveColumn,
}: {
  config: ReportConfig
  availableObjects: AvailableReportObject[]
  availableSubReports: { objectType: string; label: string; linkField: string; objectLabel: string }[]
  alreadyAdded: Set<string>
  primarySection: ReportSection | undefined
  subSections: ReportSection[]
  addSection: (objectType: string, label: string, parentObjectType?: string, parentLinkField?: string) => void
  removeSection: (id: string) => void
  updateSection: (id: string, patch: Partial<ReportSection>) => void
  addColumn: (sectionId: string, fieldKey: string, label: string) => void
  removeColumn: (sectionId: string, colId: string) => void
  moveColumn: (sectionId: string, from: number, to: number) => void
}) {
  const [leftObjectId, setLeftObjectId] = useState<string | null>(primarySection?.objectType ?? null)

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left: object palette */}
      <div className="w-64 shrink-0 border-r border-zinc-200 bg-white flex flex-col">
        <div className="px-3 py-3 border-b border-zinc-100">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Objects & Fields</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {availableObjects.map(obj => (
            <ObjectPaletteItem
              key={obj.id}
              obj={obj}
              isExpanded={leftObjectId === obj.id}
              onToggle={() => setLeftObjectId(id => id === obj.id ? null : obj.id)}
              sections={config.sections}
              onAddToSection={(sectionId, fieldKey, label) => addColumn(sectionId, fieldKey, label)}
            />
          ))}
        </div>
      </div>

      {/* Center: report builder */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* No primary yet */}
        {!primarySection && (
          <div className="bg-white rounded-xl border-2 border-dashed border-zinc-300 p-8 text-center">
            <Layers className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
            <p className="font-medium text-zinc-600 mb-1">No objects selected</p>
            <p className="text-sm text-zinc-400 mb-4">Choose a primary object to start building your report</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {availableObjects.map(obj => (
                <button
                  key={obj.id}
                  onClick={() => addSection(obj.id, obj.label)}
                  className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-colors"
                >
                  <Table className="w-3.5 h-3.5" />
                  {obj.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Primary section */}
        {primarySection && (
          <SectionEditor
            section={primarySection}
            label="Primary object"
            canDelete={false}
            availableObjects={availableObjects}
            onUpdate={patch => updateSection(primarySection.id, patch)}
            onRemove={() => removeSection(primarySection.id)}
            onRemoveColumn={colId => removeColumn(primarySection.id, colId)}
            onMoveColumn={(from, to) => moveColumn(primarySection.id, from, to)}
          />
        )}

        {/* Sub-report sections */}
        {subSections.map(sub => (
          <SectionEditor
            key={sub.id}
            section={sub}
            label={`Sub-report: 1:N from ${primarySection?.label ?? ''}`}
            canDelete
            availableObjects={availableObjects}
            onUpdate={patch => updateSection(sub.id, patch)}
            onRemove={() => removeSection(sub.id)}
            onRemoveColumn={colId => removeColumn(sub.id, colId)}
            onMoveColumn={(from, to) => moveColumn(sub.id, from, to)}
          />
        ))}

        {/* Add sub-report */}
        {primarySection && availableSubReports.length > 0 && (
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Add Related Object (1:N)</p>
            <div className="flex flex-wrap gap-2">
              {availableSubReports
                .filter(r => !alreadyAdded.has(r.objectType))
                .map(r => (
                  <button
                    key={r.objectType}
                    onClick={() => addSection(r.objectType, r.label, primarySection.objectType, r.linkField)}
                    className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {r.label} ({r.objectLabel})
                  </button>
                ))}
              {availableSubReports.every(r => alreadyAdded.has(r.objectType)) && (
                <p className="text-sm text-zinc-400">All related objects have been added.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Object palette item ----

function ObjectPaletteItem({
  obj, isExpanded, onToggle, sections, onAddToSection,
}: {
  obj: AvailableReportObject
  isExpanded: boolean
  onToggle: () => void
  sections: ReportSection[]
  onAddToSection: (sectionId: string, fieldKey: string, label: string) => void
}) {
  const relevantSections = sections.filter(s => s.objectType === obj.id)

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
      >
        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
        <Table className="w-3.5 h-3.5 text-zinc-400" />
        <span className="flex-1 text-left">{obj.label}</span>
      </button>
      {isExpanded && (
        <div className="ml-6 mt-1 space-y-0.5">
          {obj.fields.map(field => (
            <div key={field.key} className="group flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-zinc-50">
              <FieldTypeIcon type={field.fieldType} />
              <span className="text-xs text-zinc-600 flex-1">{field.label}</span>
              {relevantSections.length > 0 && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {relevantSections.map(sec => (
                    <button
                      key={sec.id}
                      onClick={() => onAddToSection(sec.id, field.key, field.label)}
                      title={`Add to "${sec.label}"`}
                      className="px-1.5 py-0.5 rounded text-xs bg-zinc-900 text-white hover:bg-zinc-700"
                    >
                      +
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Section editor ----

function SectionEditor({
  section, label, canDelete, availableObjects, onUpdate, onRemove, onRemoveColumn, onMoveColumn,
}: {
  section: ReportSection
  label: string
  canDelete: boolean
  availableObjects: AvailableReportObject[]
  onUpdate: (patch: Partial<ReportSection>) => void
  onRemove: () => void
  onRemoveColumn: (colId: string) => void
  onMoveColumn: (from: number, to: number) => void
}) {
  const obj = availableObjects.find(o => o.id === section.objectType)

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50 border-b border-zinc-200">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Layers className="w-4 h-4 text-zinc-400 shrink-0" />
          <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold shrink-0">{label}</span>
          <input
            value={section.label}
            onChange={e => onUpdate({ label: e.target.value })}
            className="flex-1 text-sm font-semibold text-zinc-900 bg-transparent border-none outline-none focus:ring-0 min-w-0"
            placeholder="Section label"
          />
          <span className="text-xs text-zinc-400 shrink-0">
            {obj?.label ?? section.objectType} · {section.columns.length} column{section.columns.length !== 1 ? 's' : ''}
          </span>
        </div>
        {canDelete && (
          <button onClick={onRemove} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Column list */}
      <div className="p-4">
        {section.columns.length === 0 ? (
          <div className="text-center py-6 rounded-lg border-2 border-dashed border-zinc-200">
            <p className="text-xs text-zinc-400">No columns yet. Click a field in the left panel to add it here.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {section.columns.map((col, idx) => (
              <div key={col.id} className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors">
                <GripVertical className="w-3.5 h-3.5 text-zinc-300 cursor-grab" />
                <input
                  value={col.label}
                  onChange={e => onUpdate({
                    columns: section.columns.map(c => c.id === col.id ? { ...c, label: e.target.value } : c),
                  })}
                  className="flex-1 text-sm text-zinc-700 bg-transparent border-none outline-none focus:ring-0"
                />
                <span className="text-xs text-zinc-400 font-mono">{col.fieldKey}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx > 0 && (
                    <button onClick={() => onMoveColumn(idx, idx - 1)} className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200">
                      <ChevronDown className="w-3 h-3 rotate-180" />
                    </button>
                  )}
                  {idx < section.columns.length - 1 && (
                    <button onClick={() => onMoveColumn(idx, idx + 1)} className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  )}
                  <button onClick={() => onRemoveColumn(col.id)} className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick-add from object fields */}
        {obj && (
          <AddFieldDropdown
            obj={obj}
            existingKeys={new Set(section.columns.map(c => c.fieldKey))}
            onAdd={(key, label) => onUpdate({
              columns: [...section.columns, { id: nanoid(6), fieldKey: key, label }],
            })}
          />
        )}
      </div>
    </div>
  )
}

// ---- Add field dropdown ----

function AddFieldDropdown({
  obj, existingKeys, onAdd,
}: {
  obj: AvailableReportObject
  existingKeys: Set<string>
  onAdd: (key: string, label: string) => void
}) {
  const [open, setOpen] = useState(false)
  const remaining = obj.fields.filter(f => !existingKeys.has(f.key))

  if (remaining.length === 0) return null

  return (
    <div className="relative mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 px-2 py-1.5 rounded-lg transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add column
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-white rounded-xl border border-zinc-200 shadow-lg py-1 max-h-56 overflow-y-auto">
          {remaining.map(field => (
            <button
              key={field.key}
              onClick={() => { onAdd(field.key, field.label); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 text-left"
            >
              <FieldTypeIcon type={field.fieldType} />
              {field.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Preview Tab ----
// Loads rendered data server-side via a dedicated page endpoint

function PreviewTab({ reportId }: { reportId: string }) {
  return (
    <div className="flex-1 min-h-0">
      <iframe
        src={`/reports/${reportId}/preview`}
        className="w-full h-full border-none"
        title="Report Preview"
      />
    </div>
  )
}
