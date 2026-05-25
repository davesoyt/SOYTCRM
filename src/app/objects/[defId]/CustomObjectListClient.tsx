'use client'

import { useMemo } from 'react'
import ObjectListView, { type ObjectListColumn } from '@/components/ObjectListView'

export type CustomFieldMeta = {
  key: string
  label: string
  fieldType: string
  isPrimary?: boolean
}

export type CustomRecordRow = {
  id: string
  createdAt: string
  data: Record<string, string>
}

function formatValue(value: string, fieldType: string): string {
  if (!value) return '—'
  if (fieldType === 'checkbox') return value === 'true' ? 'Yes' : 'No'
  return value
}

function fieldsSignature(fields: CustomFieldMeta[]) {
  return fields.map((f) => `${f.key}\t${f.label}\t${f.fieldType}\t${f.isPrimary ? 1 : 0}`).join('\n')
}

export default function CustomObjectListClient({
  defId,
  records,
  fields,
}: {
  defId: string
  records: CustomRecordRow[]
  fields: CustomFieldMeta[]
}) {
  const sig = useMemo(() => fieldsSignature(fields), [fields])

  const { primaryField, primaryKey, columns } = useMemo(() => {
    const primaryField =
      fields.find((f) => f.isPrimary) ?? fields.find((f) => f.fieldType === 'text') ?? fields[0]
    const primaryKey = primaryField ? `field:${primaryField.key}` : 'id'

    const columns: ObjectListColumn<CustomRecordRow>[] = [
      ...(primaryField
        ? [
            {
              key: `field:${primaryField.key}`,
              label: primaryField.label,
              pinned: true,
              defaultVisible: true,
              render: (r: CustomRecordRow) => r.data[primaryField.key] || '—',
              gridText: (r: CustomRecordRow) => r.data[primaryField.key] || null,
            },
          ]
        : []),
      ...fields
        .filter((f) => !primaryField || f.key !== primaryField.key)
        .map((f) => ({
          key: `field:${f.key}`,
          label: f.label,
          defaultVisible: fields.indexOf(f) < 4,
          render: (r: CustomRecordRow) => formatValue(r.data[f.key] ?? '', f.fieldType),
          gridText: (r: CustomRecordRow) => r.data[f.key] || null,
        })),
      {
        key: 'createdAt',
        label: 'Created',
        defaultVisible: false,
        customizable: false,
        render: (r: CustomRecordRow) => new Date(r.createdAt).toLocaleDateString(),
        gridText: (r: CustomRecordRow) => new Date(r.createdAt).toLocaleDateString(),
      },
    ]

    return { primaryField, primaryKey, columns }
  }, [sig])

  return (
    <ObjectListView
      storageKey={`custom:${defId}`}
      columns={columns}
      rows={records}
      primaryKey={primaryKey}
      getHref={(r) => `/objects/${defId}/${r.id}`}
      searchPlaceholder="Filter records…"
      searchText={(r) => Object.values(r.data).join(' ')}
      emptyLabel="No records yet."
      renderAvatar={(r) => {
        const label = primaryField ? (r.data[primaryField.key] || '?') : '?'
        return (
          <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-600 shrink-0">
            {label.charAt(0).toUpperCase()}
          </div>
        )
      }}
    />
  )
}
