'use client'

import { useState, useTransition, useMemo } from 'react'
import { DndContext, DragOverlay, closestCenter, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { moveOpportunity } from '@/app/actions'
import { differenceInDays } from 'date-fns'
import type { PipelineDTO, PipelineStage } from './page'

type Opportunity = {
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
  const palette = ['border-t-zinc-400', 'border-t-blue-400', 'border-t-orange-400', 'border-t-violet-400', 'border-t-amber-400', 'border-t-pink-400']
  return palette[stage.order % palette.length]
}

function OpportunityCard({ opportunity, isDragging = false }: { opportunity: Opportunity; isDragging?: boolean }) {
  const daysInStage = differenceInDays(new Date(), new Date(opportunity.createdAt))
  return (
    <div className={`bg-white rounded-lg border border-zinc-200 p-3 shadow-sm text-sm ${isDragging ? 'opacity-50' : ''}`}>
      <p className="font-medium text-zinc-900 truncate">{opportunity.name}</p>
      <p className="text-zinc-500 text-xs mt-0.5 truncate">{opportunity.companyName ?? opportunity.contactName ?? '—'}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="font-semibold text-zinc-900">${opportunity.value.toLocaleString()}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${daysInStage > 14 ? 'bg-red-50 text-red-600' : 'bg-zinc-100 text-zinc-500'}`}>
          {daysInStage}d
        </span>
      </div>
    </div>
  )
}

function SortableOpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opportunity.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      <OpportunityCard opportunity={opportunity} isDragging={isDragging} />
    </div>
  )
}

function DroppableColumn({
  stage,
  opportunities,
}: {
  stage: PipelineStage
  opportunities: Opportunity[]
}) {
  const stageValue = opportunities.reduce((s, d) => s + d.value, 0)
  return (
    <div className={`flex flex-col min-w-[220px] max-w-[220px] border-t-4 ${stageColor(stage)} bg-zinc-50 rounded-xl p-3`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">{stage.label}</span>
        <span className="text-xs text-zinc-500">{opportunities.length}</span>
      </div>
      {stageValue > 0 && (
        <p className="text-xs text-zinc-500 mb-2">${stageValue.toLocaleString()}</p>
      )}
      <SortableContext items={opportunities.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1 min-h-[80px]">
          {opportunities.map((opp) => (
            <SortableOpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

export default function KanbanBoard({
  opportunities: initialOpportunities,
  pipeline,
}: {
  opportunities: Opportunity[]
  pipeline: PipelineDTO
}) {
  const [opportunities, setOpportunities] = useState(initialOpportunities)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const stages = pipeline.stages
  const activeOpportunity = activeId ? opportunities.find((d) => d.id === activeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const opportunityId = active.id as string
    const target = opportunities.find((d) => d.id === over.id)
    if (!target) return
    const newStage = target.stage
    const current = opportunities.find((d) => d.id === opportunityId)
    if (!current || current.stage === newStage) return
    if (!stages.some(s => s.label === newStage)) return

    setOpportunities((prev) => prev.map((d) => (d.id === opportunityId ? { ...d, stage: newStage } : d)))
    startTransition(() => moveOpportunity(opportunityId, newStage))
  }

  const byStage = useMemo(
    () =>
      stages.reduce<Record<string, Opportunity[]>>((acc, s) => {
        acc[s.label] = opportunities.filter((d) => d.stage === s.label)
        return acc
      }, {}),
    [stages, opportunities],
  )

  return (
    <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <DroppableColumn key={stage.key} stage={stage} opportunities={byStage[stage.label] ?? []} />
        ))}
      </div>
      <DragOverlay>
        {activeOpportunity ? <OpportunityCard opportunity={activeOpportunity} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
