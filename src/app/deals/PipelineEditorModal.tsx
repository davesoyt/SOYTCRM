'use client'

import { useState, useTransition } from 'react'
import { X, Plus, Trash2, GripVertical, Loader2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { createPipeline, updatePipeline, deletePipeline } from '@/app/actions'
import type { PipelineStage, PipelineDTO } from './page'

type StageDraft = PipelineStage & { _uid: string }

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'stage'
}

export default function PipelineEditorModal({
  pipeline,
  onClose,
}: {
  pipeline: PipelineDTO | null
  onClose: () => void
}) {
  const isNew = !pipeline
  const [name, setName] = useState(pipeline?.name ?? 'New Pipeline')
  const [stages, setStages] = useState<StageDraft[]>(() =>
    pipeline
      ? pipeline.stages.map(s => ({ ...s, _uid: nanoid(6) }))
      : [
          { _uid: nanoid(6), key: 'new', label: 'New', order: 0 },
          { _uid: nanoid(6), key: 'in_progress', label: 'In Progress', order: 1 },
          { _uid: nanoid(6), key: 'won', label: 'Won', order: 2, isClosedWon: true },
          { _uid: nanoid(6), key: 'lost', label: 'Lost', order: 3, isClosedLost: true },
        ],
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function addStage() {
    setStages(prev => [
      ...prev,
      { _uid: nanoid(6), key: slugify(`stage_${prev.length + 1}`), label: `Stage ${prev.length + 1}`, order: prev.length },
    ])
  }

  function removeStage(uid: string) {
    setStages(prev => prev.filter(s => s._uid !== uid).map((s, i) => ({ ...s, order: i })))
  }

  function moveStage(uid: string, dir: -1 | 1) {
    setStages(prev => {
      const idx = prev.findIndex(s => s._uid === uid)
      if (idx < 0) return prev
      const target = idx + dir
      if (target < 0 || target >= prev.length) return prev
      const copy = [...prev]
      const tmp = copy[idx]
      copy[idx] = copy[target]
      copy[target] = tmp
      return copy.map((s, i) => ({ ...s, order: i }))
    })
  }

  function updateStage(uid: string, patch: Partial<StageDraft>) {
    setStages(prev =>
      prev.map(s => {
        if (s._uid !== uid) return s
        const next = { ...s, ...patch }
        if (patch.label !== undefined && (!s.key || s.key === slugify(s.label))) {
          next.key = slugify(patch.label)
        }
        return next
      }),
    )
  }

  function save() {
    setError(null)
    if (!name.trim()) { setError('Pipeline name required'); return }
    if (stages.length === 0) { setError('At least one stage required'); return }
    const payload = stages.map(s => ({
      key: s.key || slugify(s.label),
      label: s.label,
      isClosedWon: s.isClosedWon ?? false,
      isClosedLost: s.isClosedLost ?? false,
    }))
    startTransition(async () => {
      if (isNew) {
        await createPipeline(name, payload)
      } else if (pipeline) {
        const ordered = payload.map((p, i) => ({ ...p, order: i }))
        await updatePipeline(pipeline.id, {
          name,
          stages: JSON.stringify(ordered),
        })
      }
      onClose()
    })
  }

  function handleDelete() {
    if (!pipeline) return
    if (!confirm(`Delete pipeline "${pipeline.name}"?`)) return
    startTransition(async () => {
      const result = await deletePipeline(pipeline.id)
      if (!result.ok) setError(result.error ?? 'Failed to delete')
      else onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200">
          <h2 className="text-base font-semibold text-zinc-900">
            {isNew ? 'Create Pipeline' : 'Edit Pipeline'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Pipeline Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="e.g. Customer Success"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-zinc-700">Stages</label>
              <button
                onClick={addStage}
                className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900"
              >
                <Plus className="w-3 h-3" /> Add Stage
              </button>
            </div>
            <div className="space-y-2">
              {stages.map((s, i) => (
                <div key={s._uid} className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveStage(s._uid, -1)}
                        disabled={i === 0}
                        className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                      >
                        <GripVertical className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      value={s.label}
                      onChange={e => updateStage(s._uid, { label: e.target.value })}
                      className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="Stage name"
                    />
                    <button
                      onClick={() => moveStage(s._uid, 1)}
                      disabled={i === stages.length - 1}
                      className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30 text-xs"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => moveStage(s._uid, -1)}
                      disabled={i === 0}
                      className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30 text-xs"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => removeStage(s._uid)}
                      disabled={stages.length === 1}
                      className="text-zinc-300 hover:text-red-500 disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-4 text-xs text-zinc-600 pl-5">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={!!s.isClosedWon}
                        onChange={e => updateStage(s._uid, { isClosedWon: e.target.checked, isClosedLost: e.target.checked ? false : s.isClosedLost })}
                        className="rounded border-zinc-300 text-green-600 focus:ring-green-500"
                      />
                      Mark as Closed Won
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={!!s.isClosedLost}
                        onChange={e => updateStage(s._uid, { isClosedLost: e.target.checked, isClosedWon: e.target.checked ? false : s.isClosedWon })}
                        className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
                      />
                      Mark as Closed Lost
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-3 bg-zinc-50 rounded-b-2xl">
          <div>
            {!isNew && pipeline && !pipeline.isDefault && (
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                Delete pipeline
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
