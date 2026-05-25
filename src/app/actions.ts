'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { computeLeadScore } from '@/lib/scoring'
import {
  applyFilters,
  parseObjectTypes,
  memberKey,
  type SegmentFilter,
} from '@/lib/filters'
import {
  filterValidObjectTypes,
  serializeSegmentObjectTypes,
} from '@/lib/segmentObjects'
import { loadRecordsForType } from '@/lib/segmentData'
import Anthropic from '@anthropic-ai/sdk'

const STAGES = ['Prospect', 'Qualified', 'Proposal', 'Closed Won', 'Closed Lost']

// Default stages for the seeded pipeline
const DEFAULT_PIPELINE_STAGES = [
  { key: 'prospect', label: 'Prospect', order: 0 },
  { key: 'qualified', label: 'Qualified', order: 1 },
  { key: 'proposal', label: 'Proposal', order: 2 },
  { key: 'closed_won', label: 'Closed Won', order: 3, isClosedWon: true },
  { key: 'closed_lost', label: 'Closed Lost', order: 4, isClosedLost: true },
]

// --- Contacts ---

export async function createContact(formData: FormData) {
  const contact = await prisma.contact.create({
    data: {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: formData.get('email') as string,
      phone: (formData.get('phone') as string) || null,
      title: (formData.get('title') as string) || null,
      companyId: (formData.get('companyId') as string) || null,
    },
  })
  await prisma.activity.create({
    data: { type: 'note', title: 'Contact created', contactId: contact.id },
  })
  revalidatePath('/contacts')
  redirect(`/contacts/${contact.id}`)
}

export async function logActivity(formData: FormData) {
  const contactId = formData.get('contactId') as string
  const type = formData.get('type') as string
  const title = formData.get('title') as string
  const body = (formData.get('body') as string) || null
  await prisma.activity.create({ data: { type, title, body, contactId } })
  await refreshContactScore(contactId)
  revalidatePath(`/contacts/${contactId}`)
}

async function refreshContactScore(contactId: string) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { activities: true, opportunities: true },
  })
  if (!contact) return
  const score = computeLeadScore(contact)
  await prisma.contact.update({ where: { id: contactId }, data: { leadScore: score } })
}

// --- Companies ---

export async function createCompany(formData: FormData) {
  const company = await prisma.company.create({
    data: {
      name: formData.get('name') as string,
      domain: (formData.get('domain') as string) || null,
      industry: (formData.get('industry') as string) || null,
      size: (formData.get('size') as string) || null,
      website: (formData.get('website') as string) || null,
    },
  })
  revalidatePath('/companies')
  redirect(`/companies/${company.id}`)
}

// --- Opportunities ---

export async function createOpportunity(formData: FormData) {
  const opportunity = await prisma.opportunity.create({
    data: {
      name: formData.get('name') as string,
      value: parseFloat(formData.get('value') as string) || 0,
      stage: (formData.get('stage') as string) || 'Prospect',
      contactId: (formData.get('contactId') as string) || null,
      companyId: (formData.get('companyId') as string) || null,
    },
  })
  const contactId = formData.get('contactId') as string
  if (contactId) {
    await prisma.activity.create({
      data: {
        type: 'opportunity_created',
        title: `Opportunity "${opportunity.name}" created`,
        contactId,
        opportunityId: opportunity.id,
      },
    })
    await refreshContactScore(contactId)
  }
  revalidatePath('/opportunities')
}

export async function moveOpportunity(opportunityId: string, newStage: string) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { pipeline: true },
  })
  if (!opportunity) return

  // Pipeline-aware stage validation
  let validStageLabels: string[] = STAGES
  let isClosedWon = newStage === 'Closed Won'
  let isClosedLost = newStage === 'Closed Lost'
  if (opportunity.pipeline) {
    try {
      const pipelineStages = JSON.parse(opportunity.pipeline.stages) as Array<{
        key: string
        label: string
        order: number
        isClosedWon?: boolean
        isClosedLost?: boolean
      }>
      validStageLabels = pipelineStages.map(s => s.label)
      const found = pipelineStages.find(s => s.label === newStage)
      if (found) {
        isClosedWon = !!found.isClosedWon
        isClosedLost = !!found.isClosedLost
      }
    } catch { /* fallback to STAGES */ }
  }
  if (!validStageLabels.includes(newStage)) return

  const closedAt = isClosedWon || isClosedLost ? new Date() : null
  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { stage: newStage, closedAt },
  })
  if (opportunity.contactId) {
    await prisma.activity.create({
      data: {
        type: 'stage_change',
        title: `Opportunity moved to ${newStage}`,
        contactId: opportunity.contactId,
        opportunityId,
      },
    })
    await refreshContactScore(opportunity.contactId)
  }
  // Notify everyone on closed won
  if (isClosedWon) {
    const users = await prisma.user.findMany({ select: { id: true } })
    for (const u of users) {
      await prisma.notification.create({
        data: {
          userId: u.id,
          type: 'opportunity',
          title: `Opportunity closed won: ${opportunity.name}`,
          body: `$${opportunity.value.toLocaleString()}`,
          link: '/opportunities',
        },
      })
    }
  }
  revalidatePath('/opportunities')
  revalidatePath(`/contacts/${opportunity.contactId}`)
}

// --- Sequences ---

export async function createSequence(formData: FormData) {
  const name = formData.get('name') as string
  const description = (formData.get('description') as string) || null
  const trigger = (formData.get('trigger') as string) || 'Manual'

  const sequence = await prisma.sequence.create({
    data: { name, description, trigger },
  })
  revalidatePath('/sequences')
  redirect(`/sequences/${sequence.id}`)
}

export async function saveWorkflowState(
  sequenceId: string,
  nodesJson: string,
  edgesJson: string,
  isActive?: boolean,
) {
  const data: Record<string, unknown> = { nodesJson, edgesJson }
  if (isActive !== undefined) data.isActive = isActive
  await prisma.sequence.update({ where: { id: sequenceId }, data })
  revalidatePath(`/sequences/${sequenceId}`)
  revalidatePath('/sequences')
}

export async function toggleSequenceActive(sequenceId: string, isActive: boolean) {
  await prisma.sequence.update({ where: { id: sequenceId }, data: { isActive } })
  revalidatePath(`/sequences/${sequenceId}`)
  revalidatePath('/sequences')
}

export async function deleteSequence(sequenceId: string) {
  await prisma.enrollment.deleteMany({ where: { sequenceId } })
  await prisma.sequence.delete({ where: { id: sequenceId } })
  revalidatePath('/sequences')
  redirect('/sequences')
}

export async function enrollContact(formData: FormData) {
  const contactId = formData.get('contactId') as string
  const sequenceId = formData.get('sequenceId') as string
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { firstName: true, lastName: true },
  })
  const recordLabel = contact ? `${contact.firstName} ${contact.lastName}` : contactId
  const enrollment = await prisma.enrollment.create({
    data: {
      contactId,
      sequenceId,
      recordType: 'contact',
      recordId: contactId,
      recordLabel,
    },
  })
  await prisma.activity.create({
    data: {
      type: 'sequence_enrolled',
      title: 'Enrolled in email sequence',
      contactId,
    },
  })
  await prisma.workflowRunLog.create({
    data: {
      enrollmentId: enrollment.id,
      stepIndex: 0,
      nodeType: 'enrolled',
      nodeLabel: 'Enrolled',
      dataJson: JSON.stringify({ event: 'Contact enrolled manually', contactId }),
      status: 'completed',
    },
  })
  revalidatePath(`/contacts/${contactId}`)
  revalidatePath('/sequences')
  revalidatePath('/sequences/history')

  const { sequenceHasCanvasWorkflow, advanceWorkflowEnrollment } = await import('@/lib/workflowEngine')
  const seq = await prisma.sequence.findUnique({
    where: { id: sequenceId },
    select: { nodesJson: true, edgesJson: true },
  })
  if (sequenceHasCanvasWorkflow(seq?.nodesJson ?? '', seq?.edgesJson ?? '')) {
    await advanceWorkflowEnrollment(enrollment.id)
  }
}

/** Resume enrollments whose wait delay has elapsed. */
export async function tickWorkflows() {
  const { processDueWorkflowEnrollments } = await import('@/lib/workflowEngine')
  const processed = await processDueWorkflowEnrollments()
  revalidatePath('/sequences/history')
  return { processed }
}

