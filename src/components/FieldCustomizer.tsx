'use client'

import { useState } from 'react'
import { Settings2, X } from 'lucide-react'

export type FieldDef = { key: string; label: string }

type Props = {
  fields: FieldDef[]
  visibility: Record<string, boolean>
  onToggle: (key: string) => void
  onReset: () => void
}

export default function FieldCustomizer({ fields, visibility, onToggle, onReset }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
      >
        <Settings2 className="w-3.5 h-3.5" />
        Customize
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-40 w-52 rounded-xl border border-zinc-200 bg-white shadow-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">Visible sections</span>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <ul className="space-y-1">
              {fields.map(f => (
                <li key={f.key}>
                  <label className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-1 hover:bg-zinc-50 text-sm">
                    <input
                      type="checkbox"
                      checked={visibility[f.key] ?? true}
                      onChange={() => onToggle(f.key)}
                      className="rounded accent-zinc-900"
                    />
                    {f.label}
                  </label>
                </li>
              ))}
            </ul>
            <button
              onClick={onReset}
              className="mt-2 w-full text-xs text-zinc-400 hover:text-zinc-600 text-center py-1"
            >
              Reset to defaults
            </button>
          </div>
        </>
      )}
    </div>
  )
}
