'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import {
  Upload, ArrowRight, CheckCircle2, Building2, Users,
  AlertTriangle, ChevronRight, Plus, X, Sparkles, Lock,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  checkImportConflicts,
  bulkImportCompanies,
  bulkImportContacts,
  type ImportTask,
  type ImportConflict,
} from '@/app/actions'

// ── Fuzzy alias map ────────────────────────────────────────────────────────────
const FIELD_ALIASES: Record<string, string[]> = {
  firstName:  ['first name', 'first_name', 'firstname', 'given name', 'given_name', 'forename', 'fname', 'f name'],
  lastName:   ['last name', 'last_name', 'lastname', 'surname', 'family name', 'family_name', 'lname', 'l name'],
  email:      ['email', 'email address', 'email_address', 'e-mail', 'e_mail', 'mail', 'work email', 'business email'],
  phone:      ['phone', 'phone number', 'phone_number', 'telephone', 'tel', 'mobile', 'mobile number', 'cell', 'cell phone', 'contact number'],
  title:      ['title', 'job title', 'job_title', 'position', 'role', 'designation', 'job function', 'function', 'occupation'],
  linkedin:   ['linkedin', 'linkedin url', 'linkedin_url', 'linkedin profile', 'linkedin link', 'li', 'li url'],
  name:       ['company', 'company name', 'company_name', 'organization', 'organisation', 'org', 'account', 'account name', 'employer'],
  domain:     ['domain', 'email domain', 'company domain', 'web domain'],
  industry:   ['industry', 'sector', 'vertical', 'market', 'business type'],
  size:       ['size', 'company size', 'company_size', 'employees', 'num employees', 'number of employees', 'headcount', 'team size', 'staff'],
  website:    ['website', 'url', 'web', 'homepage', 'company url', 'company website', 'site', 'web address'],
}

