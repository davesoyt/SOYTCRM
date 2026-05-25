import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type FormField = {
  id: string
  fieldKey: string
  objectType: string
  label: string
  required: boolean
  placeholder: string
  width: 1 | 2 | 3
}

type FormRow = {
  id: string
  columns: (FormField | null)[]
}

type FormSection = {
  id: string
  label: string
  rows: FormRow[]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderFieldInput(field: FormField): string {
  const base = `id="${esc(field.id)}" name="${esc(field.fieldKey)}" placeholder="${esc(field.placeholder)}" ${field.required ? 'required' : ''}`

  switch (field.fieldKey === 'description' || field.fieldKey === 'message' || field.fieldKey === 'notes' ? 'textarea' : 'input') {
    case 'textarea':
      return `<textarea ${base} rows="3" class="field-input" style="resize:vertical">${''}</textarea>`
    default:
      break
  }

  // Determine input type from fieldKey or objectType context
  if (field.fieldKey === 'email' || field.objectType === 'email') {
    return `<input type="email" ${base} class="field-input" />`
  }
  if (field.fieldKey === 'phone') {
    return `<input type="tel" ${base} class="field-input" />`
  }
  if (field.fieldKey === 'website' || field.fieldKey === 'linkedin') {
    return `<input type="url" ${base} class="field-input" />`
  }
  if (field.fieldKey === 'leadScore' || field.fieldKey === 'value') {
    return `<input type="number" ${base} class="field-input" />`
  }
  if (field.fieldKey === 'dueDate' || field.fieldKey === 'closedAt' || field.fieldKey === 'createdAt') {
    return `<input type="date" ${base} class="field-input" />`
  }
  if (field.fieldKey === 'enriched') {
    return `
      <label class="checkbox-label">
        <input type="checkbox" id="${esc(field.id)}" name="${esc(field.fieldKey)}" ${field.required ? 'required' : ''} />
        <span>${esc(field.label)}</span>
      </label>`
  }
  return `<input type="text" ${base} class="field-input" />`
}

function renderSection(section: FormSection): string {
  const rows = section.rows.map(row => {
    const colCount = row.columns.filter(Boolean).length || 1
    const colStyle = colCount === 3 ? 'repeat(3, 1fr)' : colCount === 2 ? 'repeat(2, 1fr)' : '1fr'

    const cols = row.columns.map(field => {
      if (!field) return ''
      const isCheckbox = field.fieldKey === 'enriched'
      return `
        <div class="field-wrap">
          ${isCheckbox ? renderFieldInput(field) : `
            <label for="${esc(field.id)}" class="field-label">
              ${esc(field.label)}${field.required ? ' <span class="req">*</span>' : ''}
            </label>
            ${renderFieldInput(field)}
          `}
        </div>`
    }).join('')

    return `<div class="row-grid" style="grid-template-columns:${colStyle}">${cols}</div>`
  }).join('')

  return `
    <div class="section">
      <div class="section-header">${esc(section.label)}</div>
      <div class="section-body">${rows}</div>
    </div>`
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const form = await prisma.form.findUnique({ where: { id } })
  if (!form) return new Response('Not found', { status: 404 })

  let sections: FormSection[] = []
  try { sections = JSON.parse(form.layoutJson) } catch {}

  const formBody = sections.length === 0
    ? `<div class="empty">This form has no fields yet. Go to the Design tab to add some.</div>`
    : sections.map(renderSection).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(form.name)} — Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 14px; color: #18181b; background: #f4f4f5; min-height: 100vh; }

    .preview-banner {
      background: #7c3aed; color: #fff;
      padding: 8px 20px; font-size: 12px; font-weight: 600;
      display: flex; align-items: center; justify-between; gap: 12px;
      letter-spacing: 0.03em;
    }
    .preview-badge { background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 999px; font-size: 11px; }

    .page { max-width: 680px; margin: 32px auto; padding: 0 16px 64px; }
    .form-header { margin-bottom: 24px; }
    .form-title { font-size: 22px; font-weight: 700; color: #09090b; margin-bottom: 4px; }
    .form-desc { font-size: 14px; color: #71717a; }

    .section { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
    .section-header {
      padding: 10px 16px; background: #fafafa; border-bottom: 1px solid #e4e4e7;
      font-size: 12px; font-weight: 600; color: #3f3f46;
      text-transform: uppercase; letter-spacing: 0.06em;
      border-left: 3px solid #7c3aed;
    }
    .section-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

    .row-grid { display: grid; gap: 12px; }

    .field-wrap { display: flex; flex-direction: column; gap: 4px; }
    .field-label { font-size: 13px; font-weight: 500; color: #3f3f46; }
    .req { color: #ef4444; }
    .field-input {
      width: 100%; padding: 8px 12px; border: 1px solid #d4d4d8; border-radius: 8px;
      font-size: 14px; color: #09090b; background: #fff;
      transition: border-color 0.15s, box-shadow 0.15s;
      outline: none;
    }
    .field-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.12); }
    textarea.field-input { font-family: inherit; }
    .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #3f3f46; cursor: pointer; }
    .checkbox-label input { width: 16px; height: 16px; accent-color: #7c3aed; }

    .submit-row { margin-top: 24px; }
    .submit-btn {
      padding: 10px 28px; background: #18181b; color: #fff; border: none; border-radius: 8px;
      font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s;
    }
    .submit-btn:hover { background: #3f3f46; }

    .empty { padding: 48px; text-align: center; color: #a1a1aa; background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; }

    @media (max-width: 500px) {
      .row-grid { grid-template-columns: 1fr !important; }
    }
  </style>
</head>
<body>
  <div class="preview-banner">
    <span>Form Preview <span class="preview-badge">Read-only</span></span>
    <span style="font-weight:400;opacity:0.8">${esc(form.name)}</span>
  </div>

  <div class="page">
    <div class="form-header">
      <h1 class="form-title">${esc(form.name)}</h1>
      ${form.description ? `<p class="form-desc">${esc(form.description)}</p>` : ''}
    </div>

    <form onsubmit="event.preventDefault()">
      ${formBody}
      ${sections.length > 0 ? `
      <div class="submit-row">
        <button type="submit" class="submit-btn">Submit</button>
      </div>` : ''}
    </form>
  </div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
