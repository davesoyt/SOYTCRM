'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Building2, Phone, Mail, Link2, Sparkles, Pencil, Check, X, MapPin, Loader2, Plus, Trash2 } from 'lucide-react'
import ActivityTimeline from '@/components/ActivityTimeline'
import FieldCustomizer from '@/components/FieldCustomizer'
import { useFieldVisibility } from '@/lib/useFieldVisibility'
import { logActivity, enrichContact, updateContact, geocodeContact } from '@/app/actions'
import EnrollForm from './EnrollForm'

const FIELD_DEFS = [
  { key: 'contactInfo', label: 'Contact info (email/phone/LinkedIn)' },
  { key: 'location', label: 'Location / Address' },
  { key: 'leadScore', label: 'Lead Score' },
  { key: 'company', label: 'Company' },
  { key: 'deals', label: 'Deals' },
  { key: 'sequences', label: 'Sequences' },
  { key: 'activityLog', label: 'Log Activity' },
  { key: 'timeline', label: 'Activity Timeline' },
]

const DEFAULTS: Record<string, boolean> = Object.fromEntries(FIELD_DEFS.map(f => [f.key, true]))

type Props = {
  contact: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    title: string | null
    linkedin: string | null
    enriched: boolean
    leadScore: number
    customFields: string
    street: string | null
    city: string | null
    state: string | null
    zip: string | null
    country: string | null
    lat: number | null
    lng: number | null
    company: { id: string; name: string; industry: string | null; size: string | null } | null
    activities: { id: string; type: string; title: string; body: string | null; createdAt: Date; dealId?: string | null }[]
    deals: { id: string; name: string; stage: string; value: number }[]
    enrollments: { id: string; active: boolean; currentStep: number; sequenceId: string; startedAt: Date; sequence: { id: string; name: string } }[]
    tasks: { id: string; title: string; status: string; dueDate: Date | null; createdAt: Date }[]
  }
  sequences: { id: string; name: string }[]
  scoreLabel: string
  scoreColor: string
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
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
    </div>
  )
}

