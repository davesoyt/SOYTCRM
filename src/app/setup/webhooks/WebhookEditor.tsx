'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Plus, Copy, Check, Save, ArrowRight } from 'lucide-react'
import {
  addWebhookTargetFields,
  deleteWebhookIntegration,
  getWebhookFieldOptions,
  saveWebhookIntegration,
} from '@/app/actions'
import type { SaveWebhookIntegrationInput } from '@/lib/actionTypes'
import {
  STRIPE_EVENT_OPTIONS,
  STRIPE_PATH_HINTS,
  integrationFromRow,
  type WebhookFieldMapping,
  type WebhookFieldTransform,
} from '@/lib/webhooks/types'

type TargetOption = { kind: 'standard' | 'custom'; slug: string; label: string }
type FieldOption = { key: string; label: string }

type IntegrationRow = {
  id: string
  name: string
  provider: string
  enabled: boolean
  targetKind: string
  targetSlug: string
  eventTypes: string
  fieldMappings: string
  upsertFieldKey: string
  webhookSecret: string
}

const TRANSFORMS: { value: WebhookFieldTransform; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'amount_major', label: 'Amount (÷100)' },
  { value: 'amount_display', label: 'Amount + currency' },
  { value: 'unix_date', label: 'Unix → date' },
]

const VB_STARTER_MAPPINGS: WebhookFieldMapping[] = [
  { sourcePath: 'data.object.metadata.business_name', targetField: 'business_name', transform: 'text' },
  { sourcePath: 'data.object.description', targetField: 'business_name', transform: 'text' },
  { sourcePath: 'data.object.created', targetField: 'date', transform: 'unix_date' },
  { staticValue: 'stripe', targetField: 'source', sourcePath: '' },
  { sourcePath: 'data.object.amount_received', targetField: 'amount', transform: 'amount_display' },
  { sourcePath: 'data.object.id', targetField: 'trx_id', transform: 'text' },
  { sourcePath: 'id', targetField: 'notes', transform: 'text' },
]

