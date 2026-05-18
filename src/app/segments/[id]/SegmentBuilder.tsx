'use client'

import { useState, useMemo, useTransition, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  Plus, Trash2, Save, MapPin, Loader2, ChevronRight,
  Users, Building2, TrendingUp, ArrowLeft, UserCircle, X, Play,
  Zap, Lock, RefreshCw,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import {
  OP_LABELS, applyFilters,
  type ObjectType, type FlatRecord, type SegmentFilter, type FilterOperator, type FieldMeta,
} from '@/lib/filters'
import { saveSegmentFilters, deleteSegment, geocodeAddress, assignSegmentToUser, removeSegmentAssignment, assignSegmentToWorkflow, removeSegmentWorkflowLink, executeSegmentWorkflow, setSegmentListType, refreshStaticSegment } from '@/app/actions'

type Assignment = { id: string; userId: string; user: { id: string; name: string; color: string } }

type WorkflowLink = { id: string; sequenceId: string; assignedUserId: string | null; sequence: { id: string; name: string } }

type Props = {
  segment: {
    id: string
    name: string
    description: string | null
    filtersJson: string
    objectType: string
    listType: 'dynamic' | 'static'
    memberIds: string
    lastEvaluatedAt: string | null
  }
  objectType: ObjectType
  records: FlatRecord[]
  sequences: { id: string; name: string }[]
  baseFields: FieldMeta[]   // built-in fields with live labels from DB
  extraFields: FieldMeta[]  // custom fields
  users: { id: string; name: string; color: string }[]
  assignments: Assignment[]
  workflowLinks: WorkflowLink[]
  allSequences: { id: string; name: string }[]
}

const OBJECT_CONFIG: Record<ObjectType, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  contact: { label: 'Contacts', Icon: Users,       color: 'text-violet-600', bg: 'bg-violet-100' },
  company: { label: 'Companies', Icon: Building2,  color: 'text-blue-600',   bg: 'bg-blue-100'   },
  deal:    { label: 'Deals',     Icon: TrendingUp,  color: 'text-emerald-600', bg: 'bg-emerald-100' },
}

