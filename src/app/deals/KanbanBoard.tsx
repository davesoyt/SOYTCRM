'use client'

import { useState, useTransition, useMemo } from 'react'
import { DndContext, DragOverlay, closestCenter, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { moveDeal } from '@/app/actions'
import { differenceInDays } from 'date-fns'
import type { PipelineDTO, PipelineStage } from './page'

type Deal = {
  id: string
  name: string
  value: number
  stage: string
  pipelineId: string | null
  createdAt: string
  contactName: string | null
  companyName: string | null
}

function stageColor(stage: PipelineStage): string {
  if (stage.isClosedWon) return 'border-t-green-500'
  if (stage.isClosedLost) return 'border-t-red-400'
  // Deterministic by order
  const palette = ['border-t-zinc-400', 'border-t-blue-400', 'border-t-orange-400', 'border-t-violet-400', 'border-t-amber-400', 'border-t-pink-400']
  return palette[stage.order % palette.length]
}

function DealCard({ deal, isDragging = false }: { deal: Deal; isDragging?: boolean }) {
  const daysInStage = differenceInDays(new Date(), new Date(deal.createdAt))
  return (
    <div className={`bg-white rounded-lg border border-zinc-200 p-3 shadow-sm text-sm ${isDragging ? 'opacity-50' : ''}`}>
      <p className="font-medium text-zinc-900 truncate">{deal.name}</p>
      <p className="text-zinc-500 text-xs mt-0.5 truncate">{deal.companyName ?? deal.contactName ?? '—'}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="font-semibold text-zinc-900">${deal.value.toLocaleString()}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${daysInStage > 14 ? 'bg-red-50 text-red-600' : 'bg-zinc-100 text-zinc-500'}`}>
          {daysInStage}d
        </span>
      </div>
    </div>
  )
}

function SortableDealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      <DealCard deal={deal} isDragging={isDragging} />
    </div>
  )
}

function DroppableColumn({
  stage,
  deals,
}: {
  stage: PipelineStage
  deals: Deal[]
}) {
  const stageValue = deals.reduce((s, d) => s + d.value, 0)
  return (
    <div className={`flex flex-col min-w-[220px] max-w-[220px] border-t-4 ${stageColor(stage)} bg-zinc-50 rounded-xl p-3`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">{stage.label}</span>
        <span className="text-xs text-zinc-500">{deals.length}</span>
      </div>
      {stageValue > 0 && (
        <p className="text-xs text-zinc-500 mb-2">${stageValue.toLocaleString()}</p>
      )}
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1 min-h-[80px]">
          {deals.map((deal) => (
            <SortableDealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

export default function KanbanBoard({
  deals: initialDeals,
  pipeline,
}: {
  deals: Deal[]
  pipeline: PipelineDTO
}) {
  const [deals, setDeals] = useState(initialDeals)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Sync state when initialDeals changes
  const stages = pipeline.stages

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const dealId = active.id as string
    const targetDeal = deals.find((d) => d.id === over.id)
    if (!targetDeal) return
    const newStage = targetDeal.stage
    const currentDeal = deals.find((d) => d.id === dealId)
    if (!currentDeal || currentDeal.stage === newStage) return
    if (!stages.some(s => s.label === newStage)) return

    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)))
    startTransition(() => moveDeal(dealId, newStage))
  }

  const dealsByStage = useMemo(
    () =>
      stages.reduce<Record<string, Deal[]>>((acc, s) => {
        acc[s.label] = deals.filter((d) => d.stage === s.label)
        return acc
      }, {}),
    [stages, deals],
  )

  return (
    <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <DroppableColumn key={stage.key} stage={stage} deals={dealsByStage[stage.label] ?? []} />
        ))}
      </div>
      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
