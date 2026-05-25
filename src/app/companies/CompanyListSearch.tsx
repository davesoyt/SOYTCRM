'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'

export default function CompanyListSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQuery)
  const [isPending, startTransition] = useTransition()

  function submit(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    const q = next.trim()
    if (q) params.set('q', q)
    else params.delete('q')
    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  return (
    <form
      className="relative flex-1 max-w-sm min-w-[200px]"
      onSubmit={(e) => {
        e.preventDefault()
        submit(value)
      }}
    >
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search companies…"
        className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-zinc-300 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue('')
            submit('')
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {isPending && (
        <span className="absolute -bottom-5 left-0 text-[10px] text-zinc-400">Searching…</span>
      )}
    </form>
  )
}
