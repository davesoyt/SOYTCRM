'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClipboardList, Plus, Trash2, X } from 'lucide-react'
import { createForm, deleteForm } from '@/app/actions'
import { formatDistanceToNow } from 'date-fns'

type Form = {
  id: string
  name: string
  description: string | null
  objectTypes: string
  createdAt: Date
  updatedAt: Date
}

export default function FormsListClient({ forms: initialForms }: { forms: Form[] }) {
  const router = useRouter()
  const [forms, setForms] = useState(initialForms)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    const form = await createForm(name.trim(), description.trim())
    setCreating(false)
    setShowModal(false)
    setName('')
    setDescription('')
    router.push(`/forms/${form.id}`)
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this form?')) return
    await deleteForm(id)
    setForms((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-2.5">
          <ClipboardList className="w-5 h-5 text-violet-600" />
          <h1 className="text-lg font-semibold text-zinc-900">Forms</h1>
          <span className="ml-1 text-sm text-zinc-400">{forms.length} form{forms.length !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Form
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <ClipboardList className="w-10 h-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 font-medium">No forms yet</p>
            <p className="text-zinc-400 text-sm mt-1">Create your first form to get started</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Form
            </button>
          </div>
        ) : (
          <div className="grid gap-3 max-w-4xl">
            {forms.map((form) => {
              let objectTypes: string[] = []
              try { objectTypes = JSON.parse(form.objectTypes) } catch {}
              return (
                <Link
                  key={form.id}
                  href={`/forms/${form.id}`}
                  className="group block bg-white border border-zinc-200 rounded-xl p-4 hover:border-zinc-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                        <ClipboardList className="w-4 h-4 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900 truncate">{form.name}</p>
                        {form.description && (
                          <p className="text-sm text-zinc-500 mt-0.5 truncate">{form.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {objectTypes.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {objectTypes.map((t) => (
                                <span key={t} className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-xs font-medium capitalize">{t}</span>
                              ))}
                            </div>
                          )}
                          <span className="text-xs text-zinc-400">
                            Updated {formatDistanceToNow(new Date(form.updatedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(form.id, e)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* New Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-zinc-900">New Form</h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-4 h-4 text-zinc-400 hover:text-zinc-700" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Form name</label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="e.g. Contact Us"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What is this form for?"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
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
