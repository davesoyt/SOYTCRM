'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  page: number
  pageCount: number
  total: number
  pageSize: number
}

function pageHref(pathname: string, params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params.toString())
  if (page <= 1) next.delete('page')
  else next.set('page', String(page))
  const qs = next.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

export default function ListPagination({ page, pageCount, total, pageSize }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  if (total === 0) return null

  return (
    <div className="flex items-center justify-between gap-4 mt-4 text-sm text-zinc-600">
      <span>
        Showing {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={pageHref(pathname, searchParams, page - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-400">
            <ChevronLeft className="w-4 h-4" /> Previous
          </span>
        )}
        <span className="text-zinc-500 px-1">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <Link
            href={pageHref(pathname, searchParams, page + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-400">
            Next <ChevronRight className="w-4 h-4" />
          </span>
        )}
      </div>
    </div>
  )
}
