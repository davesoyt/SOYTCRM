'use client'

import { useState } from 'react'
import { Users, Building2, TrendingUp } from 'lucide-react'
import { createSegment } from '@/app/actions'

const OBJECT_TYPES = [
  { value: 'contact', label: 'Contacts', description: 'Filter your contact list', Icon: Users, color: 'text-violet-600', bg: 'bg-violet-100', border: 'border-violet-400', ring: 'ring-violet-200' },
  { value: 'company', label: 'Companies', description: 'Filter your company list', Icon: Building2, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-400', ring: 'ring-blue-200' },
  { value: 'deal', label: 'Deals', description: 'Filter your pipeline', Icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-400', ring: 'ring-emerald-200' },
]

export default function NewSegmentPage() {
  const [objectType, setObjectType] = useState('contact')

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-1">New Segment</h1>
      <p className="text-zinc-500 text-sm mb-6">Choose an object type, name your segment, then build filters.</p>

      <form action={createSegment} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
        <input type="hidden" name="objectType" value={objectType} />

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Object type</label>
          <div className="grid grid-cols-3 gap-2">
            {OBJECT_TYPES.map(t => {
              const selected = objectType === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setObjectType(t.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
                    selected
                      ? `border-zinc-900 bg-zinc-50 ring-2 ring-zinc-200`
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg ${t.bg} flex items-center justify-center`}>
                    <t.Icon className={`w-5 h-5 ${t.color}`} />
                  </div>
                  <span className={`text-xs font-semibold ${selected ? 'text-zinc-900' : 'text-zinc-600'}`}>{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Segment name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            required
            autoFocus
            placeholder="e.g. Hot Leads in Chicago"
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
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Create &amp; Add Filters →
        </button>
      </form>
    </div>
  )
}