export async function processSequenceStep(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      contact: true,
      sequence: { include: { steps: { orderBy: { order: 'asc' } } } },
    },
  })
  if (!enrollment || !enrollment.active) return
  const steps = enrollment.sequence.steps
  const step = steps[enrollment.currentStep]
  if (!step) {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { active: false, completedAt: new Date() },
    })
    await prisma.workflowRunLog.create({
      data: {
        enrollmentId,
        stepIndex: enrollment.currentStep,
        nodeType: 'completed',
        nodeLabel: 'Workflow Completed',
        dataJson: JSON.stringify({ event: 'All steps completed', completedAt: new Date().toISOString() }),
        status: 'completed',
      },
    })
    revalidatePath('/sequences/history')
    return
  }
  if (!enrollment.contactId || !enrollment.contact) {
    // Legacy email-step processor only operates on contact enrollments.
    return
  }
  await prisma.activity.create({
    data: {
      type: 'email',
      title: step.subject,
      body: step.body,
      contactId: enrollment.contactId,
    },
  })
  await prisma.workflowRunLog.create({
    data: {
      enrollmentId,
      stepIndex: enrollment.currentStep,
      nodeType: 'email',
      nodeLabel: step.subject,
      dataJson: JSON.stringify({
        subject: step.subject,
        body: step.body,
        dayOffset: step.dayOffset,
        to: enrollment.contact.email,
        contactName: `${enrollment.contact.firstName} ${enrollment.contact.lastName}`,
      }),
      status: 'completed',
    },
  })
  const nextStep = enrollment.currentStep + 1
  const isLast = nextStep >= steps.length
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: isLast
      ? { currentStep: nextStep, active: false, completedAt: new Date() }
      : { currentStep: nextStep },
  })
  if (isLast) {
    await prisma.workflowRunLog.create({
      data: {
        enrollmentId,
        stepIndex: nextStep,
        nodeType: 'completed',
        nodeLabel: 'Workflow Completed',
        dataJson: JSON.stringify({ event: 'All steps completed', completedAt: new Date().toISOString() }),
        status: 'completed',
      },
    })
  }
  await refreshContactScore(enrollment.contactId)
  revalidatePath(`/contacts/${enrollment.contactId}`)
  revalidatePath('/sequences/history')
}

// --- AI Enrichment ---

export async function enrichContact(contactId: string) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { company: true },
  })
  if (!contact) return

  const client = new Anthropic()
  const prompt = `You are a B2B contact enrichment AI. Given the following contact information, provide realistic enrichment data.

Contact:
- Name: ${contact.firstName} ${contact.lastName}
- Email: ${contact.email}
- Title: ${contact.title || 'unknown'}
- Company: ${contact.company?.name || 'unknown'}

Return ONLY a valid JSON object with these fields (no markdown, no explanation):
{
  "title": "inferred job title if not provided",
  "linkedin": "plausible linkedin URL",
  "companyIndustry": "industry if company known",
  "companySize": "employee range e.g. 50-200",
  "notes": "1-2 sentence summary of likely use case for CRM"
}`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const data = JSON.parse(text)

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        title: data.title || contact.title,
        linkedin: data.linkedin || contact.linkedin,
        enriched: true,
      },
    })
    if (contact.companyId && data.companyIndustry) {
      await prisma.company.update({
        where: { id: contact.companyId },
        data: {
          industry: data.companyIndustry,
          size: data.companySize,
        },
      })
    }
    await prisma.activity.create({
      data: {
        type: 'enrichment',
        title: 'Contact enriched by AI',
        body: data.notes,
        contactId,
      },
    })
    await refreshContactScore(contactId)
  } catch {
    // enrichment failed silently
  }
  revalidatePath(`/contacts/${contactId}`)
}

// --- Geocoding ---

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'CRM-App/1.0' } })
    const data = await res.json()
    if (!data[0]) return null
    const { lat, lon, display_name } = data[0]
    return { lat: parseFloat(lat), lng: parseFloat(lon), label: display_name }
  } catch {
    return null
  }
}

export async function geocodeContact(contactId: string) {
  const c = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!c) return
  const parts = [c.street, c.city, c.state, c.zip, c.country].filter(Boolean)
  if (!parts.length) return
  const result = await geocodeAddress(parts.join(', '))
  if (!result) return
  await prisma.contact.update({ where: { id: contactId }, data: { lat: result.lat, lng: result.lng } })
  revalidatePath(`/contacts/${contactId}`)
}

// --- Segments ---

export async function createSegment(formData: FormData) {
  const customDefs = await prisma.customObjectDef.findMany({ select: { id: true } })
  const customIds = new Set(customDefs.map(d => d.id))

  let objectTypes: string[] = ['contact']
  const rawTypes = formData.get('objectTypes') as string | null
  if (rawTypes) {
    try {
      const parsed = JSON.parse(rawTypes) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        objectTypes = filterValidObjectTypes(
          parsed.filter((t): t is string => typeof t === 'string'),
          customIds,
        )
      }
    } catch { /* keep default */ }
  }

  const segment = await prisma.segment.create({
    data: {
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || null,
      objectType: serializeSegmentObjectTypes(objectTypes),
    },
  })
  revalidatePath('/segments')
  redirect(`/segments/${segment.id}`)
}

export async function saveSegmentFilters(
  segmentId: string,
  filtersJson: string,
  name?: string,
  description?: string,
  objectTypesJson?: string,
) {
  const data: Record<string, string> = { filtersJson }
  if (name !== undefined) data.name = name
  if (description !== undefined) data.description = description
  if (objectTypesJson !== undefined) {
    const customDefs = await prisma.customObjectDef.findMany({ select: { id: true } })
    const customIds = new Set(customDefs.map(d => d.id))
    let types: string[] = ['contact']
    try {
      const parsed = JSON.parse(objectTypesJson) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        types = filterValidObjectTypes(
          parsed.filter((t): t is string => typeof t === 'string'),
          customIds,
        )
      }
    } catch { /* keep default */ }
    data.objectType = serializeSegmentObjectTypes(types)
  }
  await prisma.segment.update({ where: { id: segmentId }, data })
  revalidatePath(`/segments/${segmentId}`)
  revalidatePath('/segments')
}

export async function deleteSegment(segmentId: string) {
  await prisma.segment.delete({ where: { id: segmentId } })
  revalidatePath('/segments')
  redirect('/segments')
}

// --- Search ---

export async function searchRecords(query: string) {
  const q = query.trim()
  if (!q || q.length < 2) return { contacts: [], companies: [], opportunities: [] }
  const [contacts, companies, opportunities] = await Promise.all([
    prisma.contact.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } },
          { customFields: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { company: { select: { name: true } } },
      take: 6,
    }),
    prisma.company.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { domain: { contains: q, mode: 'insensitive' } },
          { industry: { contains: q, mode: 'insensitive' } },
          { customFields: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 6,
    }),
    prisma.opportunity.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { stage: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { contact: { select: { firstName: true, lastName: true } } },
      take: 6,
    }),
  ])
  return { contacts, companies, opportunities }
}

// --- Record Updates ---

export async function updateContact(
  id: string,
  data: {
    firstName: string; lastName: string; email: string; phone: string; title: string
    linkedin: string; street: string; city: string; state: string; zip: string; country: string
    customFields?: Record<string, string>
  },
) {
  await prisma.contact.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone || null,
      title: data.title || null,
      linkedin: data.linkedin || null,
      street: data.street || null,
      city: data.city || null,
      state: data.state || null,
      zip: data.zip || null,
      country: data.country || null,
      ...(data.customFields !== undefined ? { customFields: JSON.stringify(data.customFields) } : {}),
    },
  })
  revalidatePath(`/contacts/${id}`)
  revalidatePath('/contacts')
}

export async function updateCompany(
  id: string,
  data: {
    name: string; domain: string; industry: string; size: string; website: string
    customFields?: Record<string, string>
  },
) {
  await prisma.company.update({
    where: { id },
    data: {
      name: data.name,
      domain: data.domain || null,
      industry: data.industry || null,
      size: data.size || null,
      website: data.website || null,
      ...(data.customFields !== undefined ? { customFields: JSON.stringify(data.customFields) } : {}),
    },
  })
  revalidatePath(`/companies/${id}`)
  revalidatePath('/companies')
}