function fuzzyMatch(header: string, field: { key: string; name: string }): boolean {
  const h = header.toLowerCase().trim()
  const aliases = FIELD_ALIASES[field.key] ?? []
  return (
    h === field.key.toLowerCase() ||
    h === field.name.toLowerCase() ||
    aliases.includes(h) ||
    (h.length >= 4 && field.key.toLowerCase().includes(h)) ||
    (field.key.length >= 4 && h.includes(field.key.toLowerCase()))
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Target = {
  id: 'contact' | 'company'
  name: string
  fields: { key: string; name: string }[]
}

type CustomFieldDef = { csvCol: string; fieldName: string }

type Step = 1 | 2 | 2.5 | 3

// ── Component ──────────────────────────────────────────────────────────────────
export default function CsvImporter({ targets }: { targets: Target[] }) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Array<'contact' | 'company'>>([])
  const [csvData, setCsvData] = useState<Record<string, string>[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [mappings, setMappings] = useState<Record<string, Record<string, string>>>({})
  const [customFieldDefs, setCustomFieldDefs] = useState<Record<string, CustomFieldDef[]>>({})
  // fieldKey → hardcoded value that overrides the CSV for every record
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({})
  // set of fieldKeys that must be non-empty or the record is skipped
  const [skipIfBlank, setSkipIfBlank] = useState<Record<string, Set<string>>>({})
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [conflicts, setConflicts] = useState<ImportConflict[]>([])
  const [resolvedTasks, setResolvedTasks] = useState<ImportTask[]>([])

  function toggleTarget(id: 'contact' | 'company') {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  function autoMatch(headers: string[]) {
    const newMappings: Record<string, Record<string, string>> = {}
    for (const id of selectedIds) {
      const target = targets.find((t) => t.id === id)
      if (!target) continue
      newMappings[id] = {}
      for (const field of target.fields) {
        const match = headers.find((h) => fuzzyMatch(h, field))
        if (match) newMappings[id][field.key] = match
      }
    }
    setMappings(newMappings)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? []
        setCsvHeaders(headers)
        setCsvData(results.data)
        autoMatch(headers)
        setStep(2)
      },
    })
  }

  function getUnmappedCols(targetId: string): string[] {
    const usedCols = new Set(Object.values(mappings[targetId] ?? {}))
    for (const [tid, defs] of Object.entries(customFieldDefs)) {
      if (tid !== targetId) defs.forEach((d) => usedCols.add(d.csvCol))
    }
    return csvHeaders.filter((h) => !usedCols.has(h))
  }

  function addCustomField(targetId: string, csvCol: string) {
    const fieldName = csvCol.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    setCustomFieldDefs((prev) => ({
      ...prev,
      [targetId]: [...(prev[targetId] ?? []), { csvCol, fieldName }],
    }))
  }

  function updateCustomFieldName(targetId: string, csvCol: string, fieldName: string) {
    setCustomFieldDefs((prev) => ({
      ...prev,
      [targetId]: (prev[targetId] ?? []).map((d) =>
        d.csvCol === csvCol ? { ...d, fieldName } : d,
      ),
    }))
  }

  function removeCustomField(targetId: string, csvCol: string) {
    setCustomFieldDefs((prev) => ({
      ...prev,
      [targetId]: (prev[targetId] ?? []).filter((d) => d.csvCol !== csvCol),
    }))
  }

  function setOverride(targetId: string, fieldKey: string, value: string) {
    setOverrides((prev) => ({
      ...prev,
      [targetId]: { ...(prev[targetId] ?? {}), [fieldKey]: value },
    }))
  }

  function toggleSkipIfBlank(targetId: string, fieldKey: string) {
    setSkipIfBlank((prev) => {
      const set = new Set(prev[targetId] ?? [])
      set.has(fieldKey) ? set.delete(fieldKey) : set.add(fieldKey)
      return { ...prev, [targetId]: set }
    })
  }

  function buildTasks(): ImportTask[] {
    return selectedIds.map((targetId) => {
      const target = targets.find((t) => t.id === targetId)!
      const mapping = mappings[targetId] ?? {}
      const defs = customFieldDefs[targetId] ?? []
      const targetOverrides = overrides[targetId] ?? {}
      const skipFields = skipIfBlank[targetId] ?? new Set<string>()

      const mappedData = csvData
        .map((row) => {
          const obj: Record<string, string> = {}

          if (targetId === 'contact' && mapping['_companyAssociation']) {
            obj['_companyAssociation'] = row[mapping['_companyAssociation']] ?? ''
          }

          for (const field of target.fields) {
            // Override takes precedence over CSV
            if (targetOverrides[field.key] !== undefined && targetOverrides[field.key] !== '') {
              obj[field.key] = targetOverrides[field.key]
            } else {
              const col = mapping[field.key]
              if (col && row[col]) obj[field.key] = row[col]
            }
          }

          // Custom fields
          if (defs.length > 0) {
            const custom: Record<string, string> = {}
            for (const def of defs) {
              if (def.fieldName.trim() && row[def.csvCol] !== undefined && row[def.csvCol] !== '') {
                custom[def.fieldName.trim()] = row[def.csvCol]
              }
            }
            if (Object.keys(custom).length > 0) obj['_customFields'] = JSON.stringify(custom)
          }

          return obj
        })
        .filter((obj) => {
          // Drop record if any "skip if blank" field is empty after mapping + overrides
          for (const fieldKey of skipFields) {
            const val = obj[fieldKey]
            if (!val || val.trim() === '') return false
          }
          return true
        })

      return { targetId, mappedData }
    })
  }

  async function handleImport() {
    setLoading(true)
    try {
      const tasks = buildTasks()
      const found = await checkImportConflicts(tasks)
      if (found.length) {
        setConflicts(found)
        setResolvedTasks(tasks)
        setStep(2.5)
        return
      }
      await runImport(tasks)
    } finally {
      setLoading(false)
    }
  }

  async function runImport(tasks: ImportTask[]) {
    const companyTask = tasks.find((t) => t.targetId === 'company')
    const contactTask = tasks.find((t) => t.targetId === 'contact')
    let companyMap: Record<string, string> = {}
    if (companyTask) companyMap = await bulkImportCompanies(companyTask.mappedData)
    if (contactTask) await bulkImportContacts(contactTask.mappedData, companyMap)
    router.refresh()
    setStep(3)
  }

  function resolveConflict(index: number, action: 'skip' | 'overwrite') {
    const conflict = conflicts[index]
    const remaining = conflicts.filter((_, i) => i !== index)
    setConflicts(remaining)
    if (action === 'skip') {
      setResolvedTasks((prev) =>
        prev.map((task) => {
          if (task.targetId !== conflict.targetId) return task
          return {
            ...task,
            mappedData: task.mappedData.filter((row) => {
              if (conflict.targetId === 'contact') return row.email !== conflict.identifier
              if (conflict.targetId === 'company') return row.name !== conflict.identifier
              return true
            }),
          }
        }),
      )
    }
    if (remaining.length === 0) {
      setLoading(true)
      runImport(resolvedTasks).finally(() => setLoading(false))
    }
  }

  function reset() {
    setStep(1)
    setSelectedIds([])
    setCsvData([])
    setCsvHeaders([])
    setMappings({})
    setCustomFieldDefs({})
    setOverrides({})
    setSkipIfBlank({})
    setConflicts([])
  }

  // Preview: how many rows would be imported after skip-if-blank filtering
  function previewCount(targetId: string): { total: number; skipped: number } {
    const target = targets.find((t) => t.id === targetId)!
    const mapping = mappings[targetId] ?? {}
    const targetOverrides = overrides[targetId] ?? {}
    const skipFields = skipIfBlank[targetId] ?? new Set<string>()
    if (!skipFields.size) return { total: csvData.length, skipped: 0 }

    let skipped = 0
    for (const row of csvData) {
      for (const fieldKey of skipFields) {
        const overrideVal = targetOverrides[fieldKey]
        const val = (overrideVal !== undefined && overrideVal !== '')
          ? overrideVal
          : (mapping[fieldKey] ? row[mapping[fieldKey]] : '')
        if (!val || val.trim() === '') { skipped++; break }
      }
    }
    return { total: csvData.length, skipped }
  }

  const targetIcon = (id: string) =>
    id === 'company' ? <Building2 className="w-4 h-4" /> : <Users className="w-4 h-4" />

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-8 max-w-4xl">

      {/* Step 1: Select & Upload */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold mb-6">Step 1: Select objects & upload CSV</h2>
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 mb-2">Import into</label>
            <div className="flex gap-3">
              {targets.map((t) => {
                const active = selectedIds.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTarget(t.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      active
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-300 text-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    {targetIcon(t.id)}
                    {t.name}
                  </button>
                )
              })}
            </div>
          </div>

          <label
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
              selectedIds.length
                ? 'border-zinc-300 hover:border-zinc-500 cursor-pointer'
                : 'border-zinc-200 cursor-not-allowed opacity-50'
            }`}
          >
            <Upload className="w-8 h-8 text-zinc-400" />
            <div>
              <p className="text-sm font-medium text-zinc-700">Upload a .csv file to continue</p>
              <p className="text-xs text-zinc-400 mt-1">Fields are auto-matched intelligently — unmapped columns can become custom fields</p>
            </div>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              disabled={selectedIds.length === 0}
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}

      {/* Step 2: Map fields */}
      {step === 2 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Step 2: Map columns, set overrides & skip rules</h2>
            <div className="flex gap-2">
              {selectedIds.map((id) => (
                <span key={id} className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-zinc-100 text-zinc-700">
                  {targetIcon(id)}
                  {targets.find((t) => t.id === id)?.name}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {selectedIds.map((targetId) => {
              const target = targets.find((t) => t.id === targetId)!
              const unmapped = getUnmappedCols(targetId)
              const defs = customFieldDefs[targetId] ?? []
              const matchedCount = Object.values(mappings[targetId] ?? {}).filter(Boolean).length
              const { total, skipped } = previewCount(targetId)

              return (
                <div key={targetId} className="border border-zinc-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="flex items-center gap-2 font-semibold">
                      {targetIcon(targetId)} {target.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      {skipped > 0 && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          {skipped} rows will be skipped
                        </span>
                      )}
                      {matchedCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <Sparkles className="w-3 h-3" />
                          {matchedCount} auto-matched
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mb-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Override = hardcoded value for every record</span>
                    <span>Skip if blank = drop record when this field is empty</span>
                  </div>

                  {/* Field mapping table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-100">
                          <th className="text-left py-2 font-medium text-zinc-500 w-[22%]">CRM Field</th>
                          <th className="text-left py-2 font-medium text-zinc-500 w-[28%]">CSV Column</th>
                          <th className="text-left py-2 font-medium text-zinc-500 w-[35%]">
                            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Override value</span>
                          </th>
                          <th className="text-center py-2 font-medium text-zinc-500 w-[15%]">Skip if blank</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {target.fields.map((f) => {
                          const mapped = !!mappings[targetId]?.[f.key]
                          const override = overrides[targetId]?.[f.key] ?? ''
                          const isSkip = (skipIfBlank[targetId] ?? new Set()).has(f.key)
                          const hasOverride = override.trim() !== ''

                          return (
                            <tr key={f.key} className={hasOverride ? 'bg-amber-50' : ''}>
                              <td className="py-2 pr-2 text-zinc-700">
                                <div className="flex items-center gap-1.5">
                                  {f.name}
                                  {mapped && !hasOverride && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
                                  {hasOverride && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                                </div>
                              </td>
                              <td className="py-2 pr-2">
                                <select
                                  disabled={hasOverride}
                                  className={`w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${
                                    mapped && !hasOverride ? 'border-green-300 bg-green-50' : 'border-zinc-300'
                                  }`}
                                  value={mappings[targetId]?.[f.key] ?? ''}
                                  onChange={(e) =>
                                    setMappings({
                                      ...mappings,
                                      [targetId]: { ...mappings[targetId], [f.key]: e.target.value },
                                    })
                                  }
                                >
                                  <option value="">— Ignore —</option>
                                  {csvHeaders.map((h) => (
                                    <option key={h} value={h}>{h}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  value={override}
                                  onChange={(e) => setOverride(targetId, f.key, e.target.value)}
                                  placeholder="Leave blank to use CSV…"
                                  className={`w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                                    hasOverride
                                      ? 'border-amber-300 bg-amber-50 text-amber-900 font-medium'
                                      : 'border-zinc-200 text-zinc-600'
                                  }`}
                                />
                              </td>
                              <td className="py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSkip}
                                  disabled={hasOverride}
                                  onChange={() => toggleSkipIfBlank(targetId, f.key)}
                                  title={hasOverride ? 'Override is set — field will never be blank' : 'Skip record if this field is empty'}
                                  className="rounded border-zinc-300 text-red-500 focus:ring-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </td>
                            </tr>
                          )
                        })}

                        {/* Company association row for contacts */}
                        {targetId === 'contact' && selectedIds.includes('company') && (
                          <tr className="bg-blue-50">
                            <td className="py-2 font-semibold text-blue-700">Link to Company</td>
                            <td className="py-2" colSpan={3}>
                              <select
                                className="w-full rounded-lg border border-blue-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={mappings['contact']?.['_companyAssociation'] ?? ''}
                                onChange={(e) =>
                                  setMappings({
                                    ...mappings,
                                    contact: { ...mappings['contact'], _companyAssociation: e.target.value },
                                  })
                                }
                              >
                                <option value="">— Select column —</option>
                                {csvHeaders.map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Skip summary */}
                  {(skipIfBlank[targetId]?.size ?? 0) > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="text-xs text-zinc-400 self-center">Skip if blank:</span>
                      {[...(skipIfBlank[targetId] ?? [])].map(key => {
                        const field = target.fields.find(f => f.key === key)
                        return (
                          <span key={key} className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {field?.name ?? key}
                            <button onClick={() => toggleSkipIfBlank(targetId, key)}>
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Unmapped columns → custom fields */}
                  {(unmapped.length > 0 || defs.length > 0) && (
                    <div className="mt-5 pt-4 border-t border-zinc-100">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                        Unmapped Columns
                      </p>
                      <div className="space-y-2">
                        {unmapped.map((col) => {
                          const def = defs.find((d) => d.csvCol === col)
                          return (
                            <div key={col} className="flex items-center gap-2 text-sm">
                              <span className="flex-1 text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 rounded px-2 py-1 truncate">
                                {col}
                              </span>
                              {def ? (
                                <>
                                  <ArrowRight className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                                  <input
                                    value={def.fieldName}
                                    onChange={(e) => updateCustomFieldName(targetId, col, e.target.value)}
                                    placeholder="Custom field name"
                                    className="w-40 rounded-lg border border-violet-300 bg-violet-50 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                                  />
                                  <button
                                    onClick={() => removeCustomField(targetId, col)}
                                    className="text-zinc-300 hover:text-red-400 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => addCustomField(targetId, col)}
                                  className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium whitespace-nowrap transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add as custom field
                                </button>
                              )}
                            </div>
                          )
                        })}
                        {unmapped.length === 0 && defs.length > 0 && (
                          <p className="text-xs text-zinc-300 italic">All columns mapped</p>
                        )}
                      </div>

                      {defs.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {defs.map((d) => (
                            <span key={d.csvCol} className="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                              {d.fieldName || d.csvCol}
                              <button onClick={() => removeCustomField(targetId, d.csvCol)}>
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Import preview count */}
                  <p className="mt-4 text-xs text-zinc-400">
                    {skipped > 0
                      ? <><span className="text-red-500 font-medium">{skipped} rows</span> will be skipped · <span className="font-medium text-zinc-600">{total - skipped}</span> will be imported</>
                      : <><span className="font-medium text-zinc-600">{total}</span> rows ready to import</>
                    }
                  </p>
                </div>
              )
            })}
          </div>

          <div className="flex justify-between mt-8">
            <button onClick={() => setStep(1)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors">
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Importing…' : `Import records`}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2.5: Conflict resolution */}
      {step === 2.5 && (
        <div>
          <div className="flex items-center gap-3 mb-2 text-orange-600">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Data Conflicts Detected</h2>
          </div>
          <p className="text-sm text-zinc-500 mb-6">
            {conflicts.length} record{conflicts.length !== 1 ? 's' : ''} already exist with different data. Choose how to handle each one.
          </p>

          <div className="space-y-4 max-h-[500px] overflow-y-auto mb-6">
            {conflicts.map((c, i) => (
              <div key={i} className="border border-zinc-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-orange-100 text-orange-700">{c.type}</span>
                    <p className="font-semibold mt-1">{c.identifier}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolveConflict(i, 'skip')}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 transition-colors"
                    >
                      Keep existing
                    </button>
                    <button
                      onClick={() => resolveConflict(i, 'overwrite')}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
                    >
                      Update with import
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(c.diffs).map(([field, diff]) => (
                    <div key={field} className="bg-zinc-50 rounded-lg p-2.5 text-xs">
                      <p className="text-zinc-400 uppercase tracking-wide text-[10px] mb-1">{field}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-red-500 line-through">{diff.current}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-400 shrink-0" />
                        <span className="text-green-600 font-medium">{diff.import}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors">
              Back to mapping
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => { setConflicts([]); runImport(resolvedTasks) }}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors"
              >
                Keep all existing
              </button>
              <button
                onClick={() => { setConflicts([]); setLoading(true); runImport(resolvedTasks).finally(() => setLoading(false)) }}
                disabled={loading}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Importing…' : 'Overwrite all'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {step === 3 && (
        <div className="text-center py-12">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
          <h2 className="text-xl font-semibold mb-2">Import Successful!</h2>
          <p className="text-zinc-500 mb-8">{csvData.length} rows were processed.</p>
          <div className="flex justify-center gap-3">
            <button onClick={reset} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors">
              Import another file
            </button>
            <button onClick={() => router.push('/contacts')} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
              View contacts
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
