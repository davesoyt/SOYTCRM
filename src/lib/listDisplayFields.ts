import type { ListColumnDef } from '@/lib/useListColumns'
import type { SchemaField } from '@/lib/objectSchemaShared'

/** Column storage key for a schema field (custom fields use `custom:` prefix). */
export function listColumnKey(field: SchemaField): string {
  return field.isBuiltIn ? field.key : `custom:${field.key}`
}

export function schemaToDisplayFieldDefs(fields: SchemaField[]): ListColumnDef[] {
  return fields.map((f) => ({
    key: listColumnKey(f),
    label: f.hidden ? `${f.label} (hidden in schema)` : f.label,
    defaultVisible: f.hidden
      ? false
      : f.isBuiltIn
        ? ['name', 'firstName', 'domain', 'industry', 'email', 'title', 'leadScore'].includes(f.key)
        : false,
    pinned: f.isPrimary,
    customizable: true,
  }))
}