export async function updateOpportunity(
  id: string,
  data: { name: string; value: number; stage: string },
) {
  await prisma.opportunity.update({ where: { id }, data })
  revalidatePath('/opportunities')
}

// --- Bulk Delete ---

export async function clearAllRecords(target: 'contacts' | 'companies' | 'opportunities') {
  if (target === 'contacts') {
    await prisma.enrollment.deleteMany({})
    await prisma.activity.deleteMany({ where: { contactId: { not: null } } })
    await prisma.opportunity.updateMany({ data: { contactId: null } })
    await prisma.contact.deleteMany({})
    revalidatePath('/contacts')
    revalidatePath('/dashboard')
  } else if (target === 'companies') {
    await prisma.activity.deleteMany({ where: { companyId: { not: null } } })
    await prisma.opportunity.updateMany({ data: { companyId: null } })
    await prisma.contact.updateMany({ data: { companyId: null } })
    await prisma.company.deleteMany({})
    revalidatePath('/companies')
    revalidatePath('/contacts')
    revalidatePath('/dashboard')
  } else if (target === 'opportunities') {
    await prisma.activity.deleteMany({ where: { opportunityId: { not: null } } })
    await prisma.opportunity.deleteMany({})
    revalidatePath('/opportunities')
    revalidatePath('/dashboard')
  }
}

// --- CSV Import ---

export type ImportTask = { targetId: 'contact' | 'company'; mappedData: Record<string, string>[] }
export type ImportConflict = {
  targetId: string
  existingId: string
  identifier: string
  type: string
  diffs: Record<string, { current: string; import: string }>
}

export async function checkImportConflicts(tasks: ImportTask[]): Promise<ImportConflict[]> {
  const conflicts: ImportConflict[] = []
  for (const task of tasks) {
    if (task.targetId === 'company') {
      const names = [...new Set(task.mappedData.map((row) => row.name).filter(Boolean))]
      const domains = [...new Set(task.mappedData.map((row) => row.domain).filter(Boolean))]
      if (!names.length && !domains.length) continue
      const existingRows = await prisma.company.findMany({
        where: {
          OR: [
            ...(names.length ? [{ name: { in: names } }] : []),
            ...(domains.length ? [{ domain: { in: domains } }] : []),
          ],
        },
        select: { id: true, name: true, domain: true, industry: true, size: true, website: true },
      })
      const existingByName = new Map(existingRows.map((r) => [r.name, r]))
      const existingByDomain = new Map(
        existingRows
          .filter((r) => !!r.domain)
          .map((r) => [r.domain as string, r]),
      )
      for (const row of task.mappedData) {
        if (!row.name) continue
        const existing = existingByName.get(row.name) ?? (row.domain ? existingByDomain.get(row.domain) : null)
        if (existing) {
          const diffs: ImportConflict['diffs'] = {}
          for (const key of ['industry', 'size', 'website'] as const) {
            const importVal = row[key]
            const currentVal = existing[key]
            if (importVal && currentVal !== importVal) {
              diffs[key] = { current: currentVal ?? '(empty)', import: importVal }
            }
          }
          if (Object.keys(diffs).length) {
            conflicts.push({ targetId: 'company', existingId: existing.id, identifier: existing.name, type: 'Company', diffs })
          }
        }
      }
    } else if (task.targetId === 'contact') {
      const emails = [...new Set(task.mappedData.map((row) => row.email).filter(Boolean))]
      if (!emails.length) continue
      const existingRows = await prisma.contact.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true, firstName: true, lastName: true, title: true, phone: true },
      })
      const existingByEmail = new Map(existingRows.map((r) => [r.email, r]))
      for (const row of task.mappedData) {
        if (!row.email) continue
        const existing = existingByEmail.get(row.email)
        if (existing) {
          const diffs: ImportConflict['diffs'] = {}
          for (const key of ['firstName', 'lastName', 'title', 'phone'] as const) {
            const importVal = row[key]
            const currentVal = existing[key]
            if (importVal && currentVal !== importVal) {
              diffs[key] = { current: currentVal ?? '(empty)', import: importVal }
            }
          }
          if (Object.keys(diffs).length) {
            conflicts.push({ targetId: 'contact', existingId: existing.id, identifier: existing.email, type: 'Contact', diffs })
          }
        }
      }
    }
  }
  return conflicts
}

const COMPANY_STANDARD_KEYS = new Set(['name', 'domain', 'industry', 'size', 'website', '_customFields', '_companyAssociation'])
const CONTACT_STANDARD_KEYS = new Set(['firstName', 'lastName', 'email', 'phone', 'title', 'linkedin', 'leadScore', 'street', 'city', 'state', 'zip', 'country', '_customFields', '_companyAssociation'])

