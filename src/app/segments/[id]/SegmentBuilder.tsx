'use client'

import { useState, useMemo, useTransition, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  Plus, Trash2, Save, MapPin, Loader2, Users, ArrowLeft, UserCircle, X, Play,
  Zap, Lock, RefreshCw, ChevronRight,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import {
  OP_LABELS,
  applyFiltersForObjectTypes,
  memberKey,
  type FlatRecord,
  type SegmentFilter,
  type FilterOperator,
  type FieldMeta,
} from '@/lib/filters'
import { isStandardObjectType, resolveIcon, type ObjectTypeMeta } from '@/lib/segmentObjects'
import { saveSegmentFilters, deleteSegment, geocodeAddress, assignSegmentToUser, removeSegmentAssignment, assignSegmentToWorkflow, removeSegmentWorkflowLink, setSegmentListType, refreshStaticSegment } from '@/app/actions'
import ExecuteWorkflowModal from '@/components/ExecuteWorkflowModal'
import SegmentMap, { type SegmentMapPoint } from '@/components/SegmentMap'

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
  objectTypes: string[]
  recordsByType: Record<string, FlatRecord[]>
  fieldsByType: Record<string, FieldMeta[]>
  objectTypeMeta: Record<string, ObjectTypeMeta>
  sequences: { id: string; name: string }[]
  users: { id: string; name: string; color: string }[]
  assignments: Assignment[]
  workflowLinks: WorkflowLink[]
  allSequences: { id: string; name: string }[]
}

