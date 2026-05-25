'use client'

import { Suspense, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { LayoutList, LayoutGrid, Search, X } from 'lucide-react'
import FieldCustomizer from '@/components/FieldCustomizer'
import ListPagination from '@/components/ListPagination'
import { useListColumns, type ListColumnDef } from '@/lib/useListColumns'

export type ObjectListColumn<T> = ListColumnDef & {
  render: (row: T) => ReactNode
  gridText?: (row: T) => string | null
}

type PaginationProps = {
  page: number
  pageCount: number
  total: number
  pageSize: number
}

type Props<T extends { id: string }> = {
  storageKey: string
  columns: ObjectListColumn<T>[]
  /** Schema-driven fields for Customize; when set, only these keys appear in the picker. */
  displayFields?: ListColumnDef[]
  rows: T[]
  getHref: (row: T) => string
  searchPlaceholder: string
  searchText: (row: T) => string
  emptyLabel: string
  primaryKey?: string
  renderAvatar?: (row: T) => ReactNode
  /** When true, rows are already filtered/paginated on the server. */
  serverMode?: boolean
  searchSlot?: ReactNode
  pagination?: PaginationProps
}

export default function ObjectListView<T extends { id: string }>({
  storageKey,
  columns,
  displayFields,
  rows,
  getHref,
  searchPlaceholder,
  searchText,
  emptyLabel,
  primaryKey,
  renderAvatar,
  serverMode = false,
  searchSlot,
  pagination,
}: Props<T>) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'table' | 'grid'>('table')

  const pickerFields = useMemo(
    () =>
      displayFields ??
      columns.filter((c) => c.customizable !== false).map((c) => ({
        key: c.key,
        label: c.label,
        defaultVisible: c.defaultVisible,
        pinned: c.pinned,
        customizable: c.customizable,
      })),
    [displayFields, columns],
  )

  const { visibility, toggle, reset, loaded, defaults } = useListColumns(storageKey, pickerFields)

  const visibleCols = useMemo(
    () =>
      columns.filter((c) => {
        if (c.customizable === false) return c.defaultVisible !== false
        if (!pickerFields.some((f) => f.key === c.key)) return c.defaultVisible !== false
        return visibility[c.key] ?? defaults[c.key] ?? true
      }),
    [columns, visibility, defaults, pickerFields],
  )

  const pinnedKeys = columns.filter((c) => c.pinned).map((c) => c.key)
  const primaryColKey = primaryKey ?? columns.find((c) => c.pinned)?.key ?? visibleCols[0]?.key
  const tableColumns = visibleCols
  const gridExtraColumns = visibleCols.filter((c) => c.key !== primaryColKey)

  const filtered = useMemo(() => {
    if (serverMode) return rows
    const q = query.toLowerCase().trim()
    if (!q) return rows
    return rows.filter((r) => searchText(r).toLowerCase().includes(q))
  }, [rows, query, searchText, serverMode])

  const primaryCol = columns.find((c) => c.key === primaryColKey) ?? visibleCols[0]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {serverMode && searchSlot ? (
          searchSlot
        ) : (
          <div className="relative flex-1 max-w-sm min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-zinc-300 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        {!serverMode && query && (
          <span className="text-sm text-zinc-500 shrink-0">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
        {serverMode && pagination && (
          <span className="text-sm text-zinc-500 shrink-0">
            {pagination.total.toLocaleString()} total
          </span>
        )}
        {loaded ? (
          <FieldCustomizer
            fields={pickerFields.map((c) => ({ key: c.key, label: c.label }))}
            visibility={visibility}
            onToggle={toggle}
            onReset={reset}
            title="Display fields"
            pinnedKeys={pinnedKeys.filter((k) => pickerFields.some((f) => f.key === k))}
          />
        ) : null}
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
        <div className="bg-white rounded-xl border border-zinc-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                {tableColumns.map((col) => (
                  <th key={col.key} className="text-left px-4 py-3 font-medium text-zinc-500 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50 transition-colors">
                  {tableColumns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-zinc-600 max-w-xs truncate">
                      {col.key === primaryColKey ? (
                        <Link href={getHref(row)} className="font-medium text-zinc-900 hover:underline">
                          {col.render(row)}
                        </Link>
                      ) : (
                        col.render(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={Math.max(tableColumns.length, 1)} className="px-4 py-12 text-center text-zinc-400">
                    {query ? `No results for "${query}"` : emptyLabel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((row) => {
            const subtitle = gridExtraColumns
              .map((col) => {
                const text = col.gridText?.(row) ?? null
                if (!text) return null
                return `${col.label}: ${text}`
              })
              .filter(Boolean)
              .join(' · ')
            const avatar = renderAvatar?.(row)
            return (
              <Link
                key={row.id}
                href={getHref(row)}
                className="bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-400 transition-colors block group"
              >
                <div className="flex items-start gap-3">
                  {avatar}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-900 group-hover:underline truncate">
                      {primaryCol ? primaryCol.render(row) : row.id}
                    </p>
                    {subtitle && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{subtitle}</p>}
                  </div>
                </div>
              </Link>
            )
          })}
          {!filtered.length && (
            <p className="text-zinc-400 col-span-3 py-12 text-center">
              {query ? `No results for "${query}"` : emptyLabel}
            </p>
          )}
        </div>
      )}

      {pagination && (
        <Suspense fallback={null}>
          <ListPagination {...pagination} />
        </Suspense>
      )}
    </div>
  )
}
