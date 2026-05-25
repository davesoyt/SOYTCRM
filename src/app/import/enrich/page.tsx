import { Sparkles } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import RecordEnricher from './RecordEnricher'

export const dynamic = 'force-dynamic'

const BUILT_INS = {
  contact: [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'title', label: 'Job Title' },
    { key: 'linkedin', label: 'LinkedIn URL' },
  ],
  company: [
    { key: 'name', label: 'Company Name' },
    { key: 'domain', label: 'Domain' },
    { key: 'industry', label: 'Industry' },
    { key: 'size', label: 'Company Size' },
    { key: 'website', label: 'Website' },
  ],
  opportunity: [
    { key: 'name', label: 'Opportunity Name' },
    { key: 'stage', label: 'Stage' },
    { key: 'value', label: 'Value' },
  ],
} as const

export default async function EnrichPage() {
  const defs = await prisma.fieldDefinition.findMany({
    where: { objectType: { in: ['contact', 'company'] } },
    select: { objectType: true, key: true, label: true, isBuiltIn: true, hidden: true },
    orderBy: { order: 'asc' },
  })

  const targets = [
    {
      id: 'contact' as const,
      name: 'Contacts',
      keyFields: [
        { key: 'email', label: 'Email' },
        { key: 'id', label: 'Record ID' },
        { key: 'phone', label: 'Phone' },
      ],
      updatableFields: [
        ...BUILT_INS.contact
          .filter((f) => !defs.find((d) => d.objectType === 'contact' && d.key === f.key && d.isBuiltIn)?.hidden)
          .map((f) => ({
            key: f.key,
            label: defs.find((d) => d.objectType === 'contact' && d.key === f.key)?.label ?? f.label,
          })),
        ...defs
          .filter((d) => d.objectType === 'contact' && !d.isBuiltIn && !d.hidden)
          .map((d) => ({ key: `custom:${d.key}`, label: d.label })),
      ],
    },
    {
      id: 'company' as const,
      name: 'Companies',
      keyFields: [
        { key: 'name', label: 'Company Name' },
        { key: 'domain', label: 'Domain' },
        { key: 'id', label: 'Record ID' },
      ],
      updatableFields: [
        ...BUILT_INS.company
          .filter((f) => !defs.find((d) => d.objectType === 'company' && d.key === f.key && d.isBuiltIn)?.hidden)
          .map((f) => ({
            key: f.key,
            label: defs.find((d) => d.objectType === 'company' && d.key === f.key)?.label ?? f.label,
          })),
        ...defs
          .filter((d) => d.objectType === 'company' && !d.isBuiltIn && !d.hidden)
          .map((d) => ({ key: `custom:${d.key}`, label: d.label })),
      ],
    },
    {
      id: 'opportunity' as const,
      name: 'Opportunities',
      keyFields: [
        { key: 'name', label: 'Opportunity Name' },
        { key: 'id', label: 'Record ID' },
      ],
      updatableFields: [...BUILT_INS.opportunity],
    },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Record Enrich from .CSV</h1>
      </div>
      <RecordEnricher targets={targets} />
    </div>
  )
}
