'use client'

import { Suspense, useMemo } from 'react'
import ObjectListView from '@/components/ObjectListView'
import type { SchemaField } from '@/lib/objectSchemaShared'
import { buildCompanyListColumns, companyListPrimaryKey } from '@/lib/listColumnsFromSchema'
import { schemaToDisplayFieldDefs } from '@/lib/listDisplayFields'
import CompanyListSearch from './CompanyListSearch'

export type CompanyListRow = {
  id: string
  name: string
  domain: string | null
  industry: string | null
  size: string | null
  website: string | null
  custom: Record<string, string>
  _count: { contacts: number; opportunities: number }
}

export default function CompaniesList({
  companies,
  schemaFields,
  searchQuery,
  pagination,
}: {
  companies: CompanyListRow[]
  schemaFields: SchemaField[]
  searchQuery: string
  pagination: { page: number; pageCount: number; total: number; pageSize: number }
}) {
  const columns = useMemo(() => buildCompanyListColumns(schemaFields), [schemaFields])
  const displayFields = useMemo(() => schemaToDisplayFieldDefs(schemaFields), [schemaFields])
  const primaryKey = useMemo(() => companyListPrimaryKey(columns), [columns])

  return (
    <ObjectListView
      storageKey="company"
      columns={columns}
      displayFields={displayFields}
      rows={companies}
      primaryKey={primaryKey}
      getHref={(c) => `/companies/${c.id}`}
      searchPlaceholder="Search companies…"
      searchText={(c) =>
        [c.name, c.domain ?? '', c.industry ?? '', c.size ?? '', ...Object.values(c.custom)].join(' ')
      }
      emptyLabel={searchQuery ? `No companies matching "${searchQuery}"` : 'No companies yet.'}
      serverMode
      searchSlot={
        <Suspense fallback={<div className="h-9 w-full max-w-sm rounded-lg bg-zinc-100 animate-pulse" />}>
          <CompanyListSearch initialQuery={searchQuery} />
        </Suspense>
      }
      pagination={pagination}
      renderAvatar={(c) => (
        <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-600 shrink-0">
          {c.name.charAt(0).toUpperCase()}
        </div>
      )}
    />
  )
}
