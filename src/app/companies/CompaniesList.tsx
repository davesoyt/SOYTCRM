'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { LayoutList, LayoutGrid, Search, X } from 'lucide-react'

type Company = {
  id: string
  name: string
  domain: string | null
  industry: string | null
  size: string | null
  _count: { contacts: number; deals: number }
}

export default function CompaniesList({ companies }: { companies: Company[] }) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'table'>('grid')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return companies
    return companies.filter(c =>
      `${c.name} ${c.domain ?? ''} ${c.industry ?? ''}`.toLowerCase().includes(q)
    )
  }, [companies, query])

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter companies…"
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

      {view === 'grid' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => (
            <Link key={c.id} href={`/companies/${c.id}`} className="bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-400 transition-colors block group">
              <p className="font-semibold text-zinc-900 group-hover:underline">{c.name}</p>
              {c.domain && <p className="text-xs text-zinc-400 mt-0.5">{c.domain}</p>}
              <div className="flex gap-3 mt-3 text-xs text-zinc-500 flex-wrap">
                {c.industry && <span className="px-2 py-0.5 bg-zinc-100 rounded">{c.industry}</span>}
                {c.size && <span>{c.size} employees</span>}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-zinc-500">
                <span>{c._count.contacts} contacts</span>
                <span>{c._count.deals} deals</span>
              </div>
            </Link>
          ))}
          {!filtered.length && (
            <p className="text-zinc-400 col-span-3 py-12 text-center">
              {query ? `No companies matching "${query}"` : 'No companies yet.'}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Domain</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Industry</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Size</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Contacts</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Deals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/companies/${c.id}`} className="font-medium text-zinc-900 hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{c.domain ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.industry ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.size ? `${c.size} employees` : '—'}</td>
                  <td className="px-4 py-3 text-zinc-600">{c._count.contacts}</td>
                  <td className="px-4 py-3 text-zinc-600">{c._count.deals}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-400">
                  {query ? `No companies matching "${query}"` : 'No companies yet.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
