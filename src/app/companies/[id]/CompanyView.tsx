'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react'
import ActivityTimeline from '@/components/ActivityTimeline'
import FieldCustomizer from '@/components/FieldCustomizer'
import { useFieldVisibility } from '@/lib/useFieldVisibility'
import { scoreLabel } from '@/lib/scoring'
import { updateCompany } from '@/app/actions'

const FIELD_DEFS = [
  { key: 'stats', label: 'Stats (contacts / deals / value)' },
  { key: 'headerMeta', label: 'Header info (industry / size / domain)' },
  { key: 'contacts', label: 'Contacts list' },
  { key: 'deals', label: 'Deals list' },
  { key: 'timeline', label: 'Activity Timeline' },
]

const DEFAULTS: Record<string, boolean> = Object.fromEntries(FIELD_DEFS.map(f => [f.key, true]))

type Props = {
  company: {
    id: string
    name: string
    domain: string | null
    industry: string | null
    size: string | null
    website: string | null
    customFields: string
    contacts: { id: string; firstName: string; lastName: string; leadScore: number }[]
    deals: { id: string; name: string; stage: string; value: number }[]
    activities: { id: string; type: string; title: string; body: string | null; createdAt: Date; dealId?: string | null }[]
    tasks: { id: string; title: string; status: string; dueDate: Date | null; createdAt: Date }[]
  }
  totalDealValue: number
}

function FieldRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-baseline gap-2 py-1.5 border-b border-zinc-100 last:border-0">
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide w-28 shrink-0">{label}</span>
      <span className="text-sm text-zinc-800 break-all">{value}</span>
    </div>
  )
}

function EditInput({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
    </div>
  )
}

