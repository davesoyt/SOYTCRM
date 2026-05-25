import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Plus } from 'lucide-react'
import CompaniesList from './CompaniesList'
import CompanyFilters from './CompanyFilters'
import DeleteAllButton from '@/components/DeleteAllButton'
import { loadSchemaFields } from '@/lib/objectSchema'
import { pickCustomFieldValues } from '@/lib/companyListData'
import {
  LIST_PAGE_SIZE,
  listOffset,
  listPageCount,
  parseListPage,
  parseListQuery,
} from '@/lib/listPagination'
import type { Prisma } from '@/generated/prisma/client'
import type { FilterCondition } from '@/components/AdvancedFilters'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ page?: string; q?: string; filters?: string }>

const COMPANY_BUILTIN_COLS = new Set(['name', 'domain', 'industry', 'size', 'website'])

function companySearchWhere(q: string): Prisma.CompanyWhereInput | undefined {
  if (!q) return undefined
  return {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { domain: { contains: q, mode: 'insensitive' } },
      { industry: { contains: q, mode: 'insensitive' } },
      { website: { contains: q, mode: 'insensitive' } },
      { customFields: { contains: q, mode: 'insensitive' } },
    ],
  }
}

function parseFilters(raw: string | undefined): FilterCondition[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.map((f: { field: string; operator: string; value: string }, i: number) => ({
      id: String(i),
      field: f.field ?? '',
      operator: f.operator ?? 'contains',
      value: f.value ?? '',
    }))
  } catch {
    return []
  }
}

function buildFilterCondition(
  field: string,
  operator: string,
  value: string,
): Prisma.CompanyWhereInput | null {
  const isCustom = !COMPANY_BUILTIN_COLS.has(field)

  if (isCustom) {
    if (operator === 'is_empty') return { customFields: { not: { contains: `"${field}"` } } }
    if (operator === 'is_not_empty') return { customFields: { contains: `"${field}"` } }
    if (operator === 'contains') return { customFields: { contains: value, mode: 'insensitive' } }
    if (operator === 'not_contains') return { NOT: { customFields: { contains: value, mode: 'insensitive' } } }
    return { customFields: { contains: value, mode: 'insensitive' } }
  }

  const col = field as 'name' | 'domain' | 'industry' | 'size' | 'website'

  switch (operator) {
    case 'contains':
      return { [col]: { contains: value, mode: 'insensitive' } }
    case 'not_contains':
      return { NOT: { [col]: { contains: value, mode: 'insensitive' } } }
    case 'equals':
      return { [col]: { equals: value, mode: 'insensitive' } }
    case 'not_equals':
      return { NOT: { [col]: { equals: value, mode: 'insensitive' } } }
    case 'starts_with':
      return { [col]: { startsWith: value, mode: 'insensitive' } }
    case 'ends_with':
      return { [col]: { endsWith: value, mode: 'insensitive' } }
    case 'is_empty':
      return { OR: [{ [col]: null }, { [col]: '' }] }
    case 'is_not_empty':
      return { NOT: { OR: [{ [col]: null }, { [col]: '' }] } }
    default:
      return null
  }
}

function companyFiltersWhere(filters: FilterCondition[]): Prisma.CompanyWhereInput | undefined {
  if (!filters.length) return undefined
  const conditions = filters
    .map((f) => buildFilterCondition(f.field, f.operator, f.value))
    .filter((c): c is Prisma.CompanyWhereInput => c !== null)
  if (!conditions.length) return undefined
  return { AND: conditions }
}

export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const page = parseListPage(params.page)
  const q = parseListQuery(params.q)
  const filters = parseFilters(params.filters)

  const searchWhere = companySearchWhere(q)
  const filterWhere = companyFiltersWhere(filters)

  let where: Prisma.CompanyWhereInput | undefined
  if (searchWhere && filterWhere) {
    where = { AND: [searchWhere, filterWhere] }
  } else {
    where = searchWhere ?? filterWhere
  }

  const schema = await loadSchemaFields('company')
  const customKeys = schema.allFields.filter((f) => !f.isBuiltIn).map((f) => f.key)

  const [total, rows] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      select: {
        id: true,
        name: true,
        domain: true,
        industry: true,
        size: true,
        website: true,
        customFields: true,
        _count: { select: { contacts: true, opportunities: true } },
      },
      orderBy: { name: 'asc' },
      skip: listOffset(page),
      take: LIST_PAGE_SIZE,
    }),
  ])

  const companies = rows.map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    industry: row.industry,
    size: row.size,
    website: row.website,
    custom: pickCustomFieldValues(row.customFields, customKeys),
    _count: row._count,
  }))

  const pageCount = listPageCount(total)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{total.toLocaleString()} records</p>
        </div>
        <div className="flex items-center gap-2">
          <DeleteAllButton target="companies" count={total} />
          <Link
            href="/companies/new"
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Company
          </Link>
        </div>
      </div>
      <div className="mb-4">
        <CompanyFilters schemaFields={schema.allFields} initialFilters={filters} />
      </div>
      <CompaniesList
        companies={companies}
        schemaFields={schema.allFields}
        searchQuery={q}
        pagination={{ page: Math.min(page, pageCount), pageCount, total, pageSize: LIST_PAGE_SIZE }}
      />
    </div>
  )
}
