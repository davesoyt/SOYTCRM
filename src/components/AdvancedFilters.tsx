'use client'

import { useState } from 'react'
import { Filter, Plus, X, ChevronDown } from 'lucide-react'
import type { SchemaField } from '@/lib/objectSchemaShared'

export type FilterCondition = {
  id: string
  field: string
  operator: string
  value: string
}

type Props = {
  fields: SchemaField[]
  filters: FilterCondition[]
  onChange: (filters: FilterCondition[]) => void
  onApply: () => void
}

const TEXT_OPERATORS = [
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
]

const NUMBER_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater than or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less than or equal' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
]

function operatorsForType(fieldType: string) {
  if (fieldType === 'number') return NUMBER_OPERATORS
  return TEXT_OPERATORS
}

function needsValue(operator: string) {
  return operator !== 'is_empty' && operator !== 'is_not_empty'
}

export default function AdvancedFilters({ fields, filters, onChange, onApply }: Props) {
  const [open, setOpen] = useState(filters.length > 0)

  function addFilter() {
    const first = fields[0]
    if (!first) return
    onChange([
      ...filters,
      { id: crypto.randomUUID(), field: first.key, operator: 'contains', value: '' },
    ])
    setOpen(true)
  }

  function removeFilter(id: string) {
    onChange(filters.filter((f) => f.id !== id))
  }

  function updateFilter(id: string, updates: Partial<FilterCondition>) {
    onChange(
      filters.map((f) => {
        if (f.id !== id) return f
        const next = { ...f, ...updates }
        if (updates.field) {
          const fieldDef = fields.find((fd) => fd.key === updates.field)
          const ops = operatorsForType(fieldDef?.fieldType ?? 'text')
          if (!ops.find((o) => o.value === next.operator)) {
            next.operator = ops[0].value
          }
        }
        return next
      }),
    )
  }

  function clearAll() {
    onChange([])
    onApply()
  }

  if (!open && filters.length === 0) {
    return (
      <button
        onClick={addFilter}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
      >
        <Filter className="w-3.5 h-3.5" />
        Filter
      </button>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {filters.length > 0 && (
            <span className="ml-1 bg-zinc-900 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
              {filters.length}
            </span>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {filters.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            Clear all
          </button>
        )}
      </div>

      {open && (
        <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
          {filters.map((filter, index) => {
            const fieldDef = fields.find((f) => f.key === filter.field)
            const operators = operatorsForType(fieldDef?.fieldType ?? 'text')

            return (
              <div key={filter.id} className="flex items-center gap-2">
                {index > 0 && (
                  <span className="text-xs text-zinc-400 font-medium w-8 text-center shrink-0">AND</span>
                )}
                {index === 0 && <span className="w-8 shrink-0" />}

                <select
                  value={filter.field}
                  onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                  className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm min-w-[140px] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  {fields.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>

                <select
                  value={filter.operator}
                  onChange={(e) => updateFilter(filter.id, { operator: e.target.value })}
                  className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm min-w-[140px] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  {operators.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>

                {needsValue(filter.operator) && (
                  <input
                    type={fieldDef?.fieldType === 'number' ? 'number' : 'text'}
                    value={filter.value}
                    onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                    placeholder="Value…"
                    className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm min-w-[120px] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                )}

                <button
                  onClick={() => removeFilter(filter.id)}
                  className="text-zinc-300 hover:text-red-400 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={addFilter}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 font-medium transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add filter
            </button>
            <div className="flex-1" />
            <button
              onClick={onApply}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              Apply filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
