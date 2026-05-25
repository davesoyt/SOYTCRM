'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createObjectRelationship, deleteObjectRelationship, updateObjectRelationship } from '@/app/actions'
import { X, Trash2 } from 'lucide-react'

const CARD_WIDTH = 220
const CARD_HEADER_H = 40
const FIELD_ROW_H = 30

type CRMObject = {
  id: string
  label: string
  fields: { key: string; label: string; fieldType: string }[]
}

type Rel = {
  id: string
  fromObject: string
  fromField: string
  toObject: string
  toField: string
  relType: string
  label: string
}

type CardPos = { x: number; y: number }

type DragCard = {
  cardId: string
  startMouseX: number
  startMouseY: number
  origX: number
  origY: number
}

type DrawingEdge = {
  fromObject: string
  fromField: string
  mouseX: number
  mouseY: number
}

function cardHeight(obj: CRMObject) {
  return CARD_HEADER_H + obj.fields.length * FIELD_ROW_H
}

function rightPort(pos: CardPos, fieldIndex: number) {
  return {
    x: pos.x + CARD_WIDTH,
    y: pos.y + CARD_HEADER_H + fieldIndex * FIELD_ROW_H + FIELD_ROW_H / 2,
  }
}

function leftPort(pos: CardPos, fieldIndex: number) {
  return {
    x: pos.x,
    y: pos.y + CARD_HEADER_H + fieldIndex * FIELD_ROW_H + FIELD_ROW_H / 2,
  }
}

function defaultPositions(objects: CRMObject[]): Record<string, CardPos> {
  const cols = 3
  const hGap = 260
  const vGap = 320
  const positions: Record<string, CardPos> = {}
  objects.forEach((obj, i) => {
    positions[obj.id] = {
      x: 40 + (i % cols) * hGap,
      y: 40 + Math.floor(i / cols) * vGap,
    }
  })
  return positions
}

function loadPositions(objects: CRMObject[]): Record<string, CardPos> {
  if (typeof window === 'undefined') return defaultPositions(objects)
  try {
    const saved = localStorage.getItem('crm_rel_canvas_positions')
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, CardPos>
      const defaults = defaultPositions(objects)
      const merged: Record<string, CardPos> = {}
      for (const obj of objects) {
        merged[obj.id] = parsed[obj.id] ?? defaults[obj.id]
      }
      return merged
    }
  } catch { /* ignore */ }
  return defaultPositions(objects)
}

const REL_TYPES = [
  { value: 'one_to_one', label: 'One-to-One', abbr: '1:1' },
  { value: 'one_to_many', label: 'One-to-Many', abbr: '1:N' },
  { value: 'many_to_many', label: 'Many-to-Many', abbr: 'N:M' },
]

/** For 1:N, fromObject is the "one" side and toObject is the "many" side. */
function relEndsSummary(rel: Rel, objects: CRMObject[]): string {
  const fromLabel = objects.find(o => o.id === rel.fromObject)?.label ?? rel.fromObject
  const toLabel = objects.find(o => o.id === rel.toObject)?.label ?? rel.toObject
  if (rel.relType === 'one_to_many') {
    return `${fromLabel} (1) → ${toLabel} (N)`
  }
  if (rel.relType === 'one_to_one') {
    return `${fromLabel} (1) ↔ ${toLabel} (1)`
  }
  if (rel.relType === 'many_to_many') {
    return `${fromLabel} (N) ↔ ${toLabel} (N)`
  }
  return `${fromLabel} → ${toLabel}`
}

function swapRelEnds(rel: Rel): Rel {
  return {
    ...rel,
    fromObject: rel.toObject,
    fromField: rel.toField,
    toObject: rel.fromObject,
    toField: rel.fromField,
  }
}

