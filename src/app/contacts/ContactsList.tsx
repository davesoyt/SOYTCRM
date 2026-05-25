'use client'

import { useMemo } from 'react'
import ObjectListView from '@/components/ObjectListView'
import type { SchemaField } from '@/lib/objectSchemaShared'
import { buildContactListColumns, contactListPrimaryKey } from '@/lib/listColumnsFromSchema'
import { schemaToDisplayFieldDefs } from '@/lib/listDisplayFields'

type Contact = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  title: string | null
  linkedin?: string | null
  leadScore: number
  street?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
  company: { id: string; name: string } | null
  customFields?: string
}

function readCustomFields(json?: string): Record<string, string> {
  try {
    return JSON.parse(json || '{}')
  } catch {
    return {}
  }
}

export default function ContactsList({
  contacts,
  schemaFields,
}: {
  contacts: Contact[]
  schemaFields: SchemaField[]
}) {
  const columns = useMemo(() => buildContactListColumns(schemaFields), [schemaFields])
  const displayFields = useMemo(() => schemaToDisplayFieldDefs(schemaFields), [schemaFields])
  const primaryKey = useMemo(
    () => contactListPrimaryKey(schemaFields, columns),
    [schemaFields, columns],
  )

  return (
    <ObjectListView
      storageKey="contact"
      columns={columns}
      displayFields={displayFields}
      rows={contacts}
      primaryKey={primaryKey}
      getHref={(c) => `/contacts/${c.id}`}
      searchPlaceholder="Filter contacts…"
      searchText={(c) => {
        const custom = readCustomFields(c.customFields)
        return [
          c.firstName,
          c.lastName,
          c.email,
          c.title ?? '',
          c.phone ?? '',
          c.company?.name ?? '',
          ...Object.values(custom),
        ].join(' ')
      }}
      emptyLabel="No contacts yet."
      renderAvatar={(c) => (
        <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center text-sm font-bold text-zinc-600 shrink-0">
          {c.firstName[0]}
          {c.lastName[0]}
        </div>
      )}
    />
  )
}