function parseJsonRecord(json: string | null | undefined): Record<string, string> {
  try {
    const parsed = JSON.parse(json || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, string>
      : {}
  } catch {
    return {}
  }
}

function customFieldsFromImportRow(
  row: Record<string, string>,
  standardKeys: Set<string>,
): Record<string, string> {
  const customFields = parseJsonRecord(row._customFields)
  for (const [k, v] of Object.entries(row)) {
    if (!standardKeys.has(k) && v) customFields[k] = v
  }
  return customFields
}

async function ensureCustomFieldDefs(objectType: string, customKeys: string[]) {
  const uniqueKeys = [...new Set(customKeys.filter(Boolean))]
  if (!uniqueKeys.length) return
  const existing = await prisma.fieldDefinition.findMany({
    where: { objectType, key: { in: uniqueKeys }, isBuiltIn: false },
    select: { key: true },
  })
  const existingKeys = new Set(existing.map((f) => f.key))
  const missing = uniqueKeys.filter((key) => !existingKeys.has(key))
  if (!missing.length) return
  const maxOrder = await prisma.fieldDefinition.aggregate({
    where: { objectType },
    _max: { order: true },
  })
  const startOrder = (maxOrder._max.order ?? 100) + 1
  await prisma.fieldDefinition.createMany({
    data: missing.map((key, i) => ({
      objectType,
      key,
      label: key.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      fieldType: 'text',
      isBuiltIn: false,
      required: false,
      isPrimary: false,
      order: startOrder + i,
      hidden: false,
    })),
  })
}

export async function bulkImportCompanies(rows: Record<string, string>[]): Promise<Record<string, string>> {
  const preparedRows = rows
    .filter((row) => !!row.name)
    .map((row) => ({
      name: row.name,
      domain: row.domain || null,
      industry: row.industry || null,
      size: row.size || null,
      website: row.website || null,
      customFields: customFieldsFromImportRow(row, COMPANY_STANDARD_KEYS),
    }))
  if (!preparedRows.length) return {}

  const allCustomKeys = new Set<string>()
  for (const row of preparedRows) {
    for (const key of Object.keys(row.customFields)) allCustomKeys.add(key)
  }

  const names = [...new Set(preparedRows.map((row) => row.name))]
  const domains = [...new Set(preparedRows.map((row) => row.domain).filter(Boolean))] as string[]
  const existingRows = await prisma.company.findMany({
    where: {
      OR: [
        ...(names.length ? [{ name: { in: names } }] : []),
        ...(domains.length ? [{ domain: { in: domains } }] : []),
      ],
    },
    select: { id: true, name: true, domain: true, customFields: true },
  })
  const existingByName = new Map(existingRows.map((row) => [row.name, row]))
  const existingByDomain = new Map(existingRows.filter((row) => !!row.domain).map((row) => [row.domain as string, row]))
  const mergedCustomById = new Map(existingRows.map((row) => [row.id, parseJsonRecord(row.customFields)]))

  const createByName = new Map<string, {
    name: string
    domain: string | null
    industry: string | null
    size: string | null
    website: string | null
    customFields: Record<string, string>
  }>()
  const companyMap: Record<string, string> = {}

  for (const row of preparedRows) {
    const existing = existingByName.get(row.name) ?? (row.domain ? existingByDomain.get(row.domain) : null)
    if (existing) {
      const merged = mergedCustomById.get(existing.id) ?? {}
      mergedCustomById.set(existing.id, { ...merged, ...row.customFields })
      companyMap[row.name] = existing.id
      continue
    }
    const pending = createByName.get(row.name)
    if (pending) {
      pending.domain = pending.domain || row.domain
      pending.industry = pending.industry || row.industry
      pending.size = pending.size || row.size
      pending.website = pending.website || row.website
      pending.customFields = { ...pending.customFields, ...row.customFields }
      continue
    }
    createByName.set(row.name, { ...row })
  }

  const toCreate = [...createByName.values()]
  if (toCreate.length) {
    await prisma.company.createMany({
      data: toCreate.map((row) => ({
        name: row.name,
        domain: row.domain,
        industry: row.industry,
        size: row.size,
        website: row.website,
        customFields: JSON.stringify(row.customFields),
      })),
    })
    const createdRows = await prisma.company.findMany({
      where: { name: { in: toCreate.map((row) => row.name) } },
      select: { id: true, name: true },
    })
    for (const row of createdRows) {
      companyMap[row.name] = row.id
    }
  }

  const updates: Promise<unknown>[] = []
  for (const existing of existingRows) {
    const merged = mergedCustomById.get(existing.id) ?? {}
    const mergedJson = JSON.stringify(merged)
    if (mergedJson === (existing.customFields || '{}')) continue
    updates.push(
      prisma.company.update({
        where: { id: existing.id },
        data: { customFields: mergedJson },
      }),
    )
  }
  if (updates.length) {
    await Promise.all(updates)
  }

  await ensureCustomFieldDefs('company', [...allCustomKeys])
  return companyMap
}

export async function bulkImportContacts(rows: Record<string, string>[], companyMap: Record<string, string>) {
  const preparedRows = rows.map((row) => {
    const email = row.email || `unknown_${Math.random().toString(36).slice(2)}@import.csv`
    return {
      email,
      firstName: row.firstName || 'Unknown',
      lastName: row.lastName || 'Unknown',
      title: row.title || null,
      phone: row.phone || null,
      linkedin: row.linkedin || null,
      companyId: row._companyAssociation ? companyMap[row._companyAssociation] ?? null : null,
      customFields: customFieldsFromImportRow(row, CONTACT_STANDARD_KEYS),
      raw: row,
    }
  })
  if (!preparedRows.length) return

  const allCustomKeys = new Set<string>()
  for (const row of preparedRows) {
    for (const key of Object.keys(row.customFields)) allCustomKeys.add(key)
  }

  const existingRows = await prisma.contact.findMany({
    where: { email: { in: [...new Set(preparedRows.map((row) => row.email))] } },
    select: { id: true, email: true, customFields: true },
  })
  const existingByEmail = new Map(existingRows.map((row) => [row.email, row]))

  const toCreate: Array<{
    firstName: string
    lastName: string
    email: string
    title: string | null
    phone: string | null
    linkedin: string | null
    companyId: string | null
    customFields: string
  }> = []
  const updateOps: Promise<unknown>[] = []

  for (const row of preparedRows) {
    const existing = existingByEmail.get(row.email)
    if (!existing) {
      toCreate.push({
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        title: row.title,
        phone: row.phone,
        linkedin: row.linkedin,
        companyId: row.companyId,
        customFields: JSON.stringify(row.customFields),
      })
      continue
    }
    const mergedCustom = { ...parseJsonRecord(existing.customFields), ...row.customFields }
    updateOps.push(
      prisma.contact.update({
        where: { email: row.email },
        data: {
          firstName: row.raw.firstName || undefined,
          lastName: row.raw.lastName || undefined,
          title: row.raw.title || undefined,
          phone: row.raw.phone || undefined,
          linkedin: row.raw.linkedin || undefined,
          companyId: row.companyId || undefined,
          ...(Object.keys(mergedCustom).length > 0 ? { customFields: JSON.stringify(mergedCustom) } : {}),
        },
      }),
    )
  }

  if (toCreate.length) {
    await prisma.contact.createMany({
      data: toCreate,
      skipDuplicates: true,
    })
  }
  if (updateOps.length) {
    await Promise.all(updateOps)
  }
  await ensureCustomFieldDefs('contact', [...allCustomKeys])
}

export async function bulkImportAll(tasks: ImportTask[]): Promise<{ companies: number; contacts: number }> {
  const companyTask = tasks.find((t) => t.targetId === 'company')
  const contactTask = tasks.find((t) => t.targetId === 'contact')
  let companyMap: Record<string, string> = {}

  if (companyTask?.mappedData.length) {
    companyMap = await bulkImportCompanies(companyTask.mappedData)
  }
  if (contactTask?.mappedData.length) {
    await bulkImportContacts(contactTask.mappedData, companyMap)
  }

  revalidatePath('/companies')
  revalidatePath('/contacts')
  revalidatePath('/dashboard')

  return {
    companies: companyTask?.mappedData.length ?? 0,
    contacts: contactTask?.mappedData.length ?? 0,
  }
}

import {
  enrichAllRows,
  type EnrichTargetId,
  type EnrichMode,
  type EnrichRequest,
  type EnrichResult,
} from '@/lib/enrichRecords'

export type { EnrichTargetId, EnrichMode, EnrichRequest, EnrichResult }

/** @deprecated Prefer POST /api/import/enrich for large CSV files. */
export async function enrichRecordsFromCsv(req: EnrichRequest & { revalidate?: boolean }): Promise<EnrichResult> {
  const result = await enrichAllRows(req)
  if (req.revalidate !== false) {
    revalidatePath('/contacts')
    revalidatePath('/companies')
    revalidatePath('/opportunities')
  }
  return result
}

// --- Users ---

export async function createUser(formData: FormData) {
  const password = formData.get('password') as string | null
  let hashedPassword: string | null = null
  if (password?.trim()) {
    const { createHash } = await import('crypto')
    hashedPassword = createHash('sha256').update(password.trim()).digest('hex')
  }
  await prisma.user.create({
    data: {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      role: (formData.get('role') as string) || 'member',
      color: (formData.get('color') as string) || '#6366f1',
      password: hashedPassword,
    },
  })
  revalidatePath('/users')
}

export async function updateUser(id: string, data: { name: string; email: string; role: string; color: string; password?: string }) {
  const { password, ...rest } = data
  const update: Record<string, unknown> = { ...rest }
  if (password?.trim()) {
    const { createHash } = await import('crypto')
    update.password = createHash('sha256').update(password.trim()).digest('hex')
  }
  await prisma.user.update({ where: { id }, data: update })
  revalidatePath('/users')
}

export async function deleteUser(id: string) {
  await prisma.user.delete({ where: { id } })
  revalidatePath('/users')
}

// --- Tasks ---

export async function createTask(data: {
  title: string
  description?: string
  status?: string
  priority?: string
  dueDate?: string
  assigneeId?: string | null
  contactId?: string | null
  companyId?: string | null
  opportunityId?: string | null
  segmentId?: string | null
}) {
  await prisma.task.create({
    data: {
      title: data.title,
      description: data.description || null,
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      assigneeId: data.assigneeId ?? null,
      contactId: data.contactId ?? null,
      companyId: data.companyId ?? null,
      opportunityId: data.opportunityId ?? null,
      segmentId: data.segmentId ?? null,
    },
  })
  if (data.assigneeId) {
    await prisma.notification.create({
      data: {
        userId: data.assigneeId,
        type: 'task',
        title: `New task: ${data.title}`,
        body: data.description || null,
        link: '/tasks',
      },
    })
  }
  revalidatePath('/tasks')
  revalidatePath('/my-work')
}

export async function updateTask(id: string, data: {
  title?: string
  description?: string
  status?: string
  priority?: string
  dueDate?: string | null
  assigneeId?: string | null
  contactId?: string | null
  companyId?: string | null
  opportunityId?: string | null
  segmentId?: string | null
}) {
  const { dueDate, ...rest } = data
  await prisma.task.update({
    where: { id },
    data: {
      ...rest,
      dueDate: dueDate === undefined ? undefined : dueDate ? new Date(dueDate) : null,
    },
  })
  revalidatePath('/tasks')
  revalidatePath('/my-work')
}

export async function updateTaskStatus(id: string, status: string) {
  const task = await prisma.task.update({ where: { id }, data: { status } })
  if (status === 'done' && task.assigneeId) {
    await prisma.notification.create({
      data: {
        userId: task.assigneeId,
        type: 'task',
        title: `Task completed: ${task.title}`,
        link: '/tasks',
      },
    })
  }
  revalidatePath('/tasks')
  revalidatePath('/my-work')
}

/** Apply form field values to the record linked on the task, then mark the task done. */
export async function submitFormFromTask(
  taskId: string,
  formId: string,
  values: Record<string, string>,
) {
  const { parseFormIdFromTask } = await import('@/lib/formTasks')
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw new Error('Task not found')
  if (parseFormIdFromTask(task) !== formId) throw new Error('Form does not match this task')

  const form = await prisma.form.findUnique({ where: { id: formId } })
  if (!form) throw new Error('Form not found')

  const { parseFormLayout, fieldValueKey } = await import('@/lib/formLayout')
  const sections = parseFormLayout(form.layoutJson)
  const fields = sections.flatMap(s => s.rows.flatMap(r => r.columns.filter(Boolean) as import('@/lib/formLayout').FormField[]))

  const byObject = new Map<string, Record<string, string>>()
  for (const field of fields) {
    const raw = values[fieldValueKey(field)]
    if (raw === undefined || raw === '') continue
    const bucket = byObject.get(field.objectType) ?? {}
    bucket[field.fieldKey] = raw
    byObject.set(field.objectType, bucket)
  }

  const COMPANY_STD = new Set(['name', 'domain', 'industry', 'size', 'website'])
  const CONTACT_STD = new Set([
    'firstName', 'lastName', 'email', 'phone', 'title', 'linkedin',
    'leadScore', 'street', 'city', 'state', 'zip', 'country', 'enriched',
  ])
  const OPPORTUNITY_STD = new Set(['name', 'value', 'stage'])
  if (byObject.has('deal') && !byObject.has('opportunity')) {
    byObject.set('opportunity', byObject.get('deal')!)
  }

  async function applyCustomFields(
    existingJson: string,
    incoming: Record<string, string>,
    stdKeys: Set<string>,
  ) {
    let existing: Record<string, string> = {}
    try { existing = JSON.parse(existingJson || '{}') } catch { /* ignore */ }
    for (const [k, v] of Object.entries(incoming)) {
      if (stdKeys.has(k)) continue
      const customKey = k.startsWith('custom_') ? k.slice(7) : k
      existing[customKey] = v
    }
    return JSON.stringify(existing)
  }

  if (task.companyId && byObject.has('company')) {
    const data = byObject.get('company')!
    const company = await prisma.company.findUnique({ where: { id: task.companyId } })
    if (company) {
      await prisma.company.update({
        where: { id: task.companyId },
        data: {
          name: data.name ?? company.name,
          domain: data.domain ?? company.domain,
          industry: data.industry ?? company.industry,
          size: data.size ?? company.size,
          website: data.website ?? company.website,
          customFields: await applyCustomFields(company.customFields, data, COMPANY_STD),
        },
      })
    }
  }

  if (task.contactId && byObject.has('contact')) {
    const data = byObject.get('contact')!
    const contact = await prisma.contact.findUnique({ where: { id: task.contactId } })
    if (contact) {
      const leadScore = data.leadScore !== undefined ? parseInt(data.leadScore, 10) : contact.leadScore
      await prisma.contact.update({
        where: { id: task.contactId },
        data: {
          firstName: data.firstName ?? contact.firstName,
          lastName: data.lastName ?? contact.lastName,
          email: data.email ?? contact.email,
          phone: data.phone ?? contact.phone,
          title: data.title ?? contact.title,
          linkedin: data.linkedin ?? contact.linkedin,
          street: data.street ?? contact.street,
          city: data.city ?? contact.city,
          state: data.state ?? contact.state,
          zip: data.zip ?? contact.zip,
          country: data.country ?? contact.country,
          leadScore: isNaN(leadScore) ? contact.leadScore : leadScore,
          enriched: data.enriched === 'true' ? true : data.enriched === 'false' ? false : contact.enriched,
          customFields: await applyCustomFields(contact.customFields, data, CONTACT_STD),
        },
      })
    }
  }

  if (task.opportunityId && byObject.has('opportunity')) {
    const data = byObject.get('opportunity')!
    const opportunity = await prisma.opportunity.findUnique({ where: { id: task.opportunityId } })
    if (opportunity) {
      const value = data.value !== undefined ? parseFloat(data.value) : opportunity.value
      await prisma.opportunity.update({
        where: { id: task.opportunityId },
        data: {
          name: data.name ?? opportunity.name,
          stage: data.stage ?? opportunity.stage,
          value: isNaN(value) ? opportunity.value : value,
        },
      })
    }
  }

  if (task.contactId) {
    await prisma.activity.create({
      data: {
        type: 'form_submitted',
        title: `Form submitted: ${form.name}`,
        body: task.title,
        contactId: task.contactId,
      },
    })
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'done' },
  })

  revalidatePath('/tasks')
  revalidatePath('/my-work')
  if (task.companyId) revalidatePath(`/companies/${task.companyId}`)
  if (task.contactId) revalidatePath(`/contacts/${task.contactId}`)
  revalidatePath('/opportunities')
}

