'use client'

import { useState } from 'react'
import { Settings2, X } from 'lucide-react'

export type FieldDef = { key: string; label: string }

type Props = {
  fields: FieldDef[]
  visibility: Record<string, boolean>
  onToggle: (key: string) => void
  onReset: () => void
  title?: string
  pinnedKeys?: string[]
}

export default function FieldCustomizer({
  fields, visibility, onToggle, onReset, title = 'Visible sections', pinnedKeys = [],
}: Props) {
  const [open, setOpen] = useState(false)
  const builtInFields = fields.filter((f) => !f.key.startsWith('custom:'))
  const customFields = fields.filter((f) => f.key.startsWith('custom:'))

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
          {/* Cover main content only — leave sidebar (w-56) clickable */}
          <div className="fixed top-0 right-0 bottom-0 left-56 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-40 w-56 rounded-xl border border-zinc-200 bg-white shadow-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">{title}</span>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <ul className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {builtInFields.map(f => {
                const pinned = pinnedKeys.includes(f.key)
                return (
                  <li key={f.key}>
                    <label className={`flex items-center gap-2 rounded px-1.5 py-1 text-sm ${pinned ? 'opacity-60 cursor-default' : 'cursor-pointer hover:bg-zinc-50'}`}>
                      <input
                        type="checkbox"
                        checked={visibility[f.key] ?? true}
                        disabled={pinned}
                        onChange={() => onToggle(f.key)}
                        className="rounded accent-zinc-900"
                      />
                      {f.label}
                      {pinned && <span className="text-[10px] text-zinc-400 ml-auto">always</span>}
                    </label>
                  </li>
                )
              })}
              {customFields.length > 0 && (
                <li className="pt-2 mt-2 border-t border-zinc-100">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                    Custom fields
                  </span>
                </li>
              )}
              {customFields.map(f => {
                const pinned = pinnedKeys.includes(f.key)
                return (
                  <li key={f.key}>
                    <label className={`flex items-center gap-2 rounded px-1.5 py-1 text-sm ${pinned ? 'opacity-60 cursor-default' : 'cursor-pointer hover:bg-zinc-50'}`}>
                      <input
                        type="checkbox"
                        checked={visibility[f.key] ?? true}
                        disabled={pinned}
                        onChange={() => onToggle(f.key)}
                        className="rounded accent-zinc-900"
                      />
                      {f.label}
                      {pinned && <span className="text-[10px] text-zinc-400 ml-auto">always</span>}
                    </label>
                  </li>
                )
              })}
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
