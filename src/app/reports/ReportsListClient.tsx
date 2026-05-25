'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BarChart2, Plus, Trash2, X, Eye } from 'lucide-react'
import { createReport, deleteReport } from '@/app/actions'
import { formatDistanceToNow } from 'date-fns'

type Report = {
  id: string
  name: string
  description: string | null
  configJson: string
  createdAt: Date
  updatedAt: Date
}

function sectionCount(configJson: string): number {
  try {
    const cfg = JSON.parse(configJson)
    return Array.isArray(cfg.sections) ? cfg.sections.length : 0
  } catch { return 0 }
}

export default function ReportsListClient({ reports: initialReports }: { reports: Report[] }) {
  const router = useRouter()
  const [reports, setReports] = useState(initialReports)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    const report = await createReport(name.trim(), description.trim())
    setCreating(false)
    setShowModal(false)
    setName('')
    setDescription('')
    router.push(`/reports/${report.id}`)
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this report?')) return
    await deleteReport(id)
    setReports(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-2.5">
          <BarChart2 className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-zinc-900">Reports</h1>
          <span className="ml-1 text-sm text-zinc-400">
            {reports.length} report{reports.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Report
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BarChart2 className="w-10 h-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 font-medium">No reports yet</p>
            <p className="text-zinc-400 text-sm mt-1">Create a report to view your data across multiple objects</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Report
            </button>
          </div>
        ) : (
          <div className="grid gap-3 max-w-4xl">
            {reports.map(report => {
              const sections = sectionCount(report.configJson)
              return (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="group block bg-white border border-zinc-200 rounded-xl p-4 hover:border-zinc-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                        <BarChart2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900 truncate">{report.name}</p>
                        {report.description && (
                          <p className="text-sm text-zinc-500 mt-0.5 truncate">{report.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {sections > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-xs font-medium">
                              {sections} section{sections !== 1 ? 's' : ''}
                            </span>
                          )}
                          <span className="text-xs text-zinc-400">
                            Updated {formatDistanceToNow(new Date(report.updatedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => e.preventDefault()}
                    >
                      <a
                        href={`/reports/${report.id}/preview`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Open preview"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      <button
                        onClick={e => handleDelete(report.id, e)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* New Report Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-zinc-900">New Report</h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-4 h-4 text-zinc-400 hover:text-zinc-700" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Report name</label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="e.g. Companies with Contacts"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What data does this report show?"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating…' : 'Create & Design'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
