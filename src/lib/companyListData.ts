export function pickCustomFieldValues(
  customFieldsJson: string | null | undefined,
  keys: string[],
): Record<string, string> {
  if (!keys.length) return {}
  try {
    const all = JSON.parse(customFieldsJson || '{}') as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const key of keys) {
      const value = all[key]
      if (value != null && value !== '') out[key] = String(value)
    }
    return out
  } catch {
    return {}
  }
}
