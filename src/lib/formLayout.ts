export type FormField = {
  id: string
  fieldKey: string
  objectType: string
  label: string
  required: boolean
  placeholder: string
  width: 1 | 2 | 3
}

export type FormRow = {
  id: string
  columns: (FormField | null)[]
}

export type FormSection = {
  id: string
  label: string
  rows: FormRow[]
}

export function parseFormLayout(layoutJson: string): FormSection[] {
  try {
    const parsed = JSON.parse(layoutJson || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function fieldValueKey(field: FormField): string {
  return `${field.objectType}:${field.fieldKey}`
}
