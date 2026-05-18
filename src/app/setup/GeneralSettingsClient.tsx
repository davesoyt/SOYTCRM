'use client'

import { useState, useRef, useTransition } from 'react'
import { Upload, X, Check } from 'lucide-react'
import { updateCRMSettings } from '@/app/actions'

export default function GeneralSettingsClient({
  name: initialName,
  logoData: initialLogoData,
}: {
  name: string
  logoData: string | null
}) {
  const [name, setName] = useState(initialName)
  const [logoData, setLogoData] = useState<string | null>(initialLogoData)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setLogoData(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function save() {
    startTransition(async () => {
      await updateCRMSettings({ name, logoData })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-6">
      {/* CRM Name */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">CRM Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="My CRM"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
        <p className="text-xs text-zinc-400 mt-1">Shown in the top-left of the sidebar.</p>
      </div>

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Logo</label>
        <div className="flex items-center gap-4">
          {logoData ? (
            <div className="relative w-16 h-16 rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoData} alt="Logo" className="w-full h-full object-contain p-1" />
              <button
                onClick={() => setLogoData(null)}
                className="absolute top-0.5 right-0.5 rounded-full bg-white border border-zinc-200 p-0.5 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-zinc-300 flex items-center justify-center text-zinc-300 bg-zinc-50 shrink-0">
              <Upload className="w-5 h-5" />
            </div>
          )}
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 transition-colors"
            >
              {logoData ? 'Change image' : 'Upload image'}
            </button>
            <p className="text-xs text-zinc-400 mt-1">PNG, JPG, SVG. Displayed at 40×40px.</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2 border-t border-zinc-100">
        <button
          onClick={save}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
