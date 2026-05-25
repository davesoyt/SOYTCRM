/** Read a dot-path from a nested object (e.g. data.object.metadata.business_name). */
export function getByPath(obj: unknown, path: string): unknown {
  if (!path.trim()) return undefined
  const parts = path.split('.')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

export function stringifyPathValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    if ('id' in (value as object) && typeof (value as { id: unknown }).id === 'string') {
      return (value as { id: string }).id
    }
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}
