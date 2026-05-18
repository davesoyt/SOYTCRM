import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import FormDesigner from './FormDesigner'

export const dynamic = 'force-dynamic'

const STANDARD_BUILT_INS: Record<string, { label: string; fields: { key: string; label: string; fieldType: string }[] }> = {
  contact: {
    label: 'Contact',
    fields: [
      { key: 'firstName', label: 'First Name', fieldType: 'text' },
      { key: 'lastName',  label: 'Last Name',  fieldType: 'text' },
      { key: 'email',     label: 'Email',       fieldType: 'email' },
      { key: 'phone',     label: 'Phone',       fieldType: 'phone' },
      { key: 'title',     label: 'Job Title',   fieldType: 'text' },
      { key: 'leadScore', label: 'Lead Score',  fieldType: 'number' },
      { key: 'linkedin',  label: 'LinkedIn',    fieldType: 'url' },
      { key: 'street',    label: 'Street',      fieldType: 'text' },
      { key: 'city',      label: 'City',        fieldType: 'text' },
      { key: 'state',     label: 'State',       fieldType: 'text' },
      { key: 'zip',       label: 'Zip',         fieldType: 'text' },
      { key: 'country',   label: 'Country',     fieldType: 'text' },
    ],
  },
  company: {
    label: 'Company',
    fields: [
      { key: 'name',     label: 'Company Name',  fieldType: 'text' },
      { key: 'domain',   label: 'Domain',        fieldType: 'text' },
      { key: 'industry', label: 'Industry',      fieldType: 'text' },
      { key: 'size',     label: 'Employee Size', fieldType: 'text' },
      { key: 'website',  label: 'Website',       fieldType: 'url' },
    ],
  },
  deal: {
    label: 'Deal',
    fields: [
      { key: 'name',  label: 'Deal Name', fieldType: 'text' },
      { key: 'value', label: 'Value ($)', fieldType: 'number' },
      { key: 'stage', label: 'Stage',     fieldType: 'select' },
    ],
  },
}

export type AvailableField = {
  key: string
  label: string
  fieldType: string
}

export type AvailableObject = {
  id: string
  label: string
  fields: AvailableField[]
}

export default async function FormDesignerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [form, fieldDefs, customObjectDefs] = await Promise.all([
    prisma.form.findUnique({ where: { id } }),
    prisma.fieldDefinition.findMany({ orderBy: { order: 'asc' } }),
    prisma.customObjectDef.findMany({ include: { fields: { orderBy: { order: 'asc' } } } }),
  ])

  if (!form) notFound()

  const availableObjects: AvailableObject[] = []

  for (const [slug, meta] of Object.entries(STANDARD_BUILT_INS)) {
    const savedForObject = fieldDefs.filter(f => f.objectType === slug)
    const savedMap = new Map(savedForObject.map(f => [f.key, f]))

    const builtInFields = meta.fields.map(bf => {
      const saved = savedMap.get(bf.key)
      return {
        key: bf.key,
        label: saved?.label ?? bf.label,
        fieldType: saved?.fieldType ?? bf.fieldType,
      }
    })

    const definedCustomFields = savedForObject
      .filter(f => !f.isBuiltIn)
      .map(f => ({ key: f.key, label: f.label, fieldType: f.fieldType }))

    availableObjects.push({
      id: slug,
      label: meta.label,
      fields: [...builtInFields, ...definedCustomFields],
    })
  }

  for (const obj of customObjectDefs) {
    availableObjects.push({
      id: obj.id,
      label: obj.name,
      fields: obj.fields.map(f => ({ key: f.key, label: f.label, fieldType: f.fieldType })),
    })
  }

  return (
    <FormDesigner
      form={{ id: form.id, name: form.name, description: form.description ?? '', objectTypes: form.objectTypes, layoutJson: form.layoutJson }}
      availableObjects={availableObjects}
    />
  )
}
