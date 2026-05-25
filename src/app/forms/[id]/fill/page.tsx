import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { parseFormLayout } from '@/lib/formLayout'
import { parseFormIdFromTask } from '@/lib/formTasks'
import FormFillClient from './FormFillClient'

export const dynamic = 'force-dynamic'

function readCustomFields(json: string): Record<string, string> {
  try {
    const parsed = JSON.parse(json || '{}') as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (v != null && v !== '') out[`custom_${k}`] = String(v)
      if (v != null && v !== '') out[k] = String(v)
    }
    return out
  } catch {
    return {}
  }
}

export default async function FormFillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ taskId?: string }>
}) {
  const { id: formId } = await params
  const { taskId } = await searchParams

  const form = await prisma.form.findUnique({ where: { id: formId } })
  if (!form) notFound()

  const sections = parseFormLayout(form.layoutJson)

  let task: {
    id: string
    title: string
    description: string | null
    status: string
    contactId: string | null
    companyId: string | null
    opportunityId: string | null
  } | null = null
  let recordLabel = ''
  const initialValues: Record<string, string> = {}

  if (taskId) {
    task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        contactId: true,
        companyId: true,
        opportunityId: true,
      },
    })
    if (!task || parseFormIdFromTask(task) !== formId) notFound()

    if (task.companyId) {
      const company = await prisma.company.findUnique({ where: { id: task.companyId } })
      if (company) {
        recordLabel = company.name
        Object.assign(initialValues, {
          'company:name': company.name,
          'company:domain': company.domain ?? '',
          'company:industry': company.industry ?? '',
          'company:size': company.size ?? '',
          'company:website': company.website ?? '',
          ...Object.fromEntries(
            Object.entries(readCustomFields(company.customFields)).map(([k, v]) => [`company:${k}`, v]),
          ),
        })
      }
    }

    if (task.contactId) {
      const contact = await prisma.contact.findUnique({ where: { id: task.contactId } })
      if (contact) {
        recordLabel = recordLabel || `${contact.firstName} ${contact.lastName}`
        Object.assign(initialValues, {
          'contact:firstName': contact.firstName,
          'contact:lastName': contact.lastName,
          'contact:email': contact.email,
          'contact:phone': contact.phone ?? '',
          'contact:title': contact.title ?? '',
          'contact:linkedin': contact.linkedin ?? '',
          'contact:leadScore': String(contact.leadScore),
          'contact:street': contact.street ?? '',
          'contact:city': contact.city ?? '',
          'contact:state': contact.state ?? '',
          'contact:zip': contact.zip ?? '',
          'contact:country': contact.country ?? '',
          'contact:enriched': contact.enriched ? 'true' : 'false',
          ...Object.fromEntries(
            Object.entries(readCustomFields(contact.customFields)).map(([k, v]) => [`contact:${k}`, v]),
          ),
        })
      }
    }

    if (task.opportunityId) {
      const opportunity = await prisma.opportunity.findUnique({ where: { id: task.opportunityId } })
      if (opportunity) {
        recordLabel = recordLabel || opportunity.name
        Object.assign(initialValues, {
          'opportunity:name': opportunity.name,
          'opportunity:value': String(opportunity.value),
          'opportunity:stage': opportunity.stage,
          // Legacy form bindings
          'deal:name': opportunity.name,
          'deal:value': String(opportunity.value),
          'deal:stage': opportunity.stage,
        })
      }
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col">
      <header className="shrink-0 bg-violet-700 text-white px-4 py-3 flex items-center gap-3">
        <Link
          href={taskId ? '/tasks' : '/forms'}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          ← Back
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-violet-200 uppercase tracking-wide">Complete form</p>
          <h1 className="text-sm font-semibold truncate">{form.name}</h1>
        </div>
        {recordLabel && (
          <span className="text-xs bg-white/15 px-2 py-1 rounded-full truncate max-w-[200px]">
            {recordLabel}
          </span>
        )}
      </header>

      <FormFillClient
        formId={form.id}
        formName={form.name}
        formDescription={form.description}
        sections={sections}
        taskId={taskId ?? null}
        taskStatus={task?.status ?? null}
        initialValues={initialValues}
      />
    </div>
  )
}
