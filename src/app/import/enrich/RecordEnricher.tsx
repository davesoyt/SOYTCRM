'use client'

import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import { DatabaseZap, Upload } from 'lucide-react'
import type { EnrichMode, EnrichResult } from '@/lib/enrichRecords'

type EnrichTarget = {
  id: 'contact' | 'company' | 'opportunity'
  name: string
  keyFields: { key: string; label: string }[]
  updatableFields: { key: string; label: string }[]
}

function normalizeLabel(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export default function RecordEnricher({ targets }: { targets: EnrichTarget[] }) {
  const [targetId, setTargetId] = useState<EnrichTarget['id']>('contact')
  const [headers, setHeaders] = useState<string[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [csvKeyColumn, setCsvKeyColumn] = useState('')
  const [keyField, setKeyField] = useState('')
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<EnrichMode>('fill_empty')
  const [result, setResult] = useState<EnrichResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  const target = useMemo(() => targets.find((t) => t.id === targetId) ?? targets[0], [targetId, targets])

  function onUpload(file?: File) {
    if (!file) return
    setError('')
    setResult(null)
    setUploadedFile(file)
    setProgress('Reading CSV…')

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const cols = parsed.meta.fields ?? []
        setHeaders(cols)
        setRowCount(parsed.data.length)
        setCsvKeyColumn(cols[0] ?? '')
        setKeyField(target.keyFields[0]?.key ?? '')

        const byNorm = new Map(cols.map((h) => [normalizeLabel(h), h]))
        const nextMappings: Record<string, string> = {}
        for (const f of target.updatableFields) {
          const found = byNorm.get(normalizeLabel(f.label)) ?? byNorm.get(normalizeLabel(f.key))
          if (found) nextMappings[f.key] = found
        }
        setMappings(nextMappings)
        setProgress(null)
      },
      error: () => {
        setError('Could not parse the CSV file.')
        setUploadedFile(null)
        setProgress(null)
      },
    })
  }

  function onTargetChange(next: EnrichTarget['id']) {
    const t = targets.find((x) => x.id === next)
    setTargetId(next)
    setKeyField(t?.keyFields[0]?.key ?? '')
    setMappings({})
    setResult(null)
    setError('')
    setUploadedFile(null)
    setRowCount(0)
    setHeaders([])
  }

  async function runEnrich() {
    if (!uploadedFile || !rowCount) return setError('Upload a CSV first.')
    if (!csvKeyColumn || !keyField) return setError('Select both key columns.')
    const activeMappings = Object.fromEntries(Object.entries(mappings).filter(([, v]) => !!v))
    if (Object.keys(activeMappings).length === 0) return setError('Map at least one field to update.')

    setError('')
    setLoading(true)
    setProgress('Uploading and processing on server…')

    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)
      formData.append('meta', JSON.stringify({
        targetId,
        keyField,
        csvKeyColumn,
        mode,
        mappings: activeMappings,
      }))

      const res = await fetch('/api/import/enrich', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Enrich failed.')
        return
      }

      setResult(data as EnrichResult)
    } catch {
      setError('Enrich failed. Please check mapping and try again.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-8 max-w-5xl">
      <h2 className="text-lg font-semibold mb-4">Record Enrich from CSV</h2>
      <p className="text-sm text-zinc-500 mb-6">
        Upload a CSV, match a key column to existing records, and update selected fields.
        Large files are processed on the server to avoid upload size limits.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Target records</label>
          <select value={targetId} onChange={(e) => onTargetChange(e.target.value as EnrichTarget['id'])} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
            {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Update mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as EnrichMode)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
            <option value="fill_empty">Fill blanks only (preserve existing values)</option>
            <option value="overwrite">Overwrite existing values from CSV</option>
          </select>
        </div>

        <label className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 cursor-pointer hover:border-zinc-500 transition-colors flex items-center justify-center gap-2 text-sm">
          <Upload className="w-4 h-4" />
          {uploadedFile ? uploadedFile.name : 'Upload CSV'}
          <input type="file" accept=".csv" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
        </label>
      </div>

      {rowCount > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">CSV key column</label>
              <select value={csvKeyColumn} onChange={(e) => setCsvKeyColumn(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Database key field</label>
              <select value={keyField} onChange={(e) => setKeyField(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                {target.keyFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 p-4 mb-6">
            <p className="text-sm font-medium mb-3">Field mapping</p>
            <div className="space-y-2">
              {target.updatableFields.map((f) => (
                <div key={f.key} className="grid grid-cols-[1fr_1fr] gap-2 items-center">
                  <span className="text-sm text-zinc-700">{f.label}</span>
                  <select
                    value={mappings[f.key] ?? ''}
                    onChange={(e) => setMappings((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">— Ignore —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              {rowCount.toLocaleString()} CSV rows loaded
              {uploadedFile && <span className="text-zinc-400"> · {uploadedFile.name}</span>}
            </p>
            <button
              onClick={runEnrich}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 text-white px-4 py-2 text-sm font-medium hover:bg-zinc-700 disabled:opacity-50"
            >
              <DatabaseZap className="w-4 h-4" />
              {loading ? (progress ?? 'Applying…') : 'Run enrich'}
            </button>
          </div>
        </>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Processed {result.totalRows.toLocaleString()} rows · matched {result.matchedRows.toLocaleString()} · updated {result.updatedRows.toLocaleString()} · unmatched {result.unmatchedRows.toLocaleString()}
        </div>
      )}
    </div>
  )
}