import { prisma } from '@/lib/prisma'
import { renderReport } from '@/lib/reportData'
import type { ReportConfig, RenderedSection } from '@/lib/reportData'

export const dynamic = 'force-dynamic'

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (v instanceof Date) return v.toLocaleDateString()
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleDateString()
  }
  if (typeof v === 'number') return v.toLocaleString()
  return String(v)
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderSection(primary: RenderedSection, subSections: RenderedSection[]): string {
  if (primary.columns.length === 0) {
    return `<div class="empty">No columns selected for this section.</div>`
  }

  const headerCells = primary.columns.map(c => `<th>${esc(c.label)}</th>`).join('')
  const extraTh = subSections.length > 0 ? '<th style="width:0"></th>' : ''

  const bodyRows = primary.rows.map(row => {
    const cells = primary.columns.map(col => `<td>${esc(fmtValue(row[col.fieldKey]))}</td>`).join('')
    const rowClass = subSections.length > 0 ? ' class="row-with-sub"' : ''
    let html = `<tr${rowClass}>${cells}${extraTh ? '<td></td>' : ''}</tr>`

    for (const sub of subSections) {
      const childRows = sub.rowsByParentId?.[String(row.id)] ?? []
      const subHeaderCells = sub.columns.map(c => `<th>${esc(c.label)}</th>`).join('')
      const subBodyRows = childRows.length === 0
        ? `<tr><td colspan="${sub.columns.length}" class="sub-empty">No related records.</td></tr>`
        : childRows.map(cr =>
            `<tr>${sub.columns.map(col => `<td>${esc(fmtValue(cr[col.fieldKey]))}</td>`).join('')}</tr>`
          ).join('')

      html += `
        <tr>
          <td colspan="${primary.columns.length + 1}" style="padding:0;background:#f9f9fb">
            <div class="sub-section">
              <div class="sub-header">${esc(sub.label)} (${childRows.length})</div>
              ${sub.columns.length === 0
                ? '<div class="sub-empty">No columns selected.</div>'
                : `<table><thead><tr>${subHeaderCells}</tr></thead><tbody>${subBodyRows}</tbody></table>`
              }
            </div>
          </td>
        </tr>`
    }
    return html
  }).join('')

  const emptyRow = primary.rows.length === 0
    ? `<tr><td colspan="${primary.columns.length}" class="empty">No records found.</td></tr>`
    : ''

  return `
    <table>
      <thead><tr>${headerCells}${extraTh}</tr></thead>
      <tbody>${emptyRow}${bodyRows}</tbody>
    </table>`
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await prisma.report.findUnique({ where: { id } })
  if (!report) return new Response('Not found', { status: 404 })

  let config: ReportConfig = { sections: [] }
  try { config = JSON.parse(report.configJson) } catch {}
  if (!Array.isArray(config?.sections)) config = { sections: [] }

  const sections = await renderReport(config)
  const primary = sections[0]
  const subSections = sections.slice(1)

  const baseUrl = new URL(req.url).origin
  const exportUrl = `${baseUrl}/reports/${id}/export`
  const previewUrl = `${baseUrl}/reports/${id}/preview`
  const mailtoBody = encodeURIComponent(`Hi,\n\nPlease find the "${report.name}" report here:\n${previewUrl}\n\nCSV export: ${exportUrl}`)
  const mailtoLink = `mailto:?subject=${encodeURIComponent(report.name + ' — Report')}&body=${mailtoBody}`

  const bodyContent = primary
    ? `
      <div class="section">
        <div class="section-header">
          <h2>${esc(primary.label)}</h2>
          <span class="count">${primary.rows.length} record${primary.rows.length !== 1 ? 's' : ''}</span>
        </div>
        ${renderSection(primary, subSections)}
      </div>`
    : `<div class="no-config"><p>No objects configured. Open the Design tab to build your report.</p></div>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(report.name)} — Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px; color: #18181b; background: #f4f4f5; }

    /* ---- Toolbar ---- */
    .toolbar {
      position: sticky; top: 0; z-index: 10;
      background: #fff; border-bottom: 1px solid #e4e4e7;
      padding: 10px 24px; display: flex; align-items: center; gap: 12px;
    }
    .toolbar-title { font-size: 15px; font-weight: 700; color: #09090b; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .toolbar-actions { display: flex; gap: 8px; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
      cursor: pointer; border: 1px solid #e4e4e7; text-decoration: none;
      background: #fff; color: #3f3f46; transition: background 0.15s;
    }
    .btn:hover { background: #f4f4f5; }
    .btn-primary { background: #18181b; color: #fff; border-color: #18181b; }
    .btn-primary:hover { background: #3f3f46; }
    .btn svg { width: 13px; height: 13px; }

    /* ---- Page content ---- */
    .page { padding: 24px; }
    .report-meta { margin-bottom: 20px; }
    .report-meta h1 { font-size: 20px; font-weight: 700; color: #09090b; margin-bottom: 2px; }
    .report-meta p { font-size: 13px; color: #71717a; }
    .section { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
    .section-header { padding: 10px 16px; background: #fafafa; border-bottom: 1px solid #e4e4e7; display: flex; align-items: center; justify-content: space-between; }
    .section-header h2 { font-size: 12px; font-weight: 600; color: #3f3f46; text-transform: uppercase; letter-spacing: 0.05em; }
    .count { font-size: 12px; color: #a1a1aa; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e4e4e7; background: #fafafa; white-space: nowrap; }
    td { padding: 8px 12px; border-bottom: 1px solid #f4f4f5; color: #3f3f46; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #fafafa; }
    .empty { padding: 32px; text-align: center; color: #a1a1aa; font-size: 13px; }
    .row-with-sub td { background: #f9f9fb; font-weight: 500; }
    .sub-section { margin: 0 12px 12px; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; }
    .sub-header { padding: 6px 12px; background: #f4f4f5; border-bottom: 1px solid #e4e4e7; font-size: 11px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.04em; }
    .sub-empty { padding: 10px 12px; color: #a1a1aa; font-size: 12px; }
    .no-config { padding: 48px; text-align: center; color: #a1a1aa; }

    /* ---- Print ---- */
    @media print {
      .toolbar { display: none !important; }
      body { background: #fff; }
      .section { border: 1px solid #ccc; border-radius: 0; }
      .page { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">${esc(report.name)}</span>
    <div class="toolbar-actions">
      <button class="btn" onclick="window.print()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Print
      </button>
      <a class="btn" href="${esc(mailtoLink)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
        Email
      </a>
      <a class="btn btn-primary" href="${esc(exportUrl)}" download="${esc(report.name)}.csv">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export CSV
      </a>
    </div>
  </div>

  <div class="page">
    <div class="report-meta">
      <h1>${esc(report.name)}</h1>
      ${report.description ? `<p>${esc(report.description)}</p>` : ''}
    </div>
    ${bodyContent}
  </div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
