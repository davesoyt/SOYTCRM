import { prisma } from '@/lib/prisma'

export type EnrichTargetId = 'contact' | 'company' | 'opportunity'
export type EnrichMode = 'overwrite' | 'fill_empty'
export type EnrichRequest = {
  targetId: EnrichTargetId
  keyField: string
  csvKeyColumn: string
  mode: EnrichMode
  mappings: Record<string, string>
  rows: Record<string, string>[]
}
export type EnrichResult = {
  totalRows: number
  matchedRows: number
  updatedRows: number
  unmatchedRows: number
}

export const ENRICH_BATCH_SIZE = 150

function hasValue(v: unknown): boolean {
  return typeof v === 'string' ? v.trim() !== '' : v !== null && v !== undefined
}

export function slimRowsForEnrich(
  rows: Record<string, string>[],
  csvKeyColumn: string,
  mappings: Record<string, string>,
): Record<string, string>[] {
  const csvCols = new Set([csvKeyColumn, ...Object.values(mappings)])
  return rows.map((row) => {
    const slim: Record<string, string> = {}
    for (const col of csvCols) {
      if (col && row[col] !== undefined) slim[col] = row[col]
    }
    return slim
  })
}

export async function enrichRecordsBatch(req: EnrichRequest): Promise<EnrichResult> {
  const totalRows = req.rows.length
  let matchedRows = 0
  let updatedRows = 0
  let unmatchedRows = 0

  for (const row of req.rows) {
    const keyValue = (row[req.csvKeyColumn] ?? '').trim()
    if (!keyValue) continue

    if (req.targetId === 'contact') {
      const existing = req.keyField === 'id'
        ? await prisma.contact.findUnique({ where: { id: keyValue } })
        : req.keyField === 'email'
          ? await prisma.contact.findUnique({ where: { email: keyValue } })
          : req.keyField === 'phone'
            ? await prisma.contact.findFirst({ where: { phone: keyValue } })
            : null
      if (!existing) { unmatchedRows++; continue }
      matchedRows++

      const updateData: Record<string, unknown> = {}
      let customPatch: Record<string, string> = {}
      let hasCustomPatch = false

      for (const [fieldKey, csvColumn] of Object.entries(req.mappings)) {
        const csvVal = row[csvColumn] ?? ''
        if (fieldKey.startsWith('custom:')) {
          const customKey = fieldKey.slice(7)
          if (!customKey) continue
          let currentCustom: Record<string, string> = {}
          try { currentCustom = JSON.parse(existing.customFields || '{}') } catch { /* ignore */ }
          const current = currentCustom[customKey]
          const shouldWrite = req.mode === 'overwrite' ? true : !hasValue(current)
          if (!shouldWrite || (!csvVal && req.mode !== 'overwrite')) continue
          customPatch[customKey] = csvVal
          hasCustomPatch = true
          continue
        }

        if (!['firstName', 'lastName', 'email', 'phone', 'title', 'linkedin'].includes(fieldKey)) continue
        const current = (existing as Record<string, unknown>)[fieldKey]
        const shouldWrite = req.mode === 'overwrite' ? true : !hasValue(current)
        if (!shouldWrite || (!csvVal && req.mode !== 'overwrite')) continue

        if (['firstName', 'lastName', 'email'].includes(fieldKey)) {
          if (csvVal) updateData[fieldKey] = csvVal
          continue
        }
        updateData[fieldKey] = csvVal || null
      }

      if (hasCustomPatch) {
        let currentCustom: Record<string, string> = {}
        try { currentCustom = JSON.parse(existing.customFields || '{}') } catch { /* ignore */ }
        updateData.customFields = JSON.stringify({ ...currentCustom, ...customPatch })
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.contact.update({ where: { id: existing.id }, data: updateData })
        updatedRows++
      }
      continue
    }

    if (req.targetId === 'company') {
      const existing = req.keyField === 'id'
        ? await prisma.company.findUnique({ where: { id: keyValue } })
        : req.keyField === 'domain'
          ? await prisma.company.findFirst({ where: { domain: keyValue } })
          : req.keyField === 'name'
            ? await prisma.company.findFirst({ where: { name: keyValue } })
            : null
      if (!existing) { unmatchedRows++; continue }
      matchedRows++

      const updateData: Record<string, unknown> = {}
      let customPatch: Record<string, string> = {}
      let hasCustomPatch = false

      for (const [fieldKey, csvColumn] of Object.entries(req.mappings)) {
        const csvVal = row[csvColumn] ?? ''
        if (fieldKey.startsWith('custom:')) {
          const customKey = fieldKey.slice(7)
          if (!customKey) continue
          let currentCustom: Record<string, string> = {}
          try { currentCustom = JSON.parse(existing.customFields || '{}') } catch { /* ignore */ }
          const current = currentCustom[customKey]
          const shouldWrite = req.mode === 'overwrite' ? true : !hasValue(current)
          if (!shouldWrite || (!csvVal && req.mode !== 'overwrite')) continue
          customPatch[customKey] = csvVal
          hasCustomPatch = true
          continue
        }

        if (!['name', 'domain', 'industry', 'size', 'website'].includes(fieldKey)) continue
        const current = (existing as Record<string, unknown>)[fieldKey]
        const shouldWrite = req.mode === 'overwrite' ? true : !hasValue(current)
        if (!shouldWrite || (!csvVal && req.mode !== 'overwrite')) continue

        if (fieldKey === 'name') {
          if (csvVal) updateData[fieldKey] = csvVal
          continue
        }
        updateData[fieldKey] = csvVal || null
      }

      if (hasCustomPatch) {
        let currentCustom: Record<string, string> = {}
        try { currentCustom = JSON.parse(existing.customFields || '{}') } catch { /* ignore */ }
        updateData.customFields = JSON.stringify({ ...currentCustom, ...customPatch })
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.company.update({ where: { id: existing.id }, data: updateData })
        updatedRows++
      }
      continue
    }

    if (req.targetId === 'opportunity') {
      const existing = req.keyField === 'id'
        ? await prisma.opportunity.findUnique({ where: { id: keyValue } })
        : req.keyField === 'name'
          ? await prisma.opportunity.findFirst({ where: { name: keyValue } })
          : null
      if (!existing) { unmatchedRows++; continue }
      matchedRows++

      const updateData: Record<string, unknown> = {}
      for (const [fieldKey, csvColumn] of Object.entries(req.mappings)) {
        const csvVal = row[csvColumn] ?? ''
        if (!['name', 'stage', 'value'].includes(fieldKey)) continue

        const current = (existing as Record<string, unknown>)[fieldKey]
        const shouldWrite = req.mode === 'overwrite' ? true : !hasValue(current)
        if (!shouldWrite || (!csvVal && req.mode !== 'overwrite')) continue

        if (fieldKey === 'value') {
          const num = parseFloat(csvVal)
          if (!Number.isNaN(num)) updateData.value = num
          continue
        }
        if (fieldKey === 'name') {
          if (csvVal) updateData.name = csvVal
          continue
        }
        updateData.stage = csvVal || existing.stage
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.opportunity.update({ where: { id: existing.id }, data: updateData })
        updatedRows++
      }
    }
  }

  return { totalRows, matchedRows, updatedRows, unmatchedRows }
}

export async function enrichAllRows(req: EnrichRequest): Promise<EnrichResult> {
  const slim = slimRowsForEnrich(req.rows, req.csvKeyColumn, req.mappings)
  const aggregated: EnrichResult = {
    totalRows: 0,
    matchedRows: 0,
    updatedRows: 0,
    unmatchedRows: 0,
  }

  for (let i = 0; i < slim.length; i += ENRICH_BATCH_SIZE) {
    const batch = slim.slice(i, i + ENRICH_BATCH_SIZE)
    const res = await enrichRecordsBatch({ ...req, rows: batch })
    aggregated.totalRows += res.totalRows
    aggregated.matchedRows += res.matchedRows
    aggregated.updatedRows += res.updatedRows
    aggregated.unmatchedRows += res.unmatchedRows
  }

  return aggregated
}
