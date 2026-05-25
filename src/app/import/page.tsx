import { Upload } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import CsvImporter from './CsvImporter'

export const dynamic = 'force-dynamic'

// Built-in field defaults — used as fallback if no FieldDefinition record has been saved yet
const BUILT_IN_DEFAULTS: Record<'contact' | 'company', { key: string; name: string }[]> = {
  contact: [
    { key: 'firstName', name: 'First Name' },
    { key: 'lastName',  name: 'Last Name' },
    { key: 'email',     name: 'Email' },
    { key: 'title',     name: 'Job Title' },
    { key: 'phone',     name: 'Phone' },
    { key: 'linkedin',  name: 'LinkedIn URL' },
  ],
  company: [
    { key: 'name',     name: 'Company Name' },
    { key: 'domain',   name: 'Domain' },
    { key: 'industry', name: 'Industry' },
    { key: 'size',     name: 'Company Size' },
    { key: 'website',  name: 'Website' },
  ],
}

export default async function ImportPage() {
  const fieldDefs = await prisma.fieldDefinition.findMany({
    where: { objectType: { in: ['contact', 'company'] } },
    orderBy: { order: 'asc' },
  })

  const targets = (['contact', 'company'] as const).map(slug => {
    const savedMap = new Map(
      fieldDefs.filter(f => f.objectType === slug).map(f => [f.key, f.label])
    )

    // Built-in fields: use saved label if available, otherwise default
    const builtInFields = BUILT_IN_DEFAULTS[slug]
      .filter((bf) => {
        const saved = fieldDefs.find((f) => f.objectType === slug && f.key === bf.key && f.isBuiltIn)
        return !saved?.hidden
      })
      .map(bf => ({
        key: bf.key,
        name: savedMap.get(bf.key) ?? bf.name,
      }))

    // Custom fields saved in FieldDefinition
    const customFields = fieldDefs
      .filter(f => f.objectType === slug && !f.isBuiltIn && !f.hidden)
      .map(f => ({ key: f.key, name: f.label }))

    return {
      id: slug,
      name: slug === 'contact' ? 'Contact' : 'Company',
      fields: [...builtInFields, ...customFields],
    }
  })

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Upload className="w-6 h-6" />
        <h1 className="text-2xl font-bold">File Import</h1>
      </div>
      <CsvImporter targets={targets} />
    </div>
  )
}
