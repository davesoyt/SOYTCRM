'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { LayoutList, LayoutGrid, Search, X } from 'lucide-react'
import { scoreLabel } from '@/lib/scoring'

type Contact = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  title: string | null
  leadScore: number
  company: { id: string; name: string } | null
}

export default function ContactsList({ contacts }: { contacts: Contact[] }) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'table' | 'grid'>('table')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return contacts
    return contacts.filter(c =>
      `${c.firstName} ${c.lastName} ${c.email} ${c.title ?? ''} ${c.company?.name ?? ''}`.toLowerCase().includes(q)
    )
  }, [contacts, query])

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter contacts…"
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-zinc-300 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {query && <span className="text-sm text-zinc-500 shrink-0">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>}
        <div className="flex rounded-lg border border-zinc-300 overflow-hidden ml-auto">
          <button
            onClick={() => setView('table')}
            title="List view"
            className={`px-3 py-2 transition-colors ${view === 'table' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            title="Grid view"
            className={`px-3 py-2 border-l border-zinc-300 transition-colors ${view === 'grid' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === 'table' ? (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Company</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Title</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(c => {
                const { label, color } = scoreLabel(c.leadScore)
                return (
                  <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/contacts/${c.id}`} className="font-medium text-zinc-900 hover:underline">
                        {c.firstName} {c.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{c.company?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600">{c.title ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500">{c.email}</td>
                    <td className="px-4 py-3"><span className={`font-semibold ${color}`}>{c.leadScore} · {label}</span></td>
                  </tr>
                )
              })}
              {!filtered.length && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-400">
                  {query ? `No contacts matching "${query}"` : 'No contacts yet.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => {
            const { label, color } = scoreLabel(c.leadScore)
            return (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-400 transition-colors block group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center text-sm font-bold text-zinc-600 shrink-0">
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 group-hover:underline truncate">{c.firstName} {c.lastName}</p>
                    {c.title && <p className="text-xs text-zinc-500 truncate">{c.title}</p>}
                    {c.company && <p className="text-xs text-zinc-400 truncate">{c.company.name}</p>}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-400 truncate">{c.email}</span>
                  <span className={`text-xs font-bold ${color} shrink-0`}>{c.leadScore} · {label}</span>
                </div>
              </Link>
            )
          })}
          {!filtered.length && (
            <p className="text-zinc-400 col-span-3 py-12 text-center">
              {query ? `No contacts matching "${query}"` : 'No contacts yet.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
