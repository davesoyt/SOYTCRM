import { prisma } from '@/lib/prisma'
import { renderReport } from '@/lib/reportData'
import type { ReportConfig } from '@/lib/reportData'

export const dynamic = 'force-dynamic'

function fmtCsvValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toLocaleDateString()
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleDateString()
  }
  return String(v)
}

function csvCell(v: unknown): string {
  const s = fmtCsvValue(v)
  // Quote if contains comma, quote, or newline
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function buildCsv(headers: string[], rows: Record<string, unknown>[], keys: string[]): string {
  const lines: string[] = [headers.map(csvCell).join(',')]
  for (const row of rows) {
    lines.push(keys.map(k => csvCell(row[k])).join(','))
  }
  return lines.join('\r\n')
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await prisma.report.findUnique({ where: { id } })
  if (!report) return new Response('Not found', { status: 404 })

  let config: ReportConfig = { sections: [] }
  try { config = JSON.parse(report.configJson) } catch {}
  if (!Array.isArray(config?.sections)) config = { sections: [] }

  const sections = await renderReport(config)
  const primary = sections[0]
  const subSections = sections.slice(1)

  if (!primary || primary.columns.length === 0) {
    return new Response('No data to export', { status: 400 })
  }

  const filename = report.name.replace(/[^a-z0-9_\-. ]/gi, '_')

  // If no sub-reports: simple flat CSV
  if (subSections.length === 0) {
    const csv = buildCsv(
      primary.columns.map(c => c.label),
      primary.rows,
      primary.columns.map(c => c.fieldKey),
    )
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    })
  }

  // With sub-reports: flatten — repeat parent fields on each child row.
  // One section per CSV block, separated by a blank line, all in one file.
  const blocks: string[] = []

  // Primary block
  blocks.push(buildCsv(
    primary.columns.map(c => c.label),
    primary.rows,
    primary.columns.map(c => c.fieldKey),
  ))

  // Sub-report blocks: flatten parent + child columns
  for (const sub of subSections) {
    if (sub.columns.length === 0) continue

    const parentCols = primary.columns
    const childCols = sub.columns

    const headers = [
      ...parentCols.map(c => `${primary.label} — ${c.label}`),
      ...childCols.map(c => `${sub.label} — ${c.label}`),
    ]

    const flatRows: Record<string, unknown>[] = []
    for (const parentRow of primary.rows) {
      const children = sub.rowsByParentId?.[String(parentRow.id)] ?? []
      if (children.length === 0) {
        // Include parent row with empty child columns
        const merged: Record<string, unknown> = {}
        parentCols.forEach(c => { merged[`p_${c.fieldKey}`] = parentRow[c.fieldKey] })
        childCols.forEach(c => { merged[`c_${c.fieldKey}`] = '' })
        flatRows.push(merged)
      } else {
        for (const child of children) {
          const merged: Record<string, unknown> = {}
          parentCols.forEach(c => { merged[`p_${c.fieldKey}`] = parentRow[c.fieldKey] })
          childCols.forEach(c => { merged[`c_${c.fieldKey}`] = child[c.fieldKey] })
          flatRows.push(merged)
        }
      }
    }

    const keys = [
      ...parentCols.map(c => `p_${c.fieldKey}`),
      ...childCols.map(c => `c_${c.fieldKey}`),
    ]

    blocks.push(buildCsv(headers, flatRows, keys))
  }

  const csv = blocks.join('\r\n\r\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  })
}