export async function deleteTask(id: string) {
  await prisma.task.delete({ where: { id } })
  revalidatePath('/tasks')
  revalidatePath('/my-work')
}

export async function deleteTasks(ids: string[]) {
  if (ids.length === 0) return
  await prisma.task.deleteMany({ where: { id: { in: ids } } })
  revalidatePath('/tasks')
  revalidatePath('/my-work')
}

// --- Segment Workflow Links ---

export async function assignSegmentToWorkflow(segmentId: string, sequenceId: string, assignedUserId: string | null) {
  return prisma.segmentWorkflowLink.upsert({
    where: { segmentId_sequenceId: { segmentId, sequenceId } },
    update: { assignedUserId },
    create: { segmentId, sequenceId, assignedUserId },
  })
}

export async function removeSegmentWorkflowLink(id: string) {
  return prisma.segmentWorkflowLink.delete({ where: { id } })
}

export async function getWorkflowExecutionPreview(linkId: string) {
  const link = await prisma.segmentWorkflowLink.findUnique({
    where: { id: linkId },
    include: { segment: true, sequence: true },
  })
  if (!link) throw new Error('Link not found')

  const {
    resolveSegmentMembers,
    memberObjectType,
  } = await import('@/lib/segmentData')
  const { parseSegmentObjectTypes } = await import('@/lib/segmentObjects')
  const { parseWorkflowNodes, extractFormNodes, extractTaskNodes } = await import('@/lib/workflowExecution')

  const members = await resolveSegmentMembers(link.segment)
  const objectTypes = parseSegmentObjectTypes(link.segment)
  const defaultType = objectTypes[0]
  const contactCount = members.filter(m => memberObjectType(m, defaultType) === 'contact').length

  const typeCounts = new Map<string, number>()
  for (const m of members) {
    const t = memberObjectType(m, defaultType)
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
  }
  const typeLabel = (t: string, n: number) => {
    const labels: Record<string, [string, string]> = {
      contact: ['contact', 'contacts'],
      company: ['company', 'companies'],
      opportunity: ['opportunity', 'opportunities'],
    }
    const [one, many] = labels[t] ?? [t, `${t}s`]
    return `${n} ${n === 1 ? one : many}`
  }
  const recordSummary = [...typeCounts.entries()].map(([t, n]) => typeLabel(t, n)).join(', ')

  const forms = await prisma.form.findMany({ select: { id: true, name: true } })
  const formNames = new Map(forms.map(f => [f.id, f.name]))
  const nodes = parseWorkflowNodes(link.sequence.nodesJson)
  const formNodes = extractFormNodes(nodes, formNames)
  const taskNodes = extractTaskNodes(nodes)

  return {
    segmentName: link.segment.name,
    workflowName: link.sequence.name,
    recordCount: members.length,
    contactCount,
    recordSummary: recordSummary || '0 records',
    formNodes,
    taskNodeCount: taskNodes.length,
  }
}

