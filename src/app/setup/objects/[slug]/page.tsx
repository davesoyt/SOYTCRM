import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import FieldEditor from './FieldEditor'
import { deleteCustomObjectDef } from '@/app/actions'
import { Trash2 } from 'lucide-react'

type BuiltInDef = { key: string; label: string; fieldType: string }

const STANDARD_META: Record<string, { label: string; builtInFields: BuiltInDef[] }> = {
  contact: {
    label: 'Contacts',
    builtInFields: [
      { key: 'firstName',  label: 'First Name',  fieldType: 'text' },
      { key: 'lastName',   label: 'Last Name',   fieldType: 'text' },
      { key: 'email',      label: 'Email',       fieldType: 'email' },
      { key: 'phone',      label: 'Phone',       fieldType: 'phone' },
      { key: 'title',      label: 'Job Title',   fieldType: 'text' },
      { key: 'linkedin',   label: 'LinkedIn',    fieldType: 'url' },
      { key: 'leadScore',  label: 'Lead Score',  fieldType: 'number' },
      { key: 'street',     label: 'Street',      fieldType: 'text' },
      { key: 'city',       label: 'City',        fieldType: 'text' },
      { key: 'state',      label: 'State',       fieldType: 'text' },
      { key: 'zip',        label: 'Zip',         fieldType: 'text' },
      { key: 'country',    label: 'Country',     fieldType: 'text' },
    ],
  },
  company: {
    label: 'Companies',
    builtInFields: [
      { key: 'name',     label: 'Company Name',     fieldType: 'text' },
      { key: 'domain',   label: 'Domain',           fieldType: 'text' },
      { key: 'industry', label: 'Industry',         fieldType: 'text' },
      { key: 'size',     label: 'Employee Size',    fieldType: 'text' },
      { key: 'website',  label: 'Website',          fieldType: 'url' },
    ],
  },
  deal: {
    label: 'Deals',
    builtInFields: [
      { key: 'name',  label: 'Deal Name', fieldType: 'text' },
      { key: 'value', label: 'Value ($)', fieldType: 'number' },
      { key: 'stage', label: 'Stage',     fieldType: 'select' },
    ],
  },
}

async function scanCustomFieldKeys(slug: string): Promise<string[]> {
  const keys = new Set<string>()
  const parse = (json: string) => {
    try { Object.keys(JSON.parse(json || '{}')).forEach(k => keys.add(k)) } catch { /* */ }
  }
  if (slug === 'contact') {
    const rows = await prisma.contact.findMany({ select: { customFields: true } })
    rows.forEach(r => parse(r.customFields))
  } else if (slug === 'company') {
    const rows = await prisma.company.findMany({ select: { customFields: true } })
    rows.forEach(r => parse(r.customFields))
  }
  return [...keys]
}

export default async function ObjectFieldsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const isStandard = slug in STANDARD_META

  if (isStandard) {
    const meta = STANDARD_META[slug]

    const [savedFields, customKeysFromRecords] = await Promise.all([
      prisma.fieldDefinition.findMany({ where: { objectType: slug }, orderBy: { order: 'asc' } }),
      scanCustomFieldKeys(slug),
    ])

    // Built-in fields with any saved overrides applied
    const builtInFields = meta.builtInFields.map((bf, i) => {
      const saved = savedFields.find(sf => sf.key === bf.key && sf.isBuiltIn)
      return {
        id: saved?.id,
        key: bf.key,
        label: saved?.label ?? bf.label,
        fieldType: saved?.fieldType ?? bf.fieldType,
        selectOptions: saved ? JSON.parse(saved.selectOptions || '[]') : bf.key === 'stage' ? ['Prospect', 'Qualified', 'Proposal', 'Closed Won', 'Closed Lost'] : [],
        required: saved?.required ?? false,
        isPrimary: saved?.isPrimary ?? false,
        order: saved?.order ?? i,
        isBuiltIn: true,
      }
    })

    // Custom fields from FieldDefinition
    const savedCustom = savedFields
      .filter(f => !f.isBuiltIn)
      .map(f => ({
        id: f.id,
        key: f.key,
        label: f.label,
        fieldType: f.fieldType,
        selectOptions: JSON.parse(f.selectOptions || '[]'),
        required: f.required,
        isPrimary: f.isPrimary,
        order: f.order,
        isBuiltIn: false,
      }))

    // Custom fields found in actual records but not yet in FieldDefinition
    const defKeys = new Set([...meta.builtInFields.map(f => f.key), ...savedCustom.map(f => f.key)])
    const orphanCustom = customKeysFromRecords
      .filter(k => !defKeys.has(k))
      .map((k, i) => ({
        key: k,
        label: k,
        fieldType: 'text' as const,
        selectOptions: [],
        required: false,
        isPrimary: false,
        order: builtInFields.length + savedCustom.length + i,
        isBuiltIn: false,
      }))

    const allFields = [...builtInFields, ...savedCustom, ...orphanCustom]

    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-xl font-bold text-zinc-900 mb-1">{meta.label} Fields</h1>
        <p className="text-sm text-zinc-500 mb-8">Customize field labels, types, and designate a primary field.</p>
        <FieldEditor
          objectType={slug}
          customObjectDefId={null}
          fields={allFields}
        />
      </div>
    )
  }

  // Custom object
  const obj = await prisma.customObjectDef.findUnique({
    where: { id: slug },
    include: { fields: { orderBy: { order: 'asc' } } },
  })
  if (!obj) notFound()

  const fields = obj.fields.map(f => ({
    id: f.id,
    key: f.key,
    label: f.label,
    fieldType: f.fieldType,
    selectOptions: JSON.parse(f.selectOptions || '[]') as string[],
    required: f.required,
    isPrimary: f.isPrimary,
    order: f.order,
    isBuiltIn: false,
  }))

  async function handleDelete() {
    'use server'
    await deleteCustomObjectDef(slug)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">{obj.pluralName} Fields</h1>
          <p className="text-sm text-zinc-500 mt-1 mb-8">Define fields and designate a primary field.</p>
        </div>
        <form action={handleDelete}>
          <button type="submit"
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4" /> Delete Object
          </button>
        </form>
      </div>
      <FieldEditor
        objectType={null}
        customObjectDefId={obj.id}
        fields={fields}
      />
    </div>
  )
}