// ---- GeoFilterRow ----
function GeoFilterRow({ filter, onUpdate }: { filter: SegmentFilter; onUpdate: (patch: Partial<SegmentFilter>) => void }) {
  const [address, setAddress] = useState('')
  const [showMapPicker, setShowMapPicker] = useState(false)
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

  function setCenterFromMap(lat: number, lng: number) {
    onUpdate({
      geoLat: lat,
      geoLng: lng,
      geoLabel: `Dropped pin (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
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
        <button
          onClick={() => setShowMapPicker(v => !v)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shrink-0"
        >
          {showMapPicker ? 'Hide map' : 'Pick on map'}
        </button>
      </div>
      {showMapPicker && (
        <SegmentMap
          points={[]}
          center={filter.geoLat != null && filter.geoLng != null ? { lat: filter.geoLat, lng: filter.geoLng } : null}
          radiusMiles={filter.operator === 'within_km' ? (parseFloat(filter.value) || 0) / 1.60934 : parseFloat(filter.value) || 0}
          onPickCenter={setCenterFromMap}
          className="h-56"
        />
      )}
    </div>
  )
}

// ---- FilterRow ----
function FilterRow({
  filter, objectTypes, fieldsByType, objectTypeMeta, sequences, onUpdate, onRemove,
}: {
  filter: SegmentFilter
  objectTypes: string[]
  fieldsByType: Record<string, FieldMeta[]>
  objectTypeMeta: Record<string, ObjectTypeMeta>
  sequences: { id: string; name: string }[]
  onUpdate: (patch: Partial<SegmentFilter>) => void
  onRemove: () => void
}) {
  const filterType = filter.objectType ?? objectTypes[0]
  const fields = fieldsByType[filterType] ?? []
  const groups = [...new Set(fields.map(f => f.group))]
  const meta = fields.find(f => f.key === filter.field)
  const noValueOps: FilterOperator[] = ['is_set', 'is_not_set']
  const hideValue = noValueOps.includes(filter.operator)

  return (
    <div className="flex items-start gap-2 p-3 bg-white rounded-xl border border-zinc-200 group flex-wrap">
      {objectTypes.length > 1 && (
        <select
          value={filterType}
          onChange={e => {
            const newType = e.target.value
            const newFields = fieldsByType[newType] ?? []
            const first = newFields[0]
            onUpdate({
              objectType: newType,
              field: first?.key ?? '',
              operator: first?.operators[0] ?? 'contains',
              value: '',
              geoLat: undefined,
              geoLng: undefined,
              geoLabel: undefined,
            })
          }}
          className="rounded-lg border border-violet-300 px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 bg-violet-50 text-violet-800 shrink-0"
        >
          {objectTypes.map(t => (
            <option key={t} value={t}>{objectTypeMeta[t]?.label ?? t}</option>
          ))}
        </select>
      )}
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
  record, objectTypeMeta, checked, onToggle,
}: {
  record: FlatRecord
  objectTypeMeta: Record<string, ObjectTypeMeta>
  checked: boolean
  onToggle: () => void
}) {
  const objectType = record._objectType ?? 'contact'
  const cfg = objectTypeMeta[objectType] ?? {
    label: objectType,
    Icon: Users,
    color: 'text-zinc-600',
    bg: 'bg-zinc-100',
    description: '',
  }

  let meta = record._subtext as string
  if (isStandardObjectType(objectType)) {
    if (objectType === 'contact') meta = String(record.leadScore ?? 0) + ' score'
    else if (objectType === 'company') meta = String(record.contactCount ?? 0) + ' contacts'
    else if (objectType === 'opportunity') meta = '$' + Number(record.value ?? 0).toLocaleString()
  }

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
  const [executeLinkId, setExecuteLinkId] = useState<string | null>(null)
  const [lastRunByLink, setLastRunByLink] = useState<Record<string, string>>({})

  const unlinkedSeqs = sequences.filter(s => !links.some(l => l.sequenceId === s.id))

  function assign() {
    if (!selectedSeqId) return
    const seq = sequences.find(s => s.id === selectedSeqId)!
    startTransition(async () => {
      const link = await assignSegmentToWorkflow(segmentId, selectedSeqId, selectedUserId || null)
      setLinks(prev => [...prev, { id: link.id, sequenceId: seq.id, assignedUserId: selectedUserId || null, sequence: seq }])
      setSelectedSeqId('')
      setSelectedUserId('')
      setExecuteLinkId(link.id)
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeSegmentWorkflowLink(id)
      setLinks(prev => prev.filter(l => l.id !== id))
    })
  }

  function openRunModal(linkId: string) {
    setExecuteLinkId(linkId)
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
            {lastRunByLink[link.id] && (
              <p className="text-xs text-green-600 mb-2">{lastRunByLink[link.id]}</p>
            )}
            <button
              onClick={() => openRunModal(link.id)}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 transition-colors"
            >
              <Play className="w-3 h-3" />
              Run workflow
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
            Assign workflow
          </button>
        </div>
      )}
      {unlinkedSeqs.length === 0 && links.length === 0 && (
        <p className="text-xs text-zinc-300 italic">No workflows available</p>
      )}

      <ExecuteWorkflowModal
        open={executeLinkId !== null}
        onClose={() => setExecuteLinkId(null)}
        linkId={executeLinkId}
        title="Configure workflow"
        onExecuted={(res, linkId) => {
          setLastRunByLink(prev => ({
            ...prev,
            [linkId]: `✓ Processed ${res.total} record${res.total !== 1 ? 's' : ''}${res.enrolled > 0 ? ` (${res.enrolled} enrolled)` : ''}`,
          }))
        }}
      />
    </div>
  )
}

// ---- Main SegmentBuilder ----
export default function SegmentBuilder({
  segment,
  objectTypes,
  recordsByType,
  fieldsByType,
  objectTypeMeta,
  sequences,
  users,
  assignments,
  workflowLinks,
  allSequences,
}: Props) {
  const [previewMode, setPreviewMode] = useState<'list' | 'map'>('list')
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const multiObject = objectTypes.length > 1
  const primaryType = objectTypes[0]
  const allRecords = useMemo(
    () => objectTypes.flatMap(t => recordsByType[t] ?? []),
    [objectTypes, recordsByType],
  )

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
    if (listType === 'static') {
      return objectTypes.flatMap(type => {
        const records = recordsByType[type] ?? []
        return records
          .filter(r => {
            const key = memberKey(type, r._id, multiObject)
            return memberIdSet.has(key) || memberIdSet.has(r._id)
          })
          .map(r => ({ ...r, _objectType: type }))
      })
    }
    return applyFiltersForObjectTypes(recordsByType, filters, objectTypes)
  }, [objectTypes, recordsByType, filters, listType, memberIdSet, multiObject])

  const [manualSelected, setManualSelected] = useState<Set<string>>(() => new Set(matching.map(r => r._id)))

  const activeGeoFilter = useMemo(
    () => filters.find((f) => f.field === 'geo' && f.geoLat != null && f.geoLng != null),
    [filters],
  )
  const activeRadiusMiles = useMemo(() => {
    if (!activeGeoFilter) return null
    const radius = parseFloat(activeGeoFilter.value)
    if (!radius || Number.isNaN(radius)) return null
    return activeGeoFilter.operator === 'within_km' ? radius / 1.60934 : radius
  }, [activeGeoFilter])
  const mapCenter = activeGeoFilter ? { lat: activeGeoFilter.geoLat as number, lng: activeGeoFilter.geoLng as number } : null

  const mapPoints = useMemo<SegmentMapPoint[]>(() => {
    const colors: Record<string, string> = {
      contact: '#2563eb',
      company: '#16a34a',
      opportunity: '#dc2626',
    }
    return matching
      .map((record) => {
        const lat = typeof record.lat === 'number' ? record.lat : Number(record.lat)
        const lng = typeof record.lng === 'number' ? record.lng : Number(record.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        const type = (record._objectType as string) ?? primaryType
        return {
          id: `${type}:${record._id}`,
          label: String(record._displayName ?? record._id),
          sublabel: `${objectTypeMeta[type]?.label ?? type} • ${record._subtext ?? ''}`,
          lat,
          lng,
          color: colors[type] ?? '#7c3aed',
        } satisfies SegmentMapPoint
      })
      .filter((point): point is SegmentMapPoint => point !== null)
  }, [matching, objectTypeMeta, primaryType])

  // When filters change, auto-select any newly matched records (preserve explicit deselections)
  useEffect(() => {
    setManualSelected(prev => {
      const next = new Set(prev)
      matching.forEach(r => { if (!next.has(r._id)) next.add(r._id) })
      return next
    })
  }, [matching])

  useEffect(() => {
    if (!mapFullscreen) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [mapFullscreen])

  function addFilter(forType?: string) {
    const type = forType ?? primaryType
    const typeFields = fieldsByType[type] ?? []
    const firstField = typeFields[0]
    if (!firstField) return
    setFilters(prev => [...prev, {
      id: nanoid(8),
      objectType: type,
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
      await saveSegmentFilters(
        segment.id,
        JSON.stringify(filters),
        name,
        description || undefined,
        JSON.stringify(objectTypes),
      )
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

        <div className="flex items-center gap-1 shrink-0">
          {objectTypes.map(t => {
            const c = objectTypeMeta[t]
            if (!c) return null
            const Icon = resolveIcon(c.iconName)
            return (
              <div key={t} className={`w-7 h-7 rounded-md ${c.bg} flex items-center justify-center`} title={c.label}>
                <Icon className={`w-4 h-4 ${c.color}`} />
              </div>
            )
          })}
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
              {multiObject ? (
                <div className="flex flex-wrap gap-1.5">
                  {objectTypes.map(t => (
                    <button key={t} type="button" onClick={() => addFilter(t)} className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
                      <Plus className="w-3.5 h-3.5" /> {objectTypeMeta[t]?.label ?? t}
                    </button>
                  ))}
                </div>
              ) : (
                <button type="button" onClick={() => addFilter()} className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
                  <Plus className="w-4 h-4" /> Add Filter
                </button>
              )}
            </div>

            {filters.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-zinc-200 p-12 text-center">
                <p className="text-zinc-400 text-sm mb-3">No filters added — all records from selected object types will match</p>
                <button
                  type="button"
                  onClick={() => addFilter()}
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
                      objectTypes={objectTypes}
                      fieldsByType={fieldsByType}
                      objectTypeMeta={objectTypeMeta}
                      sequences={sequences}
                      onUpdate={patch => updateFilter(f.id, patch)}
                      onRemove={() => removeFilter(f.id)}
                    />
                  </div>
                ))}
                {multiObject ? (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {objectTypes.map(t => (
                      <button key={t} type="button" onClick={() => addFilter(t)} className="flex items-center gap-1.5 rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:border-violet-400 hover:text-violet-600">
                        <Plus className="w-4 h-4" /> {objectTypeMeta[t]?.label ?? t}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button type="button" onClick={() => addFilter()} className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm text-zinc-500 hover:border-violet-400 hover:text-violet-600">
                    <Plus className="w-4 h-4" /> Add Filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Matching Records Preview */}
        <div className="w-80 shrink-0 border-l border-zinc-200 bg-zinc-50 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-zinc-200 bg-white">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-zinc-900">
                {matching.length} / {allRecords.length} records
              </span>
              <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-xs ml-auto">
                <button
                  onClick={() => {
                    setPreviewMode('list')
                    setMapFullscreen(false)
                  }}
                  className={`rounded-md px-2 py-0.5 font-medium ${previewMode === 'list' ? 'bg-white text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                  List
                </button>
                <button
                  onClick={() => {
                    setPreviewMode('map')
                    setMapFullscreen(true)
                  }}
                  className={`rounded-md px-2 py-0.5 font-medium ${previewMode === 'map' ? 'bg-white text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                  Map
                </button>
              </div>
              {manualSelected.size > 0 && (
                <span className="text-xs font-medium text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                  {manualSelected.size} selected
                </span>
              )}
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-300"
                style={{ width: allRecords.length ? `${(matching.length / allRecords.length) * 100}%` : '0%' }}
              />
            </div>
          </div>

          {previewMode === 'list' ? (
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {matching.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-400">
                  No records match these filters
                </div>
              ) : (
                matching.map(r => (
                  <RecordPreviewRow
                    key={`${r._objectType ?? primaryType}:${r._id}`}
                    record={r}
                    objectTypeMeta={objectTypeMeta}
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
          ) : (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {activeGeoFilter ? (
                <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                  <p className="text-xs font-semibold text-violet-800 mb-1">Geo search settings</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={activeGeoFilter.value}
                      onChange={(e) => updateFilter(activeGeoFilter.id, { value: e.target.value })}
                      className="w-24 rounded-lg border border-violet-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <select
                      value={activeGeoFilter.operator}
                      onChange={(e) => updateFilter(activeGeoFilter.id, { operator: e.target.value as FilterOperator })}
                      className="rounded-lg border border-violet-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="within_miles">miles</option>
                      <option value="within_km">km</option>
                    </select>
                    <span className="text-xs text-violet-700 truncate">
                      Center: {activeGeoFilter.geoLabel ?? 'Set in Distance from… filter'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Add a <strong>Distance from…</strong> filter on the left to set radius and center point.
                </div>
              )}

              {mapPoints.length === 0 ? (
                <div className="p-4 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-500">
                  No mappable records in current results. Add lat/lng data (or geocode contacts) to see pins.
                </div>
              ) : (
                <>
                  <SegmentMap
                    points={mapPoints}
                    center={mapCenter}
                    radiusMiles={activeRadiusMiles}
                    className="h-80"
                  />
                  <p className="text-xs text-zinc-500 px-1">
                    Showing {mapPoints.length} mapped records out of {matching.length} matches.
                  </p>
                </>
              )}
            </div>
          )}
          <AssignedUsersPanel segmentId={segment.id} users={users} assignments={assignments} />
          <WorkflowAssignPanel
            segmentId={segment.id}
            sequences={allSequences}
            users={users}
            initialLinks={workflowLinks}
          />
        </div>
      </div>

      {mapFullscreen && (
        <div className="fixed inset-0 z-[100] bg-zinc-950/65 p-4">
          <div className="h-full w-full rounded-2xl border border-zinc-300 bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 bg-white">
              <div className="text-sm font-semibold text-zinc-900">
                Segment Map ({mapPoints.length}/{matching.length} mapped records)
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => {
                    setMapFullscreen(false)
                    setPreviewMode('list')
                  }}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  Back to list
                </button>
                <button
                  onClick={() => setMapFullscreen(false)}
                  className="rounded-lg border border-zinc-300 p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
                  title="Close full-screen map"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-4 py-3 border-b border-zinc-100">
              {activeGeoFilter ? (
                <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                  <p className="text-xs font-semibold text-violet-800 mb-1">Geo search settings</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={activeGeoFilter.value}
                      onChange={(e) => updateFilter(activeGeoFilter.id, { value: e.target.value })}
                      className="w-24 rounded-lg border border-violet-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <select
                      value={activeGeoFilter.operator}
                      onChange={(e) => updateFilter(activeGeoFilter.id, { operator: e.target.value as FilterOperator })}
                      className="rounded-lg border border-violet-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="within_miles">miles</option>
                      <option value="within_km">km</option>
                    </select>
                    <span className="text-xs text-violet-700 truncate">
                      Center: {activeGeoFilter.geoLabel ?? 'Set in Distance from… filter'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Add a <strong>Distance from…</strong> filter on the left to set radius and center point.
                </div>
              )}
            </div>

            <div className="flex-1 p-4 min-h-0">
              {mapPoints.length === 0 ? (
                <div className="h-full rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                  No mappable records in current results. Add lat/lng data (or geocode contacts) to see pins.
                </div>
              ) : (
                <SegmentMap
                  points={mapPoints}
                  center={mapCenter}
                  radiusMiles={activeRadiusMiles}
                  className="h-full"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