function slugifyFieldKey(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function humanizeFieldKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function isMissingFieldKey(key: string, existingKeys: Set<string>) {
  const k = slugifyFieldKey(key)
  return k.length > 0 && !existingKeys.has(k)
}

export default function WebhookEditor({
  integration,
  targetOptions,
  appOrigin,
}: {
  integration: IntegrationRow
  targetOptions: TargetOption[]
  appOrigin: string
}) {
  const router = useRouter()
  const initial = useMemo(() => integrationFromRow(integration), [integration])

  const [name, setName] = useState(initial.name)
  const [enabled, setEnabled] = useState(initial.enabled)
  const [targetKind, setTargetKind] = useState<'standard' | 'custom'>(initial.targetKind)
  const [targetSlug, setTargetSlug] = useState(initial.targetSlug)
  const [eventTypes, setEventTypes] = useState<string[]>(initial.eventTypes)
  const [fieldMappings, setFieldMappings] = useState<WebhookFieldMapping[]>(initial.fieldMappings)
  const [upsertFieldKey, setUpsertFieldKey] = useState(initial.upsertFieldKey)
  const [webhookSecret, setWebhookSecret] = useState(initial.webhookSecret)
  const [objectFields, setObjectFields] = useState<FieldOption[]>([])
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({})
  const [addingFields, setAddingFields] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const webhookUrl = `${appOrigin}/api/webhooks/stripe/${integration.id}`

  const loadFields = useCallback(async (kind: 'standard' | 'custom', slug: string) => {
    const fields = await getWebhookFieldOptions(kind, slug)
    setObjectFields(fields)
  }, [])

  useEffect(() => {
    void loadFields(targetKind, targetSlug)
  }, [targetKind, targetSlug, loadFields])

  const existingFieldKeys = useMemo(
    () => new Set(objectFields.map((f) => f.key)),
    [objectFields],
  )

  const missingFields = useMemo(() => {
    const map = new Map<string, { sourcePaths: string[] }>()
    const track = (rawKey: string, sourcePath?: string) => {
      const key = slugifyFieldKey(rawKey)
      if (!key || existingFieldKeys.has(key)) return
      const cur = map.get(key) ?? { sourcePaths: [] }
      const src = sourcePath?.trim()
      if (src && !cur.sourcePaths.includes(src)) cur.sourcePaths.push(src)
      map.set(key, cur)
    }
    if (upsertFieldKey.trim()) track(upsertFieldKey)
    for (const m of fieldMappings) {
      if (m.targetField.trim()) {
        track(m.targetField, m.staticValue || m.sourcePath)
      }
    }
    return [...map.entries()].map(([key, meta]) => ({ key, ...meta }))
  }, [fieldMappings, upsertFieldKey, existingFieldKeys])

  async function addMissingFieldsToObject(keys?: string[]) {
    const wanted = new Set(keys ?? missingFields.map((f) => f.key))
    const toAdd = missingFields
      .filter((f) => wanted.has(f.key))
      .map((f) => ({
        key: f.key,
        label: fieldLabels[f.key]?.trim() || humanizeFieldKey(f.key),
      }))
    if (!toAdd.length) return

    setAddingFields(true)
    try {
      const updated = await addWebhookTargetFields(targetKind, targetSlug, toAdd)
      setObjectFields(updated)
      setFieldMappings((prev) =>
        prev.map((m) => ({
          ...m,
          targetField: m.targetField ? slugifyFieldKey(m.targetField) : m.targetField,
        })),
      )
      if (upsertFieldKey.trim()) setUpsertFieldKey(slugifyFieldKey(upsertFieldKey))
    } finally {
      setAddingFields(false)
    }
  }

  function setFieldLabel(key: string, label: string) {
    setFieldLabels((prev) => ({ ...prev, [key]: label }))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const input: SaveWebhookIntegrationInput = {
      name,
      enabled,
      targetKind,
      targetSlug,
      eventTypes,
      fieldMappings: fieldMappings.filter((m) => m.targetField.trim()),
      upsertFieldKey,
      webhookSecret,
    }
    await saveWebhookIntegration(integration.id, input)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleDelete() {
    if (!confirm('Delete this webhook integration?')) return
    await deleteWebhookIntegration(integration.id)
    router.push('/setup/webhooks')
  }

  function toggleEvent(value: string) {
    setEventTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  function updateMapping(index: number, patch: Partial<WebhookFieldMapping>) {
    setFieldMappings((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  function addMapping() {
    setFieldMappings((prev) => [...prev, { sourcePath: '', targetField: '', transform: 'text' }])
  }

  function removeMapping(index: number) {
    setFieldMappings((prev) => prev.filter((_, i) => i !== index))
  }

  function applyVbStarter() {
    setFieldMappings(VB_STARTER_MAPPINGS)
    setUpsertFieldKey('trx_id')
    setEventTypes(['payment_intent.succeeded', 'charge.succeeded', 'invoice.paid'])
  }

  function handleTargetChange(value: string) {
    const opt = targetOptions.find((o) => `${o.kind}:${o.slug}` === value)
    if (!opt) return
    setTargetKind(opt.kind)
    setTargetSlug(opt.slug)
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const targetValue = `${targetKind}:${targetSlug}`

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Edit webhook</h1>
          <p className="text-sm text-zinc-500 mt-0.5 capitalize">{integration.provider} integration</p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">General</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-1">Name</label>
            <input
              className="w-full text-sm border border-zinc-200 rounded-md px-2.5 py-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded accent-violet-600"
              />
              Enabled
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Stripe endpoint URL</h2>
        <p className="text-xs text-zinc-600">
          Add this URL in Stripe → Developers → Webhooks → Add endpoint. Use the signing secret below in
          both Stripe and this form.
        </p>
        <div className="flex gap-2">
          <code className="flex-1 text-xs bg-white border border-zinc-200 rounded-md px-3 py-2 break-all">
            {webhookUrl}
          </code>
          <button
            type="button"
            onClick={() => void copyUrl()}
            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 block mb-1">Signing secret (whsec_…)</label>
          <input
            type="password"
            className="w-full text-sm border border-zinc-200 rounded-md px-2.5 py-1.5 font-mono"
            placeholder="whsec_..."
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">Target object</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-1">Object</label>
            <select
              className="w-full text-sm border border-zinc-200 rounded-md px-2.5 py-1.5 bg-white"
              value={targetValue}
              onChange={(e) => handleTargetChange(e.target.value)}
            >
              {targetOptions.map((o) => (
                <option key={`${o.kind}:${o.slug}`} value={`${o.kind}:${o.slug}`}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-1">Upsert / match field</label>
            <input
              list="object-field-options"
              className={`w-full text-sm border rounded-md px-2.5 py-1.5 font-mono ${
                isMissingFieldKey(upsertFieldKey, existingFieldKeys)
                  ? 'border-violet-300 bg-violet-50'
                  : 'border-zinc-200 bg-white'
              }`}
              placeholder="e.g. trx_id"
              value={upsertFieldKey}
              onChange={(e) => setUpsertFieldKey(e.target.value)}
            />
            <p className="text-[10px] text-zinc-400 mt-1">
              Used to find existing records before create vs update. Type a new field key if needed.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Stripe events</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {STRIPE_EVENT_OPTIONS.map((ev) => (
            <label key={ev.value} className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={eventTypes.includes(ev.value)}
                onChange={() => toggleEvent(ev.value)}
                className="rounded accent-violet-600"
              />
              {ev.label}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Field mappings</h2>
          <div className="flex gap-2">
            {targetSlug === 'vb' && (
              <button
                type="button"
                onClick={applyVbStarter}
                className="text-xs font-medium text-violet-700 hover:text-violet-900"
              >
                Load Venue Billing preset
              </button>
            )}
            <button
              type="button"
              onClick={addMapping}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 hover:text-zinc-900"
            >
              <Plus className="w-3.5 h-3.5" />
              Add row
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Map Stripe payload paths to object fields. Pick an existing field or type a new key — missing fields
          can be added to the object below (like CSV import).
        </p>

        <datalist id="stripe-path-hints">
          {STRIPE_PATH_HINTS.map((h) => (
            <option key={h.path} value={h.path}>
              {h.label}
            </option>
          ))}
        </datalist>
        <datalist id="object-field-options">
          {objectFields.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </datalist>

        <div className="space-y-2">
          {fieldMappings.length === 0 && (
            <p className="text-xs text-zinc-400 italic py-4 text-center border border-dashed border-zinc-200 rounded-lg">
              No mappings yet — add a row or load the Venue Billing preset.
            </p>
          )}
          {fieldMappings.map((m, i) => (
            <div
              key={i}
              className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto] items-end border border-zinc-100 rounded-lg p-3 bg-zinc-50/50"
            >
              <div>
                <label className="text-[10px] font-medium text-zinc-500 block mb-0.5">Stripe path</label>
                <input
                  list="stripe-path-hints"
                  className="w-full text-xs border border-zinc-200 rounded px-2 py-1.5 font-mono"
                  placeholder="data.object.id"
                  value={m.sourcePath}
                  onChange={(e) => updateMapping(i, { sourcePath: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 block mb-0.5">Object field</label>
                <input
                  list="object-field-options"
                  className={`w-full text-xs border rounded px-2 py-1.5 font-mono ${
                    isMissingFieldKey(m.targetField, existingFieldKeys)
                      ? 'border-violet-300 bg-violet-50'
                      : 'border-zinc-200 bg-white'
                  }`}
                  placeholder="field_key"
                  value={m.targetField}
                  onChange={(e) => updateMapping(i, { targetField: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 block mb-0.5">Transform</label>
                <select
                  className="text-xs border border-zinc-200 rounded px-2 py-1.5 bg-white"
                  value={m.transform ?? 'text'}
                  onChange={(e) =>
                    updateMapping(i, { transform: e.target.value as WebhookFieldTransform })
                  }
                >
                  {TRANSFORMS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 block mb-0.5">Static</label>
                <input
                  className="w-24 text-xs border border-zinc-200 rounded px-2 py-1.5"
                  placeholder="optional"
                  value={m.staticValue ?? ''}
                  onChange={(e) => updateMapping(i, { staticValue: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={() => removeMapping(i)}
                className="text-zinc-400 hover:text-red-600 p-1"
                title="Remove mapping"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {missingFields.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                Missing object fields
              </p>
              <button
                type="button"
                disabled={addingFields}
                onClick={() => void addMissingFieldsToObject()}
                className="text-xs font-medium text-violet-700 hover:text-violet-900 disabled:opacity-50"
              >
                {addingFields ? 'Adding…' : `Add all ${missingFields.length} to object`}
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              These mapped field keys are not on the target object yet. Add them here (like CSV import custom
              fields) before webhooks can write data.
            </p>
            <div className="space-y-2">
              {missingFields.map((f) => (
                <div key={f.key} className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 rounded px-2 py-1 font-mono truncate max-w-[40%]">
                    {f.sourcePaths[0] || f.key}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                  <input
                    value={fieldLabels[f.key] ?? humanizeFieldKey(f.key)}
                    onChange={(e) => setFieldLabel(f.key, e.target.value)}
                    placeholder="Field label"
                    className="w-40 rounded-lg border border-violet-300 bg-violet-50 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <span className="text-[10px] text-zinc-400 font-mono">({f.key})</span>
                  <button
                    type="button"
                    disabled={addingFields}
                    onClick={() => void addMissingFieldsToObject([f.key])}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium whitespace-nowrap transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" />
                    Add to object
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => void handleDelete()}
          className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" />
          Delete webhook
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
