'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { createSegment } from '@/app/actions'
import {
  buildObjectTypeMeta,
  resolveIcon,
  type CustomObjectOption,
  type ObjectTypeMeta,
} from '@/lib/segmentObjects'

type Props = {
  customObjects: CustomObjectOption[]
}

export default function NewSegmentForm({ customObjects }: Props) {
  const objectTypeMeta = buildObjectTypeMeta(customObjects)
  const allTypes = Object.entries(objectTypeMeta).map(([value, meta]) => ({ value, ...meta }))

  const [selected, setSelected] = useState<string[]>(['contact'])
  const [isPending, startTransition] = useTransition()

  function toggleType(value: string) {
    setSelected(prev => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev
        return prev.filter(t => t !== value)
      }
      return [...prev, value]
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('objectTypes', JSON.stringify(selected))
    startTransition(async () => {
      await createSegment(formData)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">
          Object types <span className="text-zinc-400 font-normal">(select one or more)</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {allTypes.map(t => (
            <ObjectTypeCard
              key={t.value}
              meta={t}
              isSelected={selected.includes(t.value)}
              onToggle={() => toggleType(t.value)}
            />
          ))}
        </div>
        {customObjects.length === 0 && (
          <p className="text-xs text-zinc-400 mt-2">
            Add custom objects in Setup → Objects to include them in segments.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Segment name <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          required
          autoFocus
          placeholder="e.g. Hot leads & open opportunities"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Description <span className="text-zinc-400">(optional)</span>
        </label>
        <textarea
          name="description"
          rows={2}
          placeholder="What is this segment used for?"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isPending || selected.length === 0}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Creating…' : 'Create & Add Filters →'}
      </button>
    </form>
  )
}

function ObjectTypeCard({
  meta,
  isSelected,
  onToggle,
}: {
  meta: ObjectTypeMeta & { value: string }
  isSelected: boolean
  onToggle: () => void
}) {
  const Icon = resolveIcon(meta.iconName)
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
        isSelected
          ? 'border-zinc-900 bg-zinc-50 ring-2 ring-zinc-200'
          : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
      }`}
    >
      {isSelected && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </span>
      )}
      <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${meta.color}`} />
      </div>
      <span className={`text-xs font-semibold ${isSelected ? 'text-zinc-900' : 'text-zinc-600'}`}>
        {meta.label}
      </span>
      <span className="text-[10px] text-zinc-400 leading-tight">{meta.description}</span>
    </button>
  )
}