export default function ContactView({ contact, sequences, scoreLabel, scoreColor }: Props) {
  const { fields, toggle, reset, loaded } = useFieldVisibility(`contact:${contact.id}`, DEFAULTS)
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isGeocoding, setIsGeocoding] = useTransition()

  // Standard fields
  const [firstName, setFirstName] = useState(contact.firstName)
  const [lastName, setLastName] = useState(contact.lastName)
  const [email, setEmail] = useState(contact.email)
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [title, setTitle] = useState(contact.title ?? '')
  const [linkedin, setLinkedin] = useState(contact.linkedin ?? '')
  const [street, setStreet] = useState(contact.street ?? '')
  const [city, setCity] = useState(contact.city ?? '')
  const [state, setState] = useState(contact.state ?? '')
  const [zip, setZip] = useState(contact.zip ?? '')
  const [country, setCountry] = useState(contact.country ?? '')
  const [geocoded, setGeocoded] = useState(contact.lat != null)

  // Custom fields — parsed from JSON, editable as [{key, value}]
  const parsed: Record<string, string> = (() => { try { return JSON.parse(contact.customFields) } catch { return {} } })()
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>(
    () => Object.entries(parsed).map(([key, value]) => ({ key, value }))
  )

  const enrichAction = enrichContact.bind(null, contact.id)
  const locationLine = [contact.city, contact.state, contact.country].filter(Boolean).join(', ')

  function saveEdits() {
    startTransition(async () => {
      const customObj = Object.fromEntries(
        customFields.filter(f => f.key.trim()).map(f => [f.key.trim(), f.value])
      )
      await updateContact(contact.id, {
        firstName, lastName, email, phone, title, linkedin,
        street, city, state, zip, country, customFields: customObj,
      })
      setEditing(false)
    })
  }

  function cancelEdits() {
    setFirstName(contact.firstName); setLastName(contact.lastName)
    setEmail(contact.email); setPhone(contact.phone ?? '')
    setTitle(contact.title ?? ''); setLinkedin(contact.linkedin ?? '')
    setStreet(contact.street ?? ''); setCity(contact.city ?? '')
    setState(contact.state ?? ''); setZip(contact.zip ?? '')
    setCountry(contact.country ?? '')
    setCustomFields(Object.entries(parsed).map(([key, value]) => ({ key, value })))
    setEditing(false)
  }

  function doGeocode() {
    setIsGeocoding(async () => {
      await geocodeContact(contact.id)
      setGeocoded(true)
    })
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
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex-1 min-w-0 mr-4">
          {editing ? (
            <div className="space-y-4">
              {/* Standard fields */}
              <div className="flex gap-3">
                <EditInput label="First name" value={firstName} onChange={setFirstName} />
                <EditInput label="Last name" value={lastName} onChange={setLastName} />
              </div>
              <div className="flex gap-3">
                <EditInput label="Email" value={email} onChange={setEmail} type="email" />
                <EditInput label="Title" value={title} onChange={setTitle} />
              </div>
              <div className="flex gap-3">
                <EditInput label="Phone" value={phone} onChange={setPhone} type="tel" />
                <EditInput label="LinkedIn URL" value={linkedin} onChange={setLinkedin} />
              </div>
              <hr className="border-zinc-200" />
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Address</p>
              <EditInput label="Street" value={street} onChange={setStreet} />
              <div className="grid grid-cols-2 gap-3">
                <EditInput label="City" value={city} onChange={setCity} />
                <EditInput label="State / Region" value={state} onChange={setState} />
                <EditInput label="Zip / Postal" value={zip} onChange={setZip} />
                <EditInput label="Country" value={country} onChange={setCountry} />
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
                      placeholder="e.g. Referral Source"
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
              <h1 className="text-2xl font-bold">{firstName} {lastName}</h1>
              <p className="text-zinc-500 mt-1">{title || 'No title'}</p>

              {/* Unified field display — standard + custom, no visual distinction */}
              <div className="mt-4 bg-white rounded-xl border border-zinc-200 p-4 max-w-lg">
                {fields.contactInfo && (
                  <>
                    <FieldRow label="Email" value={email} />
                    <FieldRow label="Phone" value={phone || null} />
                    <FieldRow label="LinkedIn" value={linkedin || null} />
                  </>
                )}
                {fields.location && (
                  <>
                    <FieldRow label="Street" value={contact.street} />
                    {(contact.city || contact.state || contact.zip || contact.country) && (
                      <FieldRow label="Location"
                        value={[contact.city, contact.state, contact.zip, contact.country].filter(Boolean).join(', ')} />
                    )}
                    {contact.lat != null && (
                      <div className="flex items-baseline gap-2 py-1.5">
                        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide w-28 shrink-0">Geocoded</span>
                        <span className="text-xs text-green-600 font-medium">✓ lat/lng stored</span>
                      </div>
                    )}
                  </>
                )}
                {/* Custom fields shown inline — no separate section */}
                {customFields.map(f => f.key.trim() ? (
                  <FieldRow key={f.key} label={f.key} value={f.value} />
                ) : null)}
                {fields.contactInfo === false && fields.location === false && customFields.length === 0 && (
                  <p className="text-sm text-zinc-400 py-2">No fields visible.</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {editing ? (
            <>
              {(city || state || country) && (
                <button onClick={doGeocode} disabled={isGeocoding}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 transition-colors">
                  {isGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4 text-violet-500" />}
                  {geocoded ? 'Re-geocode' : 'Geocode'}
                </button>
              )}
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
              <form action={enrichAction}>
                <button type="submit"
                  className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors">
                  <Sparkles className="w-4 h-4 text-pink-500" />
                  {contact.enriched ? 'Re-enrich' : 'AI Enrich'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {fields.activityLog && !editing && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <h2 className="font-semibold mb-4">Log Activity</h2>
              <form action={logActivity} className="space-y-3">
                <input type="hidden" name="contactId" value={contact.id} />
                <div className="flex gap-2">
                  <select name="type" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                    <option value="email">Email</option>
                    <option value="call">Call</option>
                    <option value="note">Note</option>
                  </select>
                  <input name="title" required placeholder="Title" className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                </div>
                <textarea name="body" rows={2} placeholder="Details (optional)" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none" />
                <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">Log</button>
              </form>
            </div>
          )}

          {fields.timeline && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <h2 className="font-semibold mb-4">Activity Timeline</h2>
              <ActivityTimeline
                activities={contact.activities.map(a => ({
                  id: a.id,
                  type: a.type,
                  title: a.title,
                  body: a.body,
                  createdAt: a.createdAt.toISOString(),
                  dealId: a.dealId ?? null,
                }))}
                tasks={contact.tasks.map(t => ({
                  id: t.id,
                  title: t.title,
                  status: t.status,
                  dueDate: t.dueDate ? t.dueDate.toISOString() : null,
                  createdAt: t.createdAt.toISOString(),
                }))}
                enrollments={contact.enrollments.map(e => ({
                  id: e.id,
                  sequenceId: e.sequenceId,
                  sequence: { name: e.sequence.name },
                  startedAt: e.startedAt.toISOString(),
                  active: e.active,
                }))}
                showFilters
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {fields.leadScore && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <h2 className="font-semibold mb-3">Lead Score</h2>
              <div className="text-4xl font-bold mb-1">{contact.leadScore}</div>
              <span className={`text-sm font-semibold ${scoreColor}`}>{scoreLabel}</span>
              <div className="mt-3 w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div className="h-full rounded-full bg-zinc-900 transition-all" style={{ width: `${contact.leadScore}%` }} />
              </div>
            </div>
          )}

          {fields.company && contact.company && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4" /> Company</h2>
              <Link href={`/companies/${contact.company.id}`} className="font-medium hover:underline text-zinc-900">{contact.company.name}</Link>
              {contact.company.industry && <p className="text-xs text-zinc-500 mt-1">{contact.company.industry}</p>}
              {contact.company.size && <p className="text-xs text-zinc-500">{contact.company.size} employees</p>}
            </div>
          )}

          {fields.deals && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <h2 className="font-semibold mb-3">Deals</h2>
              {contact.deals.length ? (
                <ul className="space-y-2">
                  {contact.deals.map(d => (
                    <li key={d.id} className="text-sm">
                      <span className="font-medium">{d.name}</span>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100">{d.stage}</span>
                        <span>${d.value.toLocaleString()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-400">No deals yet.</p>
              )}
            </div>
          )}

          {fields.sequences && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <h2 className="font-semibold mb-3">Sequences</h2>
              {contact.enrollments.filter(e => e.active).length > 0 && (
                <div className="mb-3 space-y-1">
                  {contact.enrollments.filter(e => e.active).map(e => (
                    <div key={e.id} className="text-xs px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                      Active: {e.sequence.name} (step {e.currentStep + 1})
                    </div>
                  ))}
                </div>
              )}
              <EnrollForm contactId={contact.id} sequences={sequences} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
