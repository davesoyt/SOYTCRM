'use client'

import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Download, FileSpreadsheet, Link2, Plus, Trash2 } from 'lucide-react'

type CsvRow = Record<string, string>
type Side = 'left' | 'right'
type LayoutField = {
  id: string
  source: Side
  field: string
  label: string
}

function parseCsv(file: File): Promise<{ rows: CsvRow[]; headers: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve({ rows: results.data, headers: results.meta.fields ?? [] }),
      error: reject,
    })
  })
}

export default function FileMergeTool() {
  const [leftRows, setLeftRows] = useState<CsvRow[]>([])
  const [rightRows, setRightRows] = useState<CsvRow[]>([])
  const [leftHeaders, setLeftHeaders] = useState<string[]>([])
  const [rightHeaders, setRightHeaders] = useState<string[]>([])
  const [leftKey, setLeftKey] = useState('')
  const [rightKey, setRightKey] = useState('')
  const [layout, setLayout] = useState<LayoutField[]>([])
  const [error, setError] = useState('')

  async function handleUpload(side: Side, file?: File) {
    if (!file) return
    try {
      setError('')
      const parsed = await parseCsv(file)
      if (side === 'left') {
        setLeftRows(parsed.rows)
        setLeftHeaders(parsed.headers)
        setLeftKey(parsed.headers[0] ?? '')
      } else {
        setRightRows(parsed.rows)
        setRightHeaders(parsed.headers)
        setRightKey(parsed.headers[0] ?? '')
      }
    } catch {
      setError('Could not parse that CSV file.')
    }
  }

  function addLayoutField(source: Side, field: string) {
    if (!field) return
    setLayout((prev) => [
      ...prev,
      { id: `${source}:${field}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`, source, field, label: field },
    ])
  }

  const mergedCount = useMemo(() => {
    if (!leftKey || !rightKey || leftRows.length === 0 || rightRows.length === 0) return 0
    const rightMap = new Map<string, CsvRow[]>()
    for (const row of rightRows) {
      const key = (row[rightKey] ?? '').trim()
      if (!key) continue
      const bucket = rightMap.get(key) ?? []
      bucket.push(row)
      rightMap.set(key, bucket)
    }
    let count = 0
    for (const row of leftRows) {
      const key = (row[leftKey] ?? '').trim()
      if (!key) continue
      count += rightMap.get(key)?.length ?? 0
    }
    return count
  }, [leftKey, rightKey, leftRows, rightRows])

  function downloadMergedCsv() {
    setError('')
    if (!leftKey || !rightKey) return setError('Pick both key columns before merging.')
    if (layout.length === 0) return setError('Pick at least one field for the output layout.')

    const rightMap = new Map<string, CsvRow[]>()
    for (const row of rightRows) {
      const key = (row[rightKey] ?? '').trim()
      if (!key) continue
      const bucket = rightMap.get(key) ?? []
      bucket.push(row)
      rightMap.set(key, bucket)
    }

    const outRows: CsvRow[] = []
    for (const left of leftRows) {
      const key = (left[leftKey] ?? '').trim()
      if (!key) continue
      const matches = rightMap.get(key) ?? []
      for (const right of matches) {
        const out: CsvRow = {}
        for (const f of layout) {
          out[f.label] = f.source === 'left' ? (left[f.field] ?? '') : (right[f.field] ?? '')
        }
        outRows.push(out)
      }
    }

    const csv = Papa.unparse(outRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'merged-output.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-8 max-w-5xl">
      <h2 className="text-lg font-semibold mb-4">File Merge</h2>
      <p className="text-sm text-zinc-500 mb-6">
        Upload two CSV files, choose matching key columns, then build the output layout from fields in each file.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <label className="rounded-xl border border-dashed border-zinc-300 p-4 cursor-pointer hover:border-zinc-500 transition-colors">
          <p className="text-sm font-medium text-zinc-700 mb-1">File A</p>
          <p className="text-xs text-zinc-400 mb-3">{leftRows.length ? `${leftRows.length} rows loaded` : 'Choose first CSV'}</p>
          <input type="file" accept=".csv" className="hidden" onChange={(e) => handleUpload('left', e.target.files?.[0])} />
          <div className="inline-flex items-center gap-2 text-sm text-zinc-600"><FileSpreadsheet className="w-4 h-4" />Upload CSV</div>
        </label>

        <label className="rounded-xl border border-dashed border-zinc-300 p-4 cursor-pointer hover:border-zinc-500 transition-colors">
          <p className="text-sm font-medium text-zinc-700 mb-1">File B</p>
          <p className="text-xs text-zinc-400 mb-3">{rightRows.length ? `${rightRows.length} rows loaded` : 'Choose second CSV'}</p>
          <input type="file" accept=".csv" className="hidden" onChange={(e) => handleUpload('right', e.target.files?.[0])} />
          <div className="inline-flex items-center gap-2 text-sm text-zinc-600"><FileSpreadsheet className="w-4 h-4" />Upload CSV</div>
        </label>
      </div>

      {leftRows.length > 0 && rightRows.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">File A key column</label>
              <select value={leftKey} onChange={(e) => setLeftKey(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                {leftHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">File B key column</label>
              <select value={rightKey} onChange={(e) => setRightKey(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                {rightHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 p-4 mb-6">
            <p className="text-sm font-medium mb-3">Output layout</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {leftHeaders.map((h) => (
                <button key={`a-${h}`} onClick={() => addLayoutField('left', h)} className="text-xs rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-50">
                  <Plus className="w-3 h-3 inline mr-1" />A: {h}
                </button>
              ))}
              {rightHeaders.map((h) => (
                <button key={`b-${h}`} onClick={() => addLayoutField('right', h)} className="text-xs rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-50">
                  <Plus className="w-3 h-3 inline mr-1" />B: {h}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {layout.map((f) => (
                <div key={f.id} className="grid grid-cols-[120px_180px_1fr_40px] gap-2 items-center">
                  <span className="text-xs text-zinc-500">{f.source === 'left' ? 'File A' : 'File B'}</span>
                  <span className="text-sm text-zinc-700">{f.field}</span>
                  <input
                    value={f.label}
                    onChange={(e) => setLayout((prev) => prev.map((x) => x.id === f.id ? { ...x, label: e.target.value } : x))}
                    className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                    placeholder="Output column name"
                  />
                  <button onClick={() => setLayout((prev) => prev.filter((x) => x.id !== f.id))} className="text-zinc-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {!layout.length && <p className="text-xs text-zinc-400">Add fields to define output column order.</p>}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500 inline-flex items-center gap-2"><Link2 className="w-4 h-4" />{mergedCount} merged rows found</p>
            <button onClick={downloadMergedCsv} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 text-white px-4 py-2 text-sm font-medium hover:bg-zinc-700">
              <Download className="w-4 h-4" />
              Download merged CSV
            </button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
    </div>
  )
}