export async function executeSegmentWorkflow(
  linkId: string,
  options?: { formMode?: 'per_record' | 'per_segment' },
) {
  const link = await prisma.segmentWorkflowLink.findUnique({
    where: { id: linkId },
    include: {
      segment: true,
      sequence: { include: { steps: { orderBy: { order: 'asc' } } } },
    },
  })
  if (!link) throw new Error('Link not found')

  const {
    resolveSegmentMembers,
    memberObjectType,
    workflowLinkForMember,
  } = await import('@/lib/segmentData')
  const { parseSegmentObjectTypes } = await import('@/lib/segmentObjects')
  const members = await resolveSegmentMembers(link.segment)
  const objectTypes = parseSegmentObjectTypes(link.segment)
  const defaultType = objectTypes[0]

  const { parseWorkflowNodes, extractFormNodes, extractTaskNodes } = await import('@/lib/workflowExecution')
  const { advanceWorkflowEnrollment, sequenceHasCanvasWorkflow } = await import('@/lib/workflowEngine')
  const formMode = options?.formMode ?? 'per_record'

  const forms = await prisma.form.findMany({ select: { id: true, name: true } })
  const formNames = new Map(forms.map(f => [f.id, f.name]))
  const nodes = parseWorkflowNodes(link.sequence.nodesJson)
  const taskNodes = extractTaskNodes(nodes)
  const formNodes = extractFormNodes(nodes, formNames)
  const hasCanvas = sequenceHasCanvasWorkflow(
    link.sequence.nodesJson,
    link.sequence.edgesJson,
  )

  const contextJson = JSON.stringify({
    formMode,
    segmentId: link.segmentId,
    assignedUserId: link.assignedUserId,
  })

  let enrolled = 0
  let tasksCreated = 0
  let formsAssigned = 0

  for (const member of members) {
    const objectType = memberObjectType(member, defaultType)
    const recordId = member._id
    const displayName = (member._displayName as string) || recordId
    const recordLink = workflowLinkForMember(objectType, recordId)

    if (hasCanvas) {
      let enrollment = await prisma.enrollment.findFirst({
        where: {
          sequenceId: link.sequenceId,
          recordType: objectType,
          recordId,
        },
      })

      if (enrollment && !enrollment.active) {
        await prisma.workflowRunLog.deleteMany({ where: { enrollmentId: enrollment.id } })
        enrollment = await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: {
            active: true,
            completedAt: null,
            currentStep: 0,
            currentNodeId: null,
            resumeAt: null,
            contextJson,
            recordLabel: displayName,
            ...recordLink,
          },
        })
      }

      if (!enrollment) {
        enrollment = await prisma.enrollment.create({
          data: {
            sequenceId: link.sequenceId,
            recordType: objectType,
            recordId,
            recordLabel: displayName,
            currentStep: 0,
            active: true,
            contextJson,
            ...recordLink,
          },
        })
        await prisma.workflowRunLog.create({
          data: {
            enrollmentId: enrollment.id,
            stepIndex: 0,
            nodeType: 'enrolled',
            nodeLabel: 'Enrolled via Segment',
            dataJson: JSON.stringify({
              event: 'Bulk enrolled via segment',
              segmentName: link.segment.name,
              objectType,
              recordLabel: displayName,
            }),
            status: 'completed',
          },
        })
        enrolled++
      }

      if (enrollment.active) {
        const result = await advanceWorkflowEnrollment(enrollment.id)
        tasksCreated += result.tasksCreated
        formsAssigned += result.formsAssigned
      }
      continue
    }

    // Legacy bulk path (no canvas workflow): create task-node tasks per record.
    for (const tn of taskNodes) {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + parseInt(tn.due || '1', 10))
      await prisma.task.create({
        data: {
          title: tn.title,
          priority: tn.priority,
          dueDate,
          assigneeId: tn.assigneeId || link.assignedUserId || null,
          segmentId: link.segmentId,
          ...recordLink,
        },
      })
      tasksCreated++
    }

    if (formMode === 'per_record' && formNodes.length > 0) {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 3)
      const formLabels = formNodes.map(f => f.label).join(', ')
      const formLinks = formNodes.map(f => `/forms/${f.formId}`).join('\n')
      const assigneeId =
        formNodes.find(f => f.assigneeId)?.assigneeId || link.assignedUserId || null
      await prisma.task.create({
        data: {
          title:
            formNodes.length === 1
              ? `Fill form: ${formNodes[0].label}`
              : `Fill forms: ${formLabels}`,
          description: [
            `Complete the assigned form${formNodes.length === 1 ? '' : 's'} for ${displayName} (${objectType}).`,
            formLinks,
          ].join('\n'),
          priority: 'medium',
          dueDate,
          assigneeId,
          segmentId: link.segmentId,
          ...recordLink,
        },
      })
      formsAssigned++
    }
  }

  // One form task for the entire segment (per_segment mode; canvas workflows create it at the form step)
  if (formMode === 'per_segment' && formNodes.length > 0 && !hasCanvas) {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7)
    const formLabels = formNodes.map(f => f.label).join(', ')
    const formLinks = formNodes.map(f => `/forms/${f.formId}`).join('\n')
    const assigneeId =
      formNodes.find(f => f.assigneeId)?.assigneeId || link.assignedUserId || null
    await prisma.task.create({
      data: {
        title:
          formNodes.length === 1
            ? `Fill form: ${formLabels} (${link.segment.name})`
            : `Fill forms for segment: ${link.segment.name}`,
        description: [
          `One shared form assignment for the entire segment (${members.length} records).`,
          `Forms: ${formLabels}`,
          formLinks,
        ].join('\n'),
        priority: 'medium',
        dueDate,
        assigneeId,
        segmentId: link.segmentId,
      },
    })
    formsAssigned = 1
  }

  if (hasCanvas) {
    const { processDueWorkflowEnrollments } = await import('@/lib/workflowEngine')
    await processDueWorkflowEnrollments()
  }

  if (link.assignedUserId) {
    await prisma.notification.create({
      data: {
        userId: link.assignedUserId,
        type: 'workflow',
        title: `Workflow ran on ${link.segment.name}`,
        body: `Processed ${members.length} record${members.length !== 1 ? 's' : ''}${enrolled > 0 ? `, ${enrolled} contact${enrolled !== 1 ? 's' : ''} enrolled` : ''}`,
        link: `/segments/${link.segmentId}`,
      },
    })
  }

  revalidatePath('/segments')
  revalidatePath(`/segments/${link.segmentId}`)
  revalidatePath(`/sequences/${link.sequenceId}`)
  revalidatePath('/sequences/history')
  revalidatePath('/tasks')
  revalidatePath('/my-work')
  return { enrolled, total: members.length, tasksCreated, formsAssigned }
}

// --- Segment Assignments ---

export async function assignSegmentToUser(segmentId: string, userId: string) {
  await prisma.segmentAssignment.upsert({
    where: { segmentId_userId: { segmentId, userId } },
    update: {},
    create: { segmentId, userId },
  })
  const segment = await prisma.segment.findUnique({ where: { id: segmentId }, select: { name: true } })
  if (segment) {
    await prisma.notification.create({
      data: {
        userId,
        type: 'mention',
        title: `You were assigned segment ${segment.name}`,
        link: `/segments/${segmentId}`,
      },
    })
  }
  revalidatePath(`/segments/${segmentId}`)
}

export async function removeSegmentAssignment(id: string, segmentId: string) {
  await prisma.segmentAssignment.delete({ where: { id } })
  revalidatePath(`/segments/${segmentId}`)
}

// --- CRM Settings ---

export async function getCRMSettings() {
  return prisma.cRMSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', name: 'CRM' },
  })
}

export async function updateCRMSettings(data: { name: string; logoData?: string | null }) {
  await prisma.cRMSettings.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', name: data.name, logoData: data.logoData ?? null },
  })
  revalidatePath('/', 'layout')
}

// --- Custom Object Definitions ---

export async function createCustomObjectDef(data: {
  name: string; pluralName: string; slug: string; icon: string; color: string
}) {
  const obj = await prisma.customObjectDef.create({ data })
  revalidatePath('/setup')
  redirect(`/setup/objects/${obj.id}`)
}

export async function updateCustomObjectDef(id: string, data: {
  name?: string; pluralName?: string; icon?: string; color?: string
}) {
  await prisma.customObjectDef.update({ where: { id }, data })
  revalidatePath('/setup')
  revalidatePath(`/setup/objects/${id}`)
}

export async function deleteCustomObjectDef(id: string) {
  await prisma.customObjectDef.delete({ where: { id } })
  revalidatePath('/setup')
  redirect('/setup')
}

// --- Field Definitions ---

type FieldDefInput = {
  id?: string
  key: string
  label: string
  fieldType: string
  selectOptions: string[]
  required: boolean
  isPrimary: boolean
  order: number
  isBuiltIn: boolean
}