// ---- GeoFilterRow ----
function GeoFilterRow({ filter, onUpdate }: { filter: SegmentFilter; onUpdate: (patch: Partial<SegmentFilter>) => void }) {
  const [address, setAddress] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function doGeocode() {
    if (!address.trim()) return
    setGeocoding(true)
    setError('')
    startTransition(async () => {
      const result = await geocodeAddress(address)
      setGeocoding(false)
      if (!result) { setError('Address not found. Try a more specific location.'); return }
      onUpdate({ geoLat: result.lat, geoLng: result.lng, geoLabel: result.label })
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={filter.operator}
          onChange={e => onUpdate({ operator: e.target.value as FilterOperator })}
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
        >
          <option value="within_miles">Within (miles)</option>
          <option value="within_km">Within (km)</option>
        </select>
        <input
          type="number" min="0" step="1"
          value={filter.value}
          onChange={e => onUpdate({ value: e.target.value })}
          placeholder="25"
          className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <span className="text-sm text-zinc-500">{filter.operator === 'within_km' ? 'km' : 'mi'} of</span>
      </div>
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <input
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doGeocode()}
            placeholder="Enter address, city, or zip code…"
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          {filter.geoLabel && (
            <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" /><span className="truncate">{filter.geoLabel}</span>
            </p>
          )}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        <button
          onClick={doGeocode}
          disabled={geocoding || !address.trim() || isPending}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors shrink-0"
        >
          {geocoding || isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
          Locate
        </button>
      </div>
    </div>
  )
}

// ---- FilterRow ----
function FilterRow({
  filter, fields, groups, sequences, onUpdate, onRemove,
}: {
  filter: SegmentFilter
  fields: FieldMeta[]
  groups: string[]
  sequences: { id: string; name: string }[]
  onUpdate: (patch: Partial<SegmentFilter>) => void
  onRemove: () => void
}) {
  const meta = fields.find(f => f.key === filter.field)
  const noValueOps: FilterOperator[] = ['is_set', 'is_not_set']
  const hideValue = noValueOps.includes(filter.operator)

  return (
    <div className="flex items-start gap-2 p-3 bg-white rounded-xl border border-zinc-200 group">
      <select
        value={filter.field}
        onChange={e => {
          const newField = e.target.value
          const newMeta = fields.find(f => f.key === newField)
          onUpdate({ field: newField, operator: newMeta?.operators[0] ?? 'contains', value: '', geoLat: undefined, geoLng: undefined, geoLabel: undefined })
        }}
        className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white min-w-0"
      >
        {groups.map(group => (
          <optgroup key={group} label={group}>
            {fields.filter(f => f.group === group).map(f => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="flex-1 min-w-0">
        {meta?.valueType === 'geo' ? (
          <GeoFilterRow filter={filter} onUpdate={onUpdate} />
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={filter.operator}
              onChange={e => onUpdate({ operator: e.target.value as FilterOperator })}
              className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white shrink-0"
            >
              {(meta?.operators ?? ['equals']).map(op => (
                <option key={op} value={op}>{OP_LABELS[op]}</option>
              ))}
            </select>

            {!hideValue && (
              <>
                {(meta?.valueType === 'boolean' || meta?.valueType === 'select') && meta.options ? (
                  <select
                    value={filter.value}
                    onChange={e => onUpdate({ value: e.target.value })}
                    className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  >
                    <option value="">— select —</option>
                    {meta.valueType === 'boolean'
                      ? [<option key="true" value="true">Yes</option>, <option key="false" value="false">No</option>]
                      : meta.options.map(o => <option key={o} value={o}>{o}</option>)
                    }
                  </select>
                ) : meta?.key === 'sequenceId' ? (
                  <select
                    value={filter.value}
                    onChange={e => onUpdate({ value: e.target.value })}
                    className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  >
                    <option value="">— select sequence —</option>
                    {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : meta?.valueType === 'number' ? (
                  <input
                    type="number"
                    value={filter.value}
                    onChange={e => onUpdate({ value: e.target.value })}
                    className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                ) : (
                  <input
                    type="text"
                    value={filter.value}
                    onChange={e => onUpdate({ value: e.target.value })}
                    placeholder="value…"
                    className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      <button onClick={onRemove} className="text-zinc-300 hover:text-red-500 transition-colors mt-1.5 shrink-0">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// ---- RecordPreviewRow ----
function RecordPreviewRow({
  record, objectType, checked, onToggle,
}: {
  record: FlatRecord; objectType: ObjectType; checked: boolean; onToggle: () => void
}) {
  const cfg = OBJECT_CONFIG[objectType]

  let meta = ''
  if (objectType === 'contact') meta = String(record.leadScore ?? 0) + ' score'
  else if (objectType === 'company') meta = String(record.contactCount ?? 0) + ' contacts'
  else if (objectType === 'deal') meta = '$' + Number(record.value ?? 0).toLocaleString()

  return (
    <div className={`flex items-center gap-2 px-4 py-3 hover:bg-white transition-colors group ${checked ? 'bg-violet-50' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
        className="shrink-0 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
      />
      <button
        onClick={() => {
          const w = 1100, h = 750
          const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2)
          const top  = Math.max(0, window.screenY + (window.outerHeight - h) / 2)
          window.open(record._href, `record_${record._id}`, `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`)
        }}
        className="flex items-center gap-3 min-w-0 flex-1 text-left"
      >
        <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center text-xs font-bold ${cfg.color} shrink-0`}>
          {record._initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900 truncate group-hover:underline">{record._displayName}</p>
          <p className="text-xs text-zinc-400 truncate">{record._subtext}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs font-semibold text-zinc-500">{meta}</span>
          <ChevronRight className="w-3 h-3 text-zinc-300 group-hover:text-zinc-500" />
        </div>
      </button>
    </div>
  )
}

// ---- AssignedUsersPanel ----
function AssignedUsersPanel({
  segmentId, users, assignments,
}: {
  segmentId: string
  users: { id: string; name: string; color: string }[]
  assignments: Assignment[]
}) {
  const [localAssignments, setLocalAssignments] = useState(assignments)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isPending, startTransition] = useTransition()

  const unassigned = users.filter(u => !localAssignments.some(a => a.userId === u.id))

  function assign() {
    if (!selectedUserId) return
    const user = users.find(u => u.id === selectedUserId)!
    startTransition(async () => {
      await assignSegmentToUser(segmentId, selectedUserId)
      setLocalAssignments(prev => [...prev, { id: 'optimistic', userId: user.id, user }])
      setSelectedUserId('')
    })
  }

  function remove(a: Assignment) {
    setLocalAssignments(prev => prev.filter(x => x.id !== a.id))
    startTransition(async () => { await removeSegmentAssignment(a.id, segmentId) })
  }

  const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="border-t border-zinc-200 p-4 bg-white">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <UserCircle className="w-3.5 h-3.5" /> Assigned Users
      </h3>
      {localAssignments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {localAssignments.map(a => (
            <div key={a.id} className="flex items-center gap-1.5 bg-zinc-100 rounded-full pl-1 pr-2 py-0.5 text-xs font-medium text-zinc-700">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: a.user.color }}>
                {initials(a.user.name)}
              </div>
              {a.user.name}
              <button onClick={() => remove(a)} className="text-zinc-400 hover:text-red-500 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {unassigned.length > 0 && (
        <div className="flex gap-2">
          <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="">Add user…</option>
            {unassigned.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button onClick={assign} disabled={!selectedUserId || isPending}
            className="rounded-lg bg-violet-600 text-white px-2.5 py-1.5 text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
      {unassigned.length === 0 && localAssignments.length === 0 && (
        <p className="text-xs text-zinc-400">No users yet. <a href="/users" className="text-violet-600 hover:underline">Add users</a> first.</p>
      )}
    </div>
  )
}

// ---- WorkflowAssignPanel ----
function WorkflowAssignPanel({
  segmentId, sequences, users, initialLinks,
}: {
  segmentId: string
  sequences: { id: string; name: string }[]
  users: { id: string; name: string; color: string }[]
  initialLinks: WorkflowLink[]
}) {
  const [links, setLinks] = useState(initialLinks)
  const [selectedSeqId, setSelectedSeqId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isPending, startTransition] = useTransition()
  const [runResult, setRunResult] = useState<{ enrolled: number; total: number } | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  const unlinkedSeqs = sequences.filter(s => !links.some(l => l.sequenceId === s.id))

  function assign() {
    if (!selectedSeqId) return
    const seq = sequences.find(s => s.id === selectedSeqId)!
    startTransition(async () => {
      const link = await assignSegmentToWorkflow(segmentId, selectedSeqId, selectedUserId || null)
      setLinks(prev => [...prev, { id: link.id, sequenceId: seq.id, assignedUserId: selectedUserId || null, sequence: seq }])
      setSelectedSeqId('')
      setSelectedUserId('')
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeSegmentWorkflowLink(id)
      setLinks(prev => prev.filter(l => l.id !== id))
    })
  }

  function run(linkId: string) {
    setRunningId(linkId)
    setRunResult(null)
    startTransition(async () => {
      const result = await executeSegmentWorkflow(linkId)
      setRunResult(result)
      setRunningId(null)
    })
  }

  return (
    <div className="border-t border-zinc-200 px-4 py-4 bg-white">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Workflow Enrollment</p>

      {/* Existing links */}
      {links.map(link => {
        const assignedUser = users.find(u => u.id === link.assignedUserId)
        return (
          <div key={link.id} className="mb-3 rounded-xl border border-zinc-200 p-3 bg-zinc-50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-zinc-900">{link.sequence.name}</p>
                {assignedUser && (
                  <p className="text-xs text-zinc-400">Assigned to {assignedUser.name}</p>
                )}
              </div>
              <button onClick={() => remove(link.id)} className="text-zinc-300 hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {runResult && runningId === null && (
              <p className="text-xs text-green-600 mb-2">&#10003; Enrolled {runResult.enrolled} of {runResult.total} contacts</p>
            )}
            <button
              onClick={() => run(link.id)}
              disabled={isPending && runningId === link.id}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              <Play className="w-3 h-3" />
              {isPending && runningId === link.id ? 'Running…' : 'Run — Enroll All Matching'}
            </button>
          </div>
        )
      })}

      {/* Add new link */}
      {unlinkedSeqs.length > 0 && (
        <div className="space-y-2">
          <select
            value={selectedSeqId}
            onChange={e => setSelectedSeqId(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            <option value="">— Select workflow —</option>
            {unlinkedSeqs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {selectedSeqId && (
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
            >
              <option value="">— Assign to user (optional) —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <button
            onClick={assign}
            disabled={!selectedSeqId || isPending}
            className="w-full rounded-lg border border-violet-300 bg-violet-50 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
          >
            + Link Workflow
          </button>
        </div>
      )}
      {unlinkedSeqs.length === 0 && links.length === 0 && (
        <p className="text-xs text-zinc-300 italic">No workflows available</p>
      )}
    </div>
  )
}

// ---- Main SegmentBuilder ----
export default function SegmentBuilder({ segment, objectType, records, sequences, baseFields, extraFields, users, assignments, workflowLinks, allSequences }: Props) {
  const fields = [...baseFields, ...extraFields]
  const groups = [...new Set(fields.map(f => f.group))]
  const cfg = OBJECT_CONFIG[objectType]

  const [name, setName] = useState(segment.name)
  const [description, setDescription] = useState(segment.description ?? '')
  const [filters, setFilters] = useState<SegmentFilter[]>(() => {
    try { return JSON.parse(segment.filtersJson) } catch { return [] }
  })
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)
  const [listType, setListType] = useState<'dynamic' | 'static'>(segment.listType)
  const [lastEvaluatedAt, setLastEvaluatedAt] = useState<string | null>(segment.lastEvaluatedAt)
  const memberIdSet = useMemo(() => {
    try { return new Set<string>(JSON.parse(segment.memberIds)) } catch { return new Set<string>() }
  }, [segment.memberIds])
  const matching = useMemo(() => {
    if (listType === 'static') return records.filter(r => memberIdSet.has(r._id))
    return applyFilters(records, filters)
  }, [records, filters, listType, memberIdSet])

  const [manualSelected, setManualSelected] = useState<Set<string>>(() => new Set(matching.map(r => r._id)))

  // When filters change, auto-select any newly matched records (preserve explicit deselections)
  useEffect(() => {
    setManualSelected(prev => {
      const next = new Set(prev)
      matching.forEach(r => { if (!next.has(r._id)) next.add(r._id) })
      return next
    })
  }, [matching])

  function addFilter() {
    const firstField = fields[0]
    setFilters(prev => [...prev, {
      id: nanoid(8),
      field: firstField.key,
      operator: firstField.operators[0],
      value: '',
    }])
  }

  const updateFilter = useCallback((id: string, patch: Partial<SegmentFilter>) => {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
    setSaved(false)
  }, [])

  function removeFilter(id: string) {
    setFilters(prev => prev.filter(f => f.id !== id))
    setSaved(false)
  }

  function save() {
    startTransition(async () => {
      await saveSegmentFilters(segment.id, JSON.stringify(filters), name, description || undefined)
      setSaved(true)
    })
  }

  function handleDelete() {
    if (!confirm(`Delete segment "${name}"? This cannot be undone.`)) return
    setDeleting(true)
    startTransition(async () => { await deleteSegment(segment.id) })
  }

  function switchListType(next: 'dynamic' | 'static') {
    if (next === listType) return
    startTransition(async () => {
      await setSegmentListType(segment.id, next)
      setListType(next)
      if (next === 'static') setLastEvaluatedAt(new Date().toISOString())
      else setLastEvaluatedAt(null)
    })
  }

  function refreshStatic() {
    startTransition(async () => {
      await refreshStaticSegment(segment.id)
      setLastEvaluatedAt(new Date().toISOString())
    })
  }

  function formatRelative(iso: string | null): string {
    if (!iso) return 'never'
    const then = new Date(iso).getTime()
    const diff = Date.now() - then
    const s = Math.floor(diff / 1000)
    if (s < 60) return `${s}s ago`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    return `${d}d ago`
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 bg-white flex items-center gap-4 shrink-0">
        <Link href="/segments" className="text-zinc-400 hover:text-zinc-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className={`w-7 h-7 rounded-md ${cfg.bg} flex items-center justify-center shrink-0`}>
          <cfg.Icon className={`w-4 h-4 ${cfg.color}`} />
        </div>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <input
            value={name}
            onChange={e => { setName(e.target.value); setSaved(false) }}
            className="text-lg font-bold text-zinc-900 bg-transparent border-b border-transparent focus:border-zinc-300 focus:outline-none px-0 py-0.5 min-w-0 flex-1"
          />
          <input
            value={description}
            onChange={e => { setDescription(e.target.value); setSaved(false) }}
            placeholder="Description…"
            className="text-sm text-zinc-500 bg-transparent border-b border-transparent focus:border-zinc-300 focus:outline-none px-0 py-0.5 flex-1 hidden sm:block"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* List type pill toggle */}
          <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 p-0.5 text-xs">
            <button
              onClick={() => switchListType('dynamic')}
              disabled={isPending}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors ${
                listType === 'dynamic'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
              title="Dynamic — auto-updates"
            >
              <Zap className="w-3 h-3" />
              Dynamic
            </button>
            <button
              onClick={() => switchListType('static')}
              disabled={isPending}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors ${
                listType === 'static'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
              title="Static — frozen snapshot"
            >
              <Lock className="w-3 h-3" />
              Static
            </button>
          </div>

          {listType === 'dynamic' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Live
            </span>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span title={lastEvaluatedAt ?? 'never'}>
                Snapshot: {formatRelative(lastEvaluatedAt)}
              </span>
              <button
                onClick={refreshStatic}
                disabled={isPending}
                className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors flex items-center gap-1"
                title="Refresh static snapshot"
              >
                <RefreshCw className={`w-3 h-3 ${isPending ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          )}

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-zinc-400 hover:text-red-500 transition-colors p-2"
            title="Delete segment"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={save}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Filter Builder */}
        <div className="flex-1 overflow-y-auto p-6 min-w-0">
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-zinc-900">Filters</h2>
                <p className="text-xs text-zinc-400 mt-0.5">All filters are combined with AND logic</p>
              </div>
              <button
                onClick={addFilter}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Filter
              </button>
            </div>

            {filters.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-zinc-200 p-12 text-center">
                <p className="text-zinc-400 text-sm mb-3">No filters added — all {cfg.label.toLowerCase()} will match</p>
                <button
                  onClick={addFilter}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add your first filter
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filters.map((f, i) => (
                  <div key={f.id} className="relative">
                    {i > 0 && (
                      <div className="flex items-center gap-2 my-1 px-1">
                        <div className="h-px flex-1 bg-zinc-100" />
                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">AND</span>
                        <div className="h-px flex-1 bg-zinc-100" />
                      </div>
                    )}
                    <FilterRow
                      filter={f}
                      fields={fields}
                      groups={groups}
                      sequences={sequences}
                      onUpdate={patch => updateFilter(f.id, patch)}
                      onRemove={() => removeFilter(f.id)}
                    />
                  </div>
                ))}
                <button
                  onClick={addFilter}
                  className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm text-zinc-500 hover:border-violet-400 hover:text-violet-600 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Filter
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Matching Records Preview */}
        <div className="w-80 shrink-0 border-l border-zinc-200 bg-zinc-50 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-zinc-200 bg-white">
            <div className="flex items-center gap-2">
              <cfg.Icon className={`w-4 h-4 ${cfg.color}`} />
              <span className="font-semibold text-sm text-zinc-900">
                {matching.length} / {records.length} {cfg.label.toLowerCase()}
              </span>
              {manualSelected.size > 0 && (
                <span className="ml-auto text-xs font-medium text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                  {manualSelected.size} selected
                </span>
              )}
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-300"
                style={{ width: records.length ? `${(matching.length / records.length) * 100}%` : '0%' }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
            {matching.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-400">
                No {cfg.label.toLowerCase()} match these filters
              </div>
            ) : (
              matching.map(r => (
                <RecordPreviewRow
                  key={r._id}
                  record={r}
                  objectType={objectType}
                  checked={manualSelected.has(r._id)}
                  onToggle={() => setManualSelected(prev => {
                    const next = new Set(prev)
                    next.has(r._id) ? next.delete(r._id) : next.add(r._id)
                    return next
                  })}
                />
              ))
            )}
          </div>
          <AssignedUsersPanel segmentId={segment.id} users={users} assignments={assignments} />
          <WorkflowAssignPanel
            segmentId={segment.id}
            sequences={allSequences}
            users={users}
            initialLinks={workflowLinks}
          />
        </div>
      </div>
    </div>
  )
}