export default function CompanyView({ company, totalDealValue }: Props) {
  const { fields, toggle, reset, loaded } = useFieldVisibility(`company:${company.id}`, DEFAULTS)
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(company.name)
  const [domain, setDomain] = useState(company.domain ?? '')
  const [industry, setIndustry] = useState(company.industry ?? '')
  const [size, setSize] = useState(company.size ?? '')
  const [website, setWebsite] = useState(company.website ?? '')

  // Custom fields
  const parsed: Record<string, string> = (() => { try { return JSON.parse(company.customFields) } catch { return {} } })()
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>(
    () => Object.entries(parsed).map(([key, value]) => ({ key, value }))
  )

  function saveEdits() {
    startTransition(async () => {
      const customObj = Object.fromEntries(
        customFields.filter(f => f.key.trim()).map(f => [f.key.trim(), f.value])
      )
      await updateCompany(company.id, { name, domain, industry, size, website, customFields: customObj })
      setEditing(false)
    })
  }

  function cancelEdits() {
    setName(company.name); setDomain(company.domain ?? ''); setIndustry(company.industry ?? '')
    setSize(company.size ?? ''); setWebsite(company.website ?? '')
    setCustomFields(Object.entries(parsed).map(([key, value]) => ({ key, value })))
    setEditing(false)
  }

  function addCustomField() {
    setCustomFields(prev => [...prev, { key: '', value: '' }])
  }

  function updateCustomField(i: number, patch: Partial<{ key: string; value: string }>) {
    setCustomFields(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f))
  }

  function removeCustomField(i: number) {
    setCustomFields(prev => prev.filter((_, idx) => idx !== i))
  }

  if (!loaded) return null

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0 mr-4">
          {editing ? (
            <div className="space-y-3">
              <EditInput label="Company name" value={name} onChange={setName} />
              <div className="grid grid-cols-2 gap-3">
                <EditInput label="Domain" value={domain} onChange={setDomain} placeholder="acme.com" />
                <EditInput label="Website" value={website} onChange={setWebsite} placeholder="https://acme.com" />
                <EditInput label="Industry" value={industry} onChange={setIndustry} />
                <EditInput label="Size (employees)" value={size} onChange={setSize} placeholder="50-200" />
              </div>

              {/* Custom fields — unified with standard */}
              {customFields.length > 0 && <hr className="border-zinc-200" />}
              {customFields.length > 0 && (
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Additional Fields</p>
              )}
              {customFields.map((f, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Field Name</label>
                    <input value={f.key} onChange={e => updateCustomField(i, { key: e.target.value })}
                      placeholder="e.g. Account Manager"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Value</label>
                    <input value={f.value} onChange={e => updateCustomField(i, { value: e.target.value })}
                      placeholder="Value"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                  </div>
                  <button onClick={() => removeCustomField(i)}
                    className="mb-0.5 p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button onClick={addCustomField}
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
                <Plus className="w-4 h-4" /> Add field
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{name}</h1>

              {/* Unified field display — standard + custom together */}
              {fields.headerMeta && (
                <div className="mt-4 bg-white rounded-xl border border-zinc-200 p-4 max-w-lg">
                  <FieldRow label="Industry" value={industry || null} />
                  <FieldRow label="Employees" value={size || null} />
                  <FieldRow label="Domain" value={domain || null} />
                  <FieldRow label="Website" value={website || null} />
                  {/* Custom fields shown inline — no separate section */}
                  {customFields.map(f => f.key.trim() ? (
                    <FieldRow key={f.key} label={f.key} value={f.value} />
                  ) : null)}
                </div>
              )}
              {!fields.headerMeta && customFields.some(f => f.key.trim()) && (
                <div className="mt-4 bg-white rounded-xl border border-zinc-200 p-4 max-w-lg">
                  {customFields.map(f => f.key.trim() ? (
                    <FieldRow key={f.key} label={f.key} value={f.value} />
                  ) : null)}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <button onClick={saveEdits} disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors">
                <Check className="w-4 h-4" /> Save
              </button>
              <button onClick={cancelEdits}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors">
                <X className="w-4 h-4" /> Cancel
              </button>
            </>
          ) : (
            <>
              <FieldCustomizer fields={FIELD_DEFS} visibility={fields} onToggle={toggle} onReset={reset} />
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors">
                <Pencil className="w-4 h-4" /> Edit
              </button>
            </>
          )}
        </div>
      </div>

      {fields.stats && !editing && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Contacts', value: company.contacts.length },
            { label: 'Deals', value: company.deals.length },
            { label: 'Pipeline Value', value: `$${totalDealValue.toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-zinc-200 p-5">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          {fields.contacts && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <h2 className="font-semibold mb-4">Contacts</h2>
              <ul className="space-y-3">
                {company.contacts.map(c => {
                  const { label, color } = scoreLabel(c.leadScore)
                  return (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">{c.firstName} {c.lastName}</Link>
                      <span className={`text-xs font-semibold ${color}`}>{c.leadScore} · {label}</span>
                    </li>
                  )
                })}
                {!company.contacts.length && <li className="text-zinc-400 text-sm">No contacts.</li>}
              </ul>
            </div>
          )}

          {fields.deals && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <h2 className="font-semibold mb-4">Deals</h2>
              <ul className="space-y-2">
                {company.deals.map(d => (
                  <li key={d.id} className="text-sm flex justify-between items-center">
                    <span className="font-medium">{d.name}</span>
                    <div className="flex gap-2 text-xs text-zinc-500">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-100">{d.stage}</span>
                      <span>${d.value.toLocaleString()}</span>
                    </div>
                  </li>
                ))}
                {!company.deals.length && <li className="text-zinc-400 text-sm">No deals.</li>}
              </ul>
            </div>
          )}
        </div>

        {fields.timeline && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <h2 className="font-semibold mb-4">Activity Timeline</h2>
            <ActivityTimeline
              activities={company.activities.map(a => ({
                id: a.id,
                type: a.type,
                title: a.title,
                body: a.body,
                createdAt: a.createdAt.toISOString(),
                dealId: a.dealId ?? null,
              }))}
              tasks={company.tasks.map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                dueDate: t.dueDate ? t.dueDate.toISOString() : null,
                createdAt: t.createdAt.toISOString(),
              }))}
              showFilters
            />
          </div>
        )}
      </div>
    </div>
  )
}
