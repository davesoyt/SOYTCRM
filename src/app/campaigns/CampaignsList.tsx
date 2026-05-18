'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Send, Mail, Users, BarChart3, Trash2, X } from 'lucide-react'
import { createCampaign, deleteCampaign } from '@/app/actions'

type Campaign = {
  id: string
  name: string
  subject: string
  status: string
  recipientCount: number
  openCount: number
  clickCount: number
  sentAt: Date | null
  segmentId: string | null
  segment: { id: string; name: string } | null
  createdAt: Date
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-700',
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-amber-100 text-amber-700',
  sent: 'bg-emerald-100 text-emerald-700',
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function CampaignsList({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [isPending, startTransition] = useTransition()

  const sentCampaigns = campaigns.filter(c => c.status === 'sent')
  const totalSent = sentCampaigns.length
  const totalRecipients = sentCampaigns.reduce((s, c) => s + c.recipientCount, 0)
  const totalOpens = sentCampaigns.reduce((s, c) => s + c.openCount, 0)
  const avgOpenRate =
    totalRecipients > 0 ? Math.round((totalOpens / totalRecipients) * 100) : 0

  function handleCreate() {
    if (!name.trim()) return
    startTransition(async () => {
      const { id } = await createCampaign(name.trim())
      setShowModal(false)
      setName('')
      router.push(`/campaigns/${id}`)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this campaign?')) return
    startTransition(async () => {
      await deleteCampaign(id)
      router.refresh()
    })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Email Campaigns</h1>
          <p className="text-sm text-zinc-500 mt-0.5">One-off broadcasts to a contact segment</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wide">
            <Send className="w-3.5 h-3.5" /> Total Sent
          </div>
          <p className="text-2xl font-bold mt-1">{totalSent}</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wide">
            <Users className="w-3.5 h-3.5" /> Total Recipients
          </div>
          <p className="text-2xl font-bold mt-1">{totalRecipients.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wide">
            <BarChart3 className="w-3.5 h-3.5" /> Avg Open Rate
          </div>
          <p className="text-2xl font-bold mt-1">{avgOpenRate}%</p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-16 text-center">
          <Mail className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
          <p className="font-medium text-zinc-600 mb-1">No campaigns yet</p>
          <p className="text-sm text-zinc-400 mb-4">Create a campaign to broadcast email to a segment.</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide border-b border-zinc-200">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Segment</th>
                <th className="px-4 py-3 text-right">Recipients</th>
                <th className="px-4 py-3 text-right">Open Rate</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {campaigns.map(c => {
                const statusClass = STATUS_COLORS[c.status] ?? STATUS_COLORS.draft
                const openRate =
                  c.recipientCount > 0 ? Math.round((c.openCount / c.recipientCount) * 100) : 0
                return (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <Link href={`/campaigns/${c.id}`} className="font-medium text-zinc-900 hover:underline">
                        {c.name}
                      </Link>
                      {c.subject && (
                        <p className="text-xs text-zinc-500 truncate max-w-xs">{c.subject}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusClass}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {c.segment ? c.segment.name : <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 text-right">
                      {c.recipientCount > 0 ? c.recipientCount.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 text-right">
                      {c.status === 'sent' ? `${openRate}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{formatDate(c.sentAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={isPending}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Campaign</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
              Campaign name
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              placeholder="e.g. May Newsletter"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending || !name.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
