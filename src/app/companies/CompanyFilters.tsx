'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import AdvancedFilters, { type FilterCondition } from '@/components/AdvancedFilters'
import type { SchemaField } from '@/lib/objectSchemaShared'

export default function CompanyFilters({
  schemaFields,
  initialFilters,
}: {
  schemaFields: SchemaField[]
  initialFilters: FilterCondition[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<FilterCondition[]>(initialFilters)
  const [, startTransition] = useTransition()

  function apply() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    if (filters.length > 0) {
      params.set('filters', JSON.stringify(filters.map(({ field, operator, value }) => ({ field, operator, value }))))
    } else {
      params.delete('filters')
    }
    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  return (
    <AdvancedFilters
      fields={schemaFields.filter((f) => !f.hidden)}
      filters={filters}
      onChange={setFilters}
      onApply={apply}
    />
  )
}
