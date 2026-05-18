'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, Building2, TrendingUp, X } from 'lucide-react'
import { searchRecords } from '@/app/actions'

type Results = Awaited<ReturnType<typeof searchRecords>>

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Results | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQuery(''); setResults(null) }
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults(null); return }
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await searchRecords(query)
        setResults(res)
      })
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  const total = results ? results.contacts.length + results.companies.length + results.deals.length : 0

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
      >
        <Search className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="text-xs text-zinc-400 bg-zinc-100 rounded px-1.5 py-0.5 font-sans">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/30" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
              <Search className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search contacts, companies, deals…"
                className="flex-1 text-sm outline-none placeholder:text-zinc-400"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd className="text-xs text-zinc-400 bg-zinc-100 rounded px-1.5 py-0.5 font-sans shrink-0">Esc</kbd>
            </div>

            {isPending && <p className="px-4 py-4 text-sm text-zinc-400">Searching…</p>}

            {!isPending && results && total === 0 && (
              <p className="px-4 py-8 text-center text-sm text-zinc-400">No results for &ldquo;{query}&rdquo;</p>
            )}

            {!isPending && results && total > 0 && (
              <div className="max-h-96 overflow-y-auto">
                {results.contacts.length > 0 && (
                  <section>
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Users className="w-3 h-3" /> Contacts
                    </p>
                    {results.contacts.map(c => (
                      <button key={c.id} onClick={() => go(`/contacts/${c.id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 text-left">
                        <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-600 shrink-0">
                          {c.firstName[0]}{c.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-zinc-400 truncate">{c.email}{c.company ? ` · ${c.company.name}` : ''}</p>
                        </div>
                      </button>
                    ))}
                  </section>
                )}
                {results.companies.length > 0 && (
                  <section>
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Building2 className="w-3 h-3" /> Companies
                    </p>
                    {results.companies.map(c => (
                      <button key={c.id} onClick={() => go(`/companies/${c.id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 text-left">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-600 shrink-0">
                          {c.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900">{c.name}</p>
                          <p className="text-xs text-zinc-400 truncate">{[c.domain, c.industry].filter(Boolean).join(' · ')}</p>
                        </div>
                      </button>
                    ))}
                  </section>
                )}
                {results.deals.length > 0 && (
                  <section>
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3" /> Deals
                    </p>
                    {results.deals.map(d => (
                      <button key={d.id} onClick={() => go('/deals')} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 text-left">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-semibold text-green-600 shrink-0">
                          $
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900">{d.name}</p>
                          <p className="text-xs text-zinc-400 truncate">
                            {d.stage} · ${d.value.toLocaleString()}
                            {d.contact ? ` · ${d.contact.firstName} ${d.contact.lastName}` : ''}
                          </p>
                        </div>
                      </button>
                    ))}
                  </section>
                )}
              </div>
            )}

            {!query && (
              <p className="px-4 py-8 text-center text-sm text-zinc-400">Search contacts, companies, and deals</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
