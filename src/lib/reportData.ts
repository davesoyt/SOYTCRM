/**
 * Server-only data loading for report preview / rendering.
 * Pure types and constants live in reportTypes.ts (safe for client components).
 */

import { prisma } from '@/lib/prisma'
import type { ReportConfig, ReportColumn } from '@/lib/reportTypes'

export type { ReportColumn, ReportSection, ReportConfig, AvailableReportObject } from '@/lib/reportTypes'
export { BUILT_IN_RELATIONSHIPS, getBuiltInRelationshipsForParent } from '@/lib/reportTypes'

// ---- Built-in field definitions ----

const STANDARD_BUILT_IN_FIELDS: Record<string, { key: string; label: string }[]> = {
  contact: [
    { key: 'id',        label: 'ID' },
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName',  label: 'Last Name' },
    { key: 'email',     label: 'Email' },
    { key: 'phone',     label: 'Phone' },
    { key: 'title',     label: 'Job Title' },
    { key: 'leadScore', label: 'Lead Score' },
    { key: 'linkedin',  label: 'LinkedIn' },
    { key: 'city',      label: 'City' },
    { key: 'state',     label: 'State' },
    { key: 'country',   label: 'Country' },
    { key: 'companyId', label: 'Company ID' },
    { key: 'createdAt', label: 'Created At' },
  ],
  company: [
    { key: 'id',        label: 'ID' },
    { key: 'name',      label: 'Company Name' },
    { key: 'domain',    label: 'Domain' },
    { key: 'industry',  label: 'Industry' },
    { key: 'size',      label: 'Employee Size' },
    { key: 'website',   label: 'Website' },
    { key: 'createdAt', label: 'Created At' },
  ],
  opportunity: [
    { key: 'id',        label: 'ID' },
    { key: 'name',      label: 'Opportunity Name' },
    { key: 'value',     label: 'Value ($)' },
    { key: 'stage',     label: 'Stage' },
    { key: 'contactId', label: 'Contact ID' },
    { key: 'companyId', label: 'Company ID' },
    { key: 'createdAt', label: 'Created At' },
    { key: 'closedAt',  label: 'Closed At' },
  ],
}

// ---- Available objects for the designer palette (server only) ----

export async function getAvailableReportObjects() {
  const [fieldDefs, customDefs] = await Promise.all([
    prisma.fieldDefinition.findMany({ orderBy: { order: 'asc' } }),
    prisma.customObjectDef.findMany({ include: { fields: { where: { hidden: false }, orderBy: { order: 'asc' } } } }),
  ])

  const result: { id: string; label: string; fields: { key: string; label: string; fieldType: string }[] }[] = []

  for (const [slug, builtIns] of Object.entries(STANDARD_BUILT_IN_FIELDS)) {
    const savedMap = new Map(
      fieldDefs
        .filter((f) => f.objectType === slug)
        .map((f) => [f.key, f]),
    )
    const visibleBuiltIns = builtIns
      .filter((b) => !savedMap.get(b.key)?.hidden)
      .map((b) => ({
        key: b.key,
        label: savedMap.get(b.key)?.label ?? b.label,
        fieldType: 'text',
      }))
    const customFieldsForObj = fieldDefs
      .filter(f => f.objectType === slug && !f.isBuiltIn && !f.hidden)
      .map(f => ({ key: f.key, label: f.label, fieldType: f.fieldType }))

    result.push({
      id: slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
      fields: [
        ...visibleBuiltIns,
        ...customFieldsForObj,
      ],
    })
  }

  for (const def of customDefs) {
    result.push({
      id: def.id,
      label: def.name,
      fields: def.fields.map(f => ({ key: f.key, label: f.label, fieldType: f.fieldType })),
    })
  }

  return result
}

// ---- Record loading ----

type FlatRecord = Record<string, unknown>

async function loadRecords(objectType: string): Promise<FlatRecord[]> {
  if (objectType === 'contact') {
    const rows = await prisma.contact.findMany({ orderBy: { lastName: 'asc' } })
    return rows.map(r => {
      const { customFields, ...rest } = r as typeof r & { customFields: string }
      return { ...rest, ...parseJson(customFields) }
    })
  }
  if (objectType === 'company') {
    const rows = await prisma.company.findMany({ orderBy: { name: 'asc' } })
    return rows.map(r => {
      const { customFields, ...rest } = r as typeof r & { customFields: string }
      return { ...rest, ...parseJson(customFields) }
    })
  }
  if (objectType === 'opportunity') {
    const rows = await prisma.opportunity.findMany({ orderBy: { name: 'asc' } })
    return rows.map(r => ({ ...r }))
  }
  const rows = await prisma.customObjectRecord.findMany({
    where: { objectDefId: objectType },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(r => ({ id: r.id, ...parseJson(r.data), createdAt: r.createdAt }))
}

function parseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s) } catch { return {} }
}

// ---- Rendered section type ----

export type RenderedSection = {
  sectionId: string
  label: string
  columns: ReportColumn[]
  rows: FlatRecord[]
  rowsByParentId?: Record<string, FlatRecord[]>
}

// ---- Main render function ----

export async function renderReport(config: ReportConfig): Promise<RenderedSection[]> {
  if (!config.sections || config.sections.length === 0) return []

  const primary = config.sections[0]
  const subSections = config.sections.slice(1)
  const primaryRecords = await loadRecords(primary.objectType)

  const result: RenderedSection[] = [{
    sectionId: primary.id,
    label: primary.label,
    columns: primary.columns,
    rows: primaryRecords,
  }]

  for (const sub of subSections) {
    if (!sub.parentLinkField) continue
    const childRecords = await loadRecords(sub.objectType)
    const parentIds = new Set(primaryRecords.map(r => String(r.id)))

    const rowsByParentId: Record<string, FlatRecord[]> = {}
    for (const child of childRecords) {
      const parentId = String(child[sub.parentLinkField] ?? '')
      if (!parentIds.has(parentId)) continue
      if (!rowsByParentId[parentId]) rowsByParentId[parentId] = []
      rowsByParentId[parentId].push(child)
    }

    result.push({
      sectionId: sub.id,
      label: sub.label,
      columns: sub.columns,
      rows: childRecords,
      rowsByParentId,
    })
  }

  return result
}
