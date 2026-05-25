/** Schema types + standard object metadata — safe to import from client components (no Prisma / Node built-ins). */

export type SchemaFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'email'
  | 'phone'
  | 'url'
  | 'select'
  | 'boolean'

export type BuiltInFieldMeta = { key: string; label: string; fieldType: SchemaFieldType }

export type SchemaField = {
  id?: string
  key: string
  label: string
  fieldType: string
  selectOptions: string[]
  required: boolean
  isPrimary: boolean
  order: number
  isBuiltIn: boolean
  hidden?: boolean
}

export const STANDARD_OBJECTS = [
  { slug: 'contact', label: 'Contacts' },
  { slug: 'company', label: 'Companies' },
  { slug: 'opportunity', label: 'Opportunities' },
] as const

export const STANDARD_META: Record<
  string,
  { label: string; builtInFields: BuiltInFieldMeta[] }
> = {
  contact: {
    label: 'Contacts',
    builtInFields: [
      { key: 'firstName', label: 'First Name', fieldType: 'text' },
      { key: 'lastName', label: 'Last Name', fieldType: 'text' },
      { key: 'email', label: 'Email', fieldType: 'email' },
      { key: 'phone', label: 'Phone', fieldType: 'phone' },
      { key: 'title', label: 'Job Title', fieldType: 'text' },
      { key: 'linkedin', label: 'LinkedIn', fieldType: 'url' },
      { key: 'leadScore', label: 'Lead Score', fieldType: 'number' },
      { key: 'street', label: 'Street', fieldType: 'text' },
      { key: 'city', label: 'City', fieldType: 'text' },
      { key: 'state', label: 'State', fieldType: 'text' },
      { key: 'zip', label: 'Zip', fieldType: 'text' },
      { key: 'country', label: 'Country', fieldType: 'text' },
    ],
  },
  company: {
    label: 'Companies',
    builtInFields: [
      { key: 'name', label: 'Company Name', fieldType: 'text' },
      { key: 'domain', label: 'Domain', fieldType: 'text' },
      { key: 'industry', label: 'Industry', fieldType: 'text' },
      { key: 'size', label: 'Employee Size', fieldType: 'text' },
      { key: 'website', label: 'Website', fieldType: 'url' },
    ],
  },
  opportunity: {
    label: 'Opportunities',
    builtInFields: [
      { key: 'name', label: 'Opportunity Name', fieldType: 'text' },
      { key: 'value', label: 'Value ($)', fieldType: 'number' },
      { key: 'stage', label: 'Stage', fieldType: 'select' },
    ],
  },
}
