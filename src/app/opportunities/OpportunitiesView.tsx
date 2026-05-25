'use client'

import { useState, useMemo, useTransition } from 'react'
import { LayoutList, LayoutGrid, Search, X, Pencil, Check, Plus, Settings2 } from 'lucide-react'
import KanbanBoard from './KanbanBoard'
import { updateOpportunity } from '@/app/actions'
import PipelineEditorModal from './PipelineEditorModal'
import type { PipelineDTO } from './page'

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

function EditOpportunityRow({ opportunity, stages, onDone }: { opportunity: Opportunity; stages: string[]; onDone: () => void }) {
  const [name, setName] = useState(opportunity.name)
  const [value, setValue] = useState(String(opportunity.value))
  const [stage, setStage] = useState(opportunity.stage)
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      await updateOpportunity(opportunity.id, { name, value: parseFloat(value) || 0, stage })
      onDone()
    })
  }

  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-2">
        <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
      </td>
      <td className="px-4 py-2">
        <select value={stage} onChange={e => setStage(e.target.value)} className="rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none">
          {stages.map(s => <option key={s}>{s}</option>)}
        </select>
      </td>
      <td className="px-4 py-2 text-zinc-500">{opportunity.contactName ?? '—'}</td>
      <td className="px-4 py-2 text-zinc-500">{opportunity.companyName ?? '—'}</td>
      <td className="px-4 py-2">
        <input type="number" value={value} onChange={e => setValue(e.target.value)} className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={isPending} className="rounded bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-700 flex items-center gap-1 disabled:opacity-50">
            <Check className="w-3 h-3" /> Save
          </button>
          <button onClick={onDone} className="text-xs text-zinc-500 hover:text-zinc-700">Cancel</button>
        </div>
      </td>
    </tr>
  )
}

export default function OpportunitiesView({ opportunities, pipelines }: { opportunities: Opportunity[]; pipelines: PipelineDTO[] }) {
  const defaultPipeline = pipelines.find(p => p.isDefault) ?? pipelines[0]
  const [activePipelineId, setActivePipelineId] = useState<string>(defaultPipeline?.id ?? '')
  const [editingPipeline, setEditingPipeline] = useState<PipelineDTO | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const activePipeline = pipelines.find(p => p.id === activePipelineId) ?? defaultPipeline

  const pipelineOpportunities = useMemo(
    () => opportunities.filter(d => d.pipelineId === activePipeline?.id),
    [opportunities, activePipeline?.id],
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return pipelineOpportunities
    return pipelineOpportunities.filter(d =>
      `${d.name} ${d.stage} ${d.contactName ?? ''} ${d.companyName ?? ''}`.toLowerCase().includes(q)
    )
  }, [pipelineOpportunities, query])

  const stageLabels = activePipeline?.stages.map(s => s.label) ?? []

  return (
    <div>
      {/* Pipeline tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-zinc-200 overflow-x-auto">
        {pipelines.map(p => {
          const isActive = activePipeline?.id === p.id
          return (
            <button
              key={p.id}
              onClick={() => setActivePipelineId(p.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'text-violet-700 border-b-2 border-violet-600 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-900 border-b-2 border-transparent'
              }`}
            >
              {p.name}
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">{p.opportunityCount}</span>
              {p.isDefault && (
                <span className="text-[10px] uppercase tracking-wide text-zinc-400">default</span>
              )}
              {isActive && (
                <span
                  onClick={e => {
                    e.stopPropagation()
                    setEditingPipeline(p)
                  }}
                  className="ml-1 inline-flex items-center justify-center rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  title="Edit pipeline"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </span>
              )}
            </button>
          )
        })}
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 rounded-t-md transition-colors whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" /> Pipeline
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter opportunities…"
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-zinc-300 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {query && <span className="text-sm text-zinc-500 shrink-0">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>}
        <div className="flex rounded-lg border border-zinc-300 overflow-hidden ml-auto">
          <button
            onClick={() => setView('kanban')}
            title="Kanban view"
            className={`px-3 py-2 transition-colors ${view === 'kanban' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('table')}
            title="Table view"
            className={`px-3 py-2 border-l border-zinc-300 transition-colors ${view === 'table' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}
          >
            <LayoutList className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        activePipeline ? (
          <KanbanBoard
            opportunities={query ? filtered : pipelineOpportunities}
            pipeline={activePipeline}
          />
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center text-sm text-zinc-400">
            No pipeline selected. Create one above.
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Stage</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Company</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Value</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(d =>
                editingId === d.id ? (
                  <EditOpportunityRow key={d.id} opportunity={d} stages={stageLabels} onDone={() => setEditingId(null)} />
                ) : (
                  <tr key={d.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900">{d.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-100 text-zinc-600">{d.stage}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{d.contactName ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500">{d.companyName ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-zinc-900">${d.value.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setEditingId(d.id)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              )}
              {!filtered.length && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-400">
                  {query ? `No opportunities matching "${query}"` : 'No opportunities yet.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <PipelineEditorModal pipeline={null} onClose={() => setShowCreate(false)} />}
      {editingPipeline && (
        <PipelineEditorModal pipeline={editingPipeline} onClose={() => setEditingPipeline(null)} />
      )}
    </div>
  )
}