export default function RelationshipCanvas({
  objects,
  initialRelationships,
}: {
  objects: CRMObject[]
  initialRelationships: Rel[]
}) {
  const [positions, setPositions] = useState<Record<string, CardPos>>(() => defaultPositions(objects))
  const [relationships, setRelationships] = useState<Rel[]>(initialRelationships)
  const [dragCard, setDragCard] = useState<DragCard | null>(null)
  const [drawingEdge, setDrawingEdge] = useState<DrawingEdge | null>(null)
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null)
  const [editingRel, setEditingRel] = useState<Rel | null>(null)
  const [hoveredPort, setHoveredPort] = useState<{ objId: string; fieldKey: string } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPositions(loadPositions(objects))
  }, [objects])

  const savePositions = useCallback((pos: Record<string, CardPos>) => {
    try {
      localStorage.setItem('crm_rel_canvas_positions', JSON.stringify(pos))
    } catch { /* ignore */ }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const canvasX = e.clientX - rect.left + (canvasRef.current?.scrollLeft ?? 0)
    const canvasY = e.clientY - rect.top + (canvasRef.current?.scrollTop ?? 0)

    if (dragCard) {
      const dx = e.clientX - dragCard.startMouseX
      const dy = e.clientY - dragCard.startMouseY
      setPositions(prev => ({
        ...prev,
        [dragCard.cardId]: {
          x: Math.max(0, dragCard.origX + dx),
          y: Math.max(0, dragCard.origY + dy),
        },
      }))
    }

    if (drawingEdge) {
      setDrawingEdge(prev => prev ? { ...prev, mouseX: canvasX, mouseY: canvasY } : null)
    }
  }, [dragCard, drawingEdge])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragCard) {
      setPositions(prev => {
        savePositions(prev)
        return prev
      })
      setDragCard(null)
    }
    if (drawingEdge) {
      // Check if mouseup is on a port — handled in port mouseup handlers
      setDrawingEdge(null)
    }
  }, [dragCard, drawingEdge, savePositions])

  const handleCardMouseDown = useCallback((e: React.MouseEvent, cardId: string) => {
    const pos = positions[cardId]
    setDragCard({
      cardId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    })
  }, [positions])

  const handlePortMouseDown = useCallback((e: React.MouseEvent, objId: string, fieldKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const canvasX = e.clientX - rect.left + (canvasRef.current?.scrollLeft ?? 0)
    const canvasY = e.clientY - rect.top + (canvasRef.current?.scrollTop ?? 0)
    setDrawingEdge({ fromObject: objId, fromField: fieldKey, mouseX: canvasX, mouseY: canvasY })
  }, [])

  const handlePortMouseUp = useCallback(async (e: React.MouseEvent, objId: string, fieldKey: string) => {
    e.stopPropagation()
    if (!drawingEdge) return
    if (drawingEdge.fromObject === objId && drawingEdge.fromField === fieldKey) {
      setDrawingEdge(null)
      return
    }
    // Create relationship
    const data = {
      fromObject: drawingEdge.fromObject,
      fromField: drawingEdge.fromField,
      toObject: objId,
      toField: fieldKey,
      relType: 'one_to_many',
      label: '',
    }
    setDrawingEdge(null)
    const created = await createObjectRelationship(data)
    setRelationships(prev => [...prev, {
      id: created.id,
      fromObject: created.fromObject,
      fromField: created.fromField,
      toObject: created.toObject,
      toField: created.toField,
      relType: created.relType,
      label: created.label,
    }])
  }, [drawingEdge])

  const handleDeleteRel = useCallback(async (id: string) => {
    await deleteObjectRelationship(id)
    setRelationships(prev => prev.filter(r => r.id !== id))
    setSelectedRelId(null)
    setEditingRel(null)
  }, [])

  const handleUpdateRel = useCallback(async (
    id: string,
    data: {
      relType?: string
      label?: string
      fromObject?: string
      fromField?: string
      toObject?: string
      toField?: string
    },
  ) => {
    const updated = await updateObjectRelationship(id, data)
    setRelationships(prev => prev.map(r => r.id === id ? {
      ...r,
      relType: updated.relType,
      label: updated.label,
      fromObject: updated.fromObject,
      fromField: updated.fromField,
      toObject: updated.toObject,
      toField: updated.toField,
    } : r))
    setEditingRel(prev => prev && prev.id === id ? {
      ...prev,
      relType: updated.relType,
      label: updated.label,
      fromObject: updated.fromObject,
      fromField: updated.fromField,
      toObject: updated.toObject,
      toField: updated.toField,
    } : prev)
  }, [])

  const handleSwapRelEnds = useCallback(async () => {
    if (!editingRel) return
    const swapped = swapRelEnds(editingRel)
    setEditingRel(swapped)
    await handleUpdateRel(editingRel.id, {
      fromObject: swapped.fromObject,
      fromField: swapped.fromField,
      toObject: swapped.toObject,
      toField: swapped.toField,
    })
  }, [editingRel, handleUpdateRel])

  const handleSetFromSide = useCallback(async (objectId: string) => {
    if (!editingRel || editingRel.fromObject === objectId) return
    await handleSwapRelEnds()
  }, [editingRel, handleSwapRelEnds])

  // Compute canvas size
  const canvasW = Math.max(1200, ...Object.values(positions).map(p => p.x + CARD_WIDTH + 60))
  const canvasH = Math.max(800, ...objects.map(obj => {
    const pos = positions[obj.id]
    return pos ? pos.y + cardHeight(obj) + 60 : 800
  }))

  const selectedRel = relationships.find(r => r.id === selectedRelId) ?? null

  return (
    <div className="flex flex-col h-full">
      {/* Controls bar */}
      <div className="flex items-center gap-4 px-5 py-3 bg-white border-b border-zinc-200 shrink-0">
        <h1 className="text-base font-semibold text-zinc-900">Object Relationships</h1>
        <div className="h-4 w-px bg-zinc-200" />
        <p className="text-xs text-zinc-500">
          Drag from a field&apos;s <span className="inline-block w-2.5 h-2.5 rounded-full bg-violet-400 align-middle mx-0.5" /> port to connect objects
        </p>
        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-8 h-px bg-violet-400" />
            1:1
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-8 h-px bg-violet-400" />
            1:N
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-8 h-px bg-violet-400" />
            N:M
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-auto relative bg-zinc-50"
        style={{ cursor: drawingEdge ? 'crosshair' : dragCard ? 'grabbing' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={() => { setSelectedRelId(null); setEditingRel(null) }}
      >
        <div className="relative" style={{ width: canvasW, height: canvasH }}>
          {/* SVG for arrows */}
          <svg
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            width={canvasW}
            height={canvasH}
          >
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#8b5cf6" />
              </marker>
              <marker id="arrowhead-sel" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#7c3aed" />
              </marker>
            </defs>

            {relationships.map(rel => {
              const fromObj = objects.find(o => o.id === rel.fromObject)
              const toObj = objects.find(o => o.id === rel.toObject)
              if (!fromObj || !toObj) return null
              const fromPos = positions[rel.fromObject]
              const toPos = positions[rel.toObject]
              if (!fromPos || !toPos) return null

              const fromFieldIdx = fromObj.fields.findIndex(f => f.key === rel.fromField)
              const toFieldIdx = toObj.fields.findIndex(f => f.key === rel.toField)
              if (fromFieldIdx < 0 || toFieldIdx < 0) return null

              const fromPt = rightPort(fromPos, fromFieldIdx)
              const toPt = leftPort(toPos, toFieldIdx)
              const isSelected = rel.id === selectedRelId

              const midX = (fromPt.x + toPt.x) / 2
              const midY = (fromPt.y + toPt.y) / 2
              const cp1x = fromPt.x + 80
              const cp2x = toPt.x - 80

              const abbr = REL_TYPES.find(t => t.value === rel.relType)?.abbr ?? '1:N'
              const pathD = `M ${fromPt.x} ${fromPt.y} C ${cp1x} ${fromPt.y}, ${cp2x} ${toPt.y}, ${toPt.x} ${toPt.y}`

              return (
                <g key={rel.id}>
                  {/* Wide transparent path for click detection */}
                  <path
                    d={pathD}
                    stroke="transparent"
                    strokeWidth={16}
                    fill="none"
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onClick={e => {
                      e.stopPropagation()
                      setSelectedRelId(rel.id)
                      setEditingRel(rel)
                    }}
                  />
                  {/* Visible path */}
                  <path
                    d={pathD}
                    stroke={isSelected ? '#7c3aed' : '#8b5cf6'}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    fill="none"
                    markerEnd={isSelected ? 'url(#arrowhead-sel)' : 'url(#arrowhead)'}
                    style={{ pointerEvents: 'none' }}
                    strokeDasharray={rel.relType === 'many_to_many' ? '6 3' : undefined}
                  />
                  {/* Label badge */}
                  <g style={{ pointerEvents: 'none' }}>
                    <rect
                      x={midX - 14}
                      y={midY - 9}
                      width={28}
                      height={18}
                      rx={4}
                      fill={isSelected ? '#7c3aed' : '#8b5cf6'}
                    />
                    <text
                      x={midX}
                      y={midY + 4}
                      textAnchor="middle"
                      fontSize={10}
                      fill="white"
                      fontWeight={600}
                    >
                      {abbr}
                    </text>
                  </g>
                </g>
              )
            })}

            {/* Drawing edge preview */}
            {drawingEdge && (() => {
              const fromObj = objects.find(o => o.id === drawingEdge.fromObject)
              if (!fromObj) return null
              const fromPos = positions[drawingEdge.fromObject]
              if (!fromPos) return null
              const fromFieldIdx = fromObj.fields.findIndex(f => f.key === drawingEdge.fromField)
              if (fromFieldIdx < 0) return null
              const fromPt = rightPort(fromPos, fromFieldIdx)
              return (
                <line
                  x1={fromPt.x}
                  y1={fromPt.y}
                  x2={drawingEdge.mouseX}
                  y2={drawingEdge.mouseY}
                  stroke="#8b5cf6"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  style={{ pointerEvents: 'none' }}
                />
              )
            })()}
          </svg>

          {/* Object cards */}
          {objects.map(obj => {
            const pos = positions[obj.id]
            if (!pos) return null
            const h = cardHeight(obj)
            return (
              <div
                key={obj.id}
                className="absolute select-none"
                style={{ left: pos.x, top: pos.y, width: CARD_WIDTH, zIndex: dragCard?.cardId === obj.id ? 20 : 10 }}
              >
                <div className="rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
                  {/* Header */}
                  <div
                    className="flex items-center px-3 bg-zinc-900 text-white cursor-grab active:cursor-grabbing"
                    style={{ height: CARD_HEADER_H }}
                    onMouseDown={e => handleCardMouseDown(e, obj.id)}
                  >
                    <span className="text-sm font-semibold truncate">{obj.label}</span>
                  </div>

                  {/* Fields */}
                  {obj.fields.map((field, idx) => {
                    const isHovered = hoveredPort?.objId === obj.id && hoveredPort?.fieldKey === field.key
                    const isDrawing = drawingEdge?.fromObject === obj.id && drawingEdge?.fromField === field.key
                    return (
                      <div
                        key={field.key}
                        className="relative flex items-center border-t border-zinc-100 px-3"
                        style={{ height: FIELD_ROW_H }}
                      >
                        <span className="text-xs text-zinc-600 truncate flex-1">{field.label}</span>
                        <span className="text-[10px] text-zinc-400 ml-1">{field.fieldType}</span>
                        {/* Port circle (right side) */}
                        <div
                          className="absolute -right-[5px] top-1/2 -translate-y-1/2 rounded-full border-2 transition-all duration-100"
                          style={{
                            width: isHovered || isDrawing ? 12 : 8,
                            height: isHovered || isDrawing ? 12 : 8,
                            right: isHovered || isDrawing ? -7 : -5,
                            background: isDrawing ? '#7c3aed' : isHovered ? '#8b5cf6' : '#d4d4d8',
                            borderColor: isDrawing ? '#7c3aed' : isHovered ? '#8b5cf6' : '#a1a1aa',
                            cursor: 'crosshair',
                            zIndex: 30,
                          }}
                          onMouseEnter={() => setHoveredPort({ objId: obj.id, fieldKey: field.key })}
                          onMouseLeave={() => setHoveredPort(null)}
                          onMouseDown={e => handlePortMouseDown(e, obj.id, field.key)}
                          onMouseUp={e => handlePortMouseUp(e, obj.id, field.key)}
                        />
                      </div>
                    )
                  })}

                  {obj.fields.length === 0 && (
                    <div className="px-3 py-2 text-xs text-zinc-400 italic border-t border-zinc-100">
                      No fields defined
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Empty state */}
          {relationships.length === 0 && !drawingEdge && (
            <div className="absolute pointer-events-none"
              style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
              <div className="text-center px-6 py-4 rounded-xl bg-white/80 border border-zinc-200 shadow-sm">
                <p className="text-sm font-medium text-zinc-600">No relationships yet</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Hover over a field row and drag from the ● port to another field
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit panel */}
      {selectedRel && editingRel && (
        <div
          className="fixed bottom-6 right-6 w-72 rounded-xl bg-white border border-zinc-200 shadow-xl z-50"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <p className="text-sm font-semibold text-zinc-900">Edit Relationship</p>
            <button
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
              onClick={() => { setSelectedRelId(null); setEditingRel(null) }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div>
              <p className="text-xs font-medium text-zinc-700">
                {relEndsSummary(editingRel, objects)}
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {editingRel.fromField} → {editingRel.toField}
              </p>
            </div>

            {(editingRel.relType === 'one_to_many' ||
              editingRel.relType === 'one_to_one' ||
              editingRel.relType === 'many_to_many') && (
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 space-y-2">
                <p className="text-xs font-medium text-zinc-700">Cardinality sides</p>
                {editingRel.relType === 'one_to_many' && (
                  <>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-500 block mb-1">
                        One (1) — parent / owner
                      </label>
                      <select
                        className="w-full text-sm border border-zinc-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                        value={editingRel.fromObject}
                        onChange={e => handleSetFromSide(e.target.value)}
                      >
                        <option value={editingRel.fromObject}>
                          {objects.find(o => o.id === editingRel.fromObject)?.label ?? editingRel.fromObject}
                        </option>
                        <option value={editingRel.toObject}>
                          {objects.find(o => o.id === editingRel.toObject)?.label ?? editingRel.toObject}
                        </option>
                      </select>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{editingRel.fromField}</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-500 block mb-1">
                        Many (N) — related records
                      </label>
                      <p className="text-sm text-zinc-800">
                        {objects.find(o => o.id === editingRel.toObject)?.label ?? editingRel.toObject}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{editingRel.toField}</p>
                    </div>
                  </>
                )}
                {editingRel.relType === 'one_to_one' && (
                  <>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-500 block mb-1">
                        First side (1) — arrow starts here
                      </label>
                      <select
                        className="w-full text-sm border border-zinc-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                        value={editingRel.fromObject}
                        onChange={e => handleSetFromSide(e.target.value)}
                      >
                        <option value={editingRel.fromObject}>
                          {objects.find(o => o.id === editingRel.fromObject)?.label ?? editingRel.fromObject}
                        </option>
                        <option value={editingRel.toObject}>
                          {objects.find(o => o.id === editingRel.toObject)?.label ?? editingRel.toObject}
                        </option>
                      </select>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{editingRel.fromField}</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-500 block mb-1">
                        Second side (1)
                      </label>
                      <p className="text-sm text-zinc-800">
                        {objects.find(o => o.id === editingRel.toObject)?.label ?? editingRel.toObject}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{editingRel.toField}</p>
                    </div>
                  </>
                )}
                {editingRel.relType === 'many_to_many' && (
                  <>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-500 block mb-1">
                        Side A (N) — arrow starts here
                      </label>
                      <select
                        className="w-full text-sm border border-zinc-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                        value={editingRel.fromObject}
                        onChange={e => handleSetFromSide(e.target.value)}
                      >
                        <option value={editingRel.fromObject}>
                          {objects.find(o => o.id === editingRel.fromObject)?.label ?? editingRel.fromObject}
                        </option>
                        <option value={editingRel.toObject}>
                          {objects.find(o => o.id === editingRel.toObject)?.label ?? editingRel.toObject}
                        </option>
                      </select>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{editingRel.fromField}</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-500 block mb-1">
                        Side B (N)
                      </label>
                      <p className="text-sm text-zinc-800">
                        {objects.find(o => o.id === editingRel.toObject)?.label ?? editingRel.toObject}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{editingRel.toField}</p>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  className="w-full text-xs font-medium text-violet-700 hover:text-violet-900 py-1"
                  onClick={() => void handleSwapRelEnds()}
                >
                  Swap sides
                </button>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-zinc-700 mb-1.5">Relationship Type</p>
              <div className="space-y-1">
                {REL_TYPES.map(rt => (
                  <label key={rt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="relType"
                      value={rt.value}
                      checked={editingRel.relType === rt.value}
                      onChange={() => {
                        setEditingRel(prev => prev ? { ...prev, relType: rt.value } : prev)
                        handleUpdateRel(editingRel.id, { relType: rt.value })
                      }}
                      className="accent-violet-600"
                    />
                    <span className="text-sm text-zinc-700">{rt.label}</span>
                    <span className="ml-auto text-xs font-mono text-zinc-400">{rt.abbr}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 block mb-1">Label (optional)</label>
              <input
                type="text"
                className="w-full text-sm border border-zinc-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="e.g. belongs to"
                value={editingRel.label}
                onChange={e => setEditingRel(prev => prev ? { ...prev, label: e.target.value } : prev)}
                onBlur={() => handleUpdateRel(editingRel.id, { label: editingRel.label })}
              />
            </div>

            <button
              className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 transition-colors"
              onClick={() => handleDeleteRel(editingRel.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete relationship
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