export async function saveFieldDefinitions(
  objectType: string | null,
  customObjectDefId: string | null,
  fields: FieldDefInput[],
) {
  const { saveSchemaFields } = await import('@/lib/schemaSave')
  await saveSchemaFields(objectType, customObjectDefId, fields)
}

// --- Object Relationships ---

export async function getObjectRelationships() {
  'use server'
  return prisma.objectRelationship.findMany({ orderBy: { createdAt: 'asc' } })
}

export async function createObjectRelationship(data: {
  fromObject: string; fromField: string; toObject: string; toField: string; relType: string; label: string
}) {
  'use server'
  return prisma.objectRelationship.create({ data })
}

export async function deleteObjectRelationship(id: string) {
  'use server'
  return prisma.objectRelationship.delete({ where: { id } })
}

export async function updateObjectRelationship(
  id: string,
  data: {
    relType?: string
    label?: string
    fromObject?: string
    fromField?: string
    toObject?: string
    toField?: string
  },
) {
  'use server'
  return prisma.objectRelationship.update({ where: { id }, data })
}

// --- Webhook integrations ---

export async function getWebhookIntegrations() {
  'use server'
  return prisma.webhookIntegration.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function getWebhookIntegration(id: string) {
  'use server'
  return prisma.webhookIntegration.findUnique({ where: { id } })
}

export async function createWebhookIntegration(name: string) {
  'use server'
  return prisma.webhookIntegration.create({
    data: {
      name: name.trim() || 'Stripe webhook',
      provider: 'stripe',
      targetKind: 'custom',
      targetSlug: 'vb',
      eventTypes: JSON.stringify(['payment_intent.succeeded']),
      fieldMappings: JSON.stringify([]),
      upsertFieldKey: 'trx_id',
    },
  })
}

export type SaveWebhookIntegrationInput = {
  name: string
  enabled: boolean
  targetKind: 'standard' | 'custom'
  targetSlug: string
  eventTypes: string[]
  fieldMappings: import('@/lib/webhooks/types').WebhookFieldMapping[]
  upsertFieldKey: string
  webhookSecret: string
}

export async function saveWebhookIntegration(id: string, input: SaveWebhookIntegrationInput) {
  'use server'
  const updated = await prisma.webhookIntegration.update({
    where: { id },
    data: {
      name: input.name.trim(),
      enabled: input.enabled,
      targetKind: input.targetKind,
      targetSlug: input.targetSlug,
      eventTypes: JSON.stringify(input.eventTypes),
      fieldMappings: JSON.stringify(input.fieldMappings),
      upsertFieldKey: input.upsertFieldKey,
      webhookSecret: input.webhookSecret,
    },
  })
  return updated
}

export async function deleteWebhookIntegration(id: string) {
  'use server'
  await prisma.webhookIntegration.delete({ where: { id } })
}

export async function getWebhookTargetOptions() {
  'use server'
  const { listWebhookTargetOptions } = await import('@/lib/webhooks/applyIntegration')
  return listWebhookTargetOptions()
}

export async function getWebhookFieldOptions(
  targetKind: 'standard' | 'custom',
  targetSlug: string,
) {
  'use server'
  const { getTargetFieldOptions } = await import('@/lib/webhooks/applyIntegration')
  return getTargetFieldOptions(targetKind, targetSlug)
}

export type AddWebhookTargetFieldInput = {
  key: string
  label: string
  fieldType?: string
}

export async function addWebhookTargetFields(
  targetKind: 'standard' | 'custom',
  targetSlug: string,
  fields: AddWebhookTargetFieldInput[],
) {
  'use server'

  let objectType: string | null = targetKind === 'standard' ? targetSlug : null
  let customObjectDefId: string | null = null
  let schemaSlug = targetSlug

  if (targetKind === 'custom') {
    const def = await prisma.customObjectDef.findFirst({
      where: { OR: [{ slug: targetSlug }, { id: targetSlug }] },
    })
    if (!def) throw new Error('Custom object not found')
    customObjectDefId = def.id
    schemaSlug = def.id
    objectType = null
  }

  const { loadSchemaFields } = await import('@/lib/objectSchema')
  const schema = await loadSchemaFields(schemaSlug)
  const existingKeys = new Set(schema.allFields.map((f) => f.key))

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

  const toAdd = fields
    .map((f) => ({
      key: slugify(f.key),
      label: f.label.trim() || f.key,
      fieldType: f.fieldType || 'text',
    }))
    .filter((f) => f.key && !existingKeys.has(f.key))

  if (toAdd.length > 0) {
    const merged = [
      ...schema.allFields.map((f) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        fieldType: f.fieldType,
        selectOptions: f.selectOptions,
        required: f.required,
        isPrimary: f.isPrimary,
        order: f.order,
        isBuiltIn: f.isBuiltIn,
      })),
      ...toAdd.map((f, i) => ({
        key: f.key,
        label: f.label,
        fieldType: f.fieldType,
        selectOptions: [] as string[],
        required: false,
        isPrimary: false,
        order: schema.allFields.length + i,
        isBuiltIn: false,
      })),
    ]
    const { saveSchemaFields } = await import('@/lib/schemaSave')
    await saveSchemaFields(objectType, customObjectDefId, merged)
  }

  revalidatePath('/setup/webhooks')
  revalidatePath(`/setup/webhooks/${targetSlug}`)
  const { getTargetFieldOptions } = await import('@/lib/webhooks/applyIntegration')
  return getTargetFieldOptions(targetKind, targetSlug)
}

// --- Custom Object Records ---

export async function createCustomObjectRecord(objectDefId: string, data: Record<string, string>) {
  const record = await prisma.customObjectRecord.create({
    data: { objectDefId, data: JSON.stringify(data) },
  })
  revalidatePath(`/objects/${objectDefId}`)
  redirect(`/objects/${objectDefId}/${record.id}`)
}

export async function updateCustomObjectRecord(id: string, objectDefId: string, data: Record<string, string>) {
  await prisma.customObjectRecord.update({
    where: { id },
    data: { data: JSON.stringify(data) },
  })
  revalidatePath(`/objects/${objectDefId}/${id}`)
}

export async function deleteCustomObjectRecord(id: string, objectDefId: string) {
  await prisma.customObjectRecord.delete({ where: { id } })
  revalidatePath(`/objects/${objectDefId}`)
  redirect(`/objects/${objectDefId}`)
}

// --- Forms ---

export async function getForms() {
  return prisma.form.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function createForm(name: string, description: string) {
  return prisma.form.create({ data: { name, description } })
}

export async function saveForm(id: string, data: { name?: string; description?: string; objectTypes?: string; layoutJson?: string }) {
  await prisma.form.update({ where: { id }, data })
  revalidatePath('/forms')
  revalidatePath(`/forms/${id}`)
}

export async function deleteForm(id: string) {
  await prisma.form.delete({ where: { id } })
  revalidatePath('/forms')
}

// --- Campaigns ---

export async function createCampaign(name: string) {
  const campaign = await prisma.campaign.create({ data: { name } })
  revalidatePath('/campaigns')
  return { id: campaign.id }
}

export async function getCampaign(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    include: { segment: true },
  })
}

export async function getCampaigns() {
  return prisma.campaign.findMany({
    include: { segment: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateCampaign(
  id: string,
  data: Partial<{
    name: string
    subject: string
    body: string
    segmentId: string | null
    fromName: string
    fromEmail: string
    scheduledAt: string | null
  }>,
) {
  const update: Record<string, unknown> = {}
  if (data.name !== undefined) update.name = data.name
  if (data.subject !== undefined) update.subject = data.subject
  if (data.body !== undefined) update.body = data.body
  if (data.segmentId !== undefined) update.segmentId = data.segmentId
  if (data.fromName !== undefined) update.fromName = data.fromName
  if (data.fromEmail !== undefined) update.fromEmail = data.fromEmail
  if (data.scheduledAt !== undefined) {
    update.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null
  }
  await prisma.campaign.update({ where: { id }, data: update })
  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
}

export async function deleteCampaign(id: string) {
  await prisma.campaign.delete({ where: { id } })
  revalidatePath('/campaigns')
}

function applyCampaignMergeTags(
  template: string,
  contact: { firstName: string; lastName: string; email: string; company: { name: string } | null },
) {
  return template
    .replaceAll('{{firstName}}', contact.firstName || '')
    .replaceAll('{{lastName}}', contact.lastName || '')
    .replaceAll('{{email}}', contact.email || '')
    .replaceAll('{{company}}', contact.company?.name || '')
}

export async function sendCampaign(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { segment: true },
  })
  if (!campaign) throw new Error('Campaign not found')
  if (!campaign.segment) throw new Error('Campaign has no segment')

  const { applyFilters, flattenContact } = await import('@/lib/filters')

  const contacts = await prisma.contact.findMany({
    include: {
      company: { select: { id: true, name: true, domain: true, industry: true, size: true } },
      opportunities: { select: { stage: true, value: true } },
      activities: { select: { type: true } },
      enrollments: { select: { sequenceId: true } },
    },
  })

  let filters: import('@/lib/filters').SegmentFilter[] = []
  try {
    filters = JSON.parse(campaign.segment.filtersJson)
  } catch {
    filters = []
  }

  const flatRecords = contacts.map(flattenContact)
  const matching = applyFilters(flatRecords, filters)
  const matchingIds = new Set(matching.map(r => r._id))
  const matchingContacts = contacts.filter(c => matchingIds.has(c.id))

  for (const contact of matchingContacts) {
    const personalizedSubject = applyCampaignMergeTags(campaign.subject, contact)
    const personalizedBody = applyCampaignMergeTags(campaign.body, contact)
    await prisma.activity.create({
      data: {
        type: 'email',
        title: personalizedSubject,
        body: personalizedBody,
        contactId: contact.id,
      },
    })
  }

  const recipientCount = matchingContacts.length
  const openCount = Math.floor(recipientCount * 0.4)
  const clickCount = Math.floor(recipientCount * 0.15)

  await prisma.campaign.update({
    where: { id },
    data: {
      status: 'sent',
      sentAt: new Date(),
      recipientCount,
      openCount,
      clickCount,
    },
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
}

// --- Active Lists (Segments) ---

async function evaluateSegmentIdsForSegment(segment: {
  objectType: string
  objectTypesJson?: string | null
  filtersJson: string
}): Promise<string[]> {
  let filters: SegmentFilter[] = []
  try { filters = JSON.parse(segment.filtersJson) } catch { filters = [] }

  const objectTypes = parseObjectTypes(segment)
  const multiObject = objectTypes.length > 1
  const defaultType = objectTypes[0]
  const allIds: string[] = []

  for (const type of objectTypes) {
    const records = await loadRecordsForType(type)
    const typeFilters = filters.filter(f => (f.objectType ?? defaultType) === type)
    const matched = applyFilters(records, typeFilters)
    allIds.push(
      ...matched.map(r => memberKey(type, r._id, multiObject)),
    )
  }
  return allIds
}

export async function setSegmentListType(segmentId: string, listType: 'dynamic' | 'static') {
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } })
  if (!segment) return
  if (listType === 'static') {
    const ids = await evaluateSegmentIdsForSegment(segment)
    await prisma.segment.update({
      where: { id: segmentId },
      data: {
        listType: 'static',
        memberIds: JSON.stringify(ids),
        lastEvaluatedAt: new Date(),
      },
    })
  } else {
    await prisma.segment.update({
      where: { id: segmentId },
      data: {
        listType: 'dynamic',
        memberIds: '[]',
        lastEvaluatedAt: null,
      },
    })
  }
  revalidatePath(`/segments/${segmentId}`)
  revalidatePath('/segments')
}

export async function refreshStaticSegment(segmentId: string) {
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } })
  if (!segment) return
  const ids = await evaluateSegmentIdsForSegment(segment)
  await prisma.segment.update({
    where: { id: segmentId },
    data: {
      memberIds: JSON.stringify(ids),
      lastEvaluatedAt: new Date(),
    },
  })
  revalidatePath(`/segments/${segmentId}`)
  revalidatePath('/segments')
}

export async function getSegmentDeltas(segmentId: string): Promise<{ newMatchers: string[]; lostMatchers: string[] }> {
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } })
  if (!segment) return { newMatchers: [], lostMatchers: [] }
  const current = await evaluateSegmentIdsForSegment(segment)
  let snapshot: string[] = []
  try { snapshot = JSON.parse(segment.memberIds) } catch { snapshot = [] }
  const currentSet = new Set(current)
  const snapshotSet = new Set(snapshot)
  const newMatchers = current.filter(id => !snapshotSet.has(id))
  const lostMatchers = snapshot.filter(id => !currentSet.has(id))
  return { newMatchers, lostMatchers }
}

// --- Pipelines ---

export async function ensureDefaultPipeline() {
  const existing = await prisma.pipeline.findFirst({ where: { isDefault: true } })
  if (existing) return existing
  const pipeline = await prisma.pipeline.create({
    data: {
      name: 'Sales Pipeline',
      stages: JSON.stringify(DEFAULT_PIPELINE_STAGES),
      isDefault: true,
      order: 0,
    },
  })
  await prisma.opportunity.updateMany({
    where: { pipelineId: null },
    data: { pipelineId: pipeline.id },
  })
  return pipeline
}

export async function createPipeline(
  name: string,
  stages: { key: string; label: string; isClosedWon?: boolean; isClosedLost?: boolean }[],
) {
  const ordered = stages.map((s, i) => ({
    key: s.key,
    label: s.label,
    order: i,
    isClosedWon: s.isClosedWon ?? false,
    isClosedLost: s.isClosedLost ?? false,
  }))
  const maxOrder = await prisma.pipeline.aggregate({ _max: { order: true } })
  const pipeline = await prisma.pipeline.create({
    data: {
      name,
      stages: JSON.stringify(ordered),
      order: (maxOrder._max.order ?? 0) + 1,
    },
  })
  revalidatePath('/opportunities')
  return pipeline
}

export async function updatePipeline(id: string, data: { name?: string; stages?: string }) {
  await prisma.pipeline.update({ where: { id }, data })
  revalidatePath('/opportunities')
}

export async function deletePipeline(id: string) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id },
    include: { _count: { select: { opportunities: true } } },
  })
  if (!pipeline) return { ok: false, error: 'Pipeline not found' }
  if (pipeline.isDefault) return { ok: false, error: 'Cannot delete the default pipeline' }
  if (pipeline._count.opportunities > 0) return { ok: false, error: 'Cannot delete a pipeline with opportunities' }
  await prisma.pipeline.delete({ where: { id } })
  revalidatePath('/opportunities')
  return { ok: true }
}

export async function setDefaultPipeline(id: string) {
  await prisma.pipeline.updateMany({ data: { isDefault: false } })
  await prisma.pipeline.update({ where: { id }, data: { isDefault: true } })
  revalidatePath('/opportunities')
}

export async function moveOpportunityToPipeline(opportunityId: string, pipelineId: string, stageKey: string) {
  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } })
  if (!pipeline) return
  let stages: Array<{ key: string; label: string; isClosedWon?: boolean; isClosedLost?: boolean }> = []
  try { stages = JSON.parse(pipeline.stages) } catch { stages = [] }
  const stage = stages.find(s => s.key === stageKey)
  if (!stage) return
  const closedAt = stage.isClosedWon || stage.isClosedLost ? new Date() : null
  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { pipelineId, stage: stage.label, closedAt },
  })
  revalidatePath('/opportunities')
}

// --- Notifications ---

export async function createNotification(data: {
  userId: string
  type: string
  title: string
  body?: string
  link?: string
}) {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body || null,
      link: data.link || null,
    },
  })
}

export async function getNotifications(userId: string) {
  if (!userId) return []
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
}

export async function markNotificationRead(id: string) {
  await prisma.notification.update({ where: { id }, data: { read: true } })
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  })
}

export async function deleteNotification(id: string) {
  await prisma.notification.delete({ where: { id } })
}

// --- Reports ---

export async function getReports() {
  return prisma.report.findMany({ orderBy: { updatedAt: 'desc' } })
}

export async function createReport(name: string, description?: string) {
  const report = await prisma.report.create({
    data: { name, description: description || null },
  })
  revalidatePath('/reports')
  return report
}

export async function saveReport(id: string, data: { name?: string; description?: string; configJson?: string }) {
  await prisma.report.update({ where: { id }, data })
  revalidatePath('/reports')
  revalidatePath(`/reports/${id}`)
}

export async function deleteReport(id: string) {
  await prisma.report.delete({ where: { id } })
  revalidatePath('/reports')
}
