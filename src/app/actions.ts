'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { computeLeadScore } from '@/lib/scoring'
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
    include: { activities: true, deals: true },
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

// --- Deals ---

export async function createDeal(formData: FormData) {
  const deal = await prisma.deal.create({
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
        type: 'deal_created',
        title: `Deal "${deal.name}" created`,
        contactId,
        dealId: deal.id,
      },
    })
    await refreshContactScore(contactId)
  }
  revalidatePath('/deals')
}

export async function moveDeal(dealId: string, newStage: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { pipeline: true },
  })
  if (!deal) return

  // Pipeline-aware stage validation
  let validStageLabels: string[] = STAGES
  let isClosedWon = newStage === 'Closed Won'
  let isClosedLost = newStage === 'Closed Lost'
  if (deal.pipeline) {
    try {
      const pipelineStages = JSON.parse(deal.pipeline.stages) as Array<{
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
  await prisma.deal.update({
    where: { id: dealId },
    data: { stage: newStage, closedAt },
  })
  if (deal.contactId) {
    await prisma.activity.create({
      data: {
        type: 'stage_change',
        title: `Deal moved to ${newStage}`,
        contactId: deal.contactId,
        dealId,
      },
    })
    await refreshContactScore(deal.contactId)
  }
  // Notify everyone on closed won
  if (isClosedWon) {
    const users = await prisma.user.findMany({ select: { id: true } })
    for (const u of users) {
      await prisma.notification.create({
        data: {
          userId: u.id,
          type: 'deal',
          title: `Deal closed won: ${deal.name}`,
          body: `$${deal.value.toLocaleString()}`,
          link: '/deals',
        },
      })
    }
  }
  revalidatePath('/deals')
  revalidatePath(`/contacts/${deal.contactId}`)
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

export async function enrollContact(formData: FormData) {
  const contactId = formData.get('contactId') as string
  const sequenceId = formData.get('sequenceId') as string
  await prisma.enrollment.create({ data: { contactId, sequenceId } })
  await prisma.activity.create({
    data: {
      type: 'sequence_enrolled',
      title: 'Enrolled in email sequence',
      contactId,
    },
  })
  revalidatePath(`/contacts/${contactId}`)
  revalidatePath('/sequences')
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
  const nextStep = enrollment.currentStep + 1
  if (nextStep >= steps.length) {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { currentStep: nextStep, active: false, completedAt: new Date() },
    })
  } else {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { currentStep: nextStep },
    })
  }
  await refreshContactScore(enrollment.contactId)
  revalidatePath(`/contacts/${enrollment.contactId}`)
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
  const segment = await prisma.segment.create({
    data: {
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || null,
      objectType: (formData.get('objectType') as string) || 'contact',
    },
  })
  revalidatePath('/segments')
  redirect(`/segments/${segment.id}`)
}

export async function saveSegmentFilters(segmentId: string, filtersJson: string, name?: string, description?: string) {
  await prisma.segment.update({
    where: { id: segmentId },
    data: {
      filtersJson,
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
    },
  })
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
  if (!q || q.length < 2) return { contacts: [], companies: [], deals: [] }
  const [contacts, companies, deals] = await Promise.all([
    prisma.contact.findMany({
      where: {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { email: { contains: q } },
          { title: { contains: q } },
        ],
      },
      include: { company: { select: { name: true } } },
      take: 6,
    }),
    prisma.company.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { domain: { contains: q } },
          { industry: { contains: q } },
        ],
      },
      take: 6,
    }),
    prisma.deal.findMany({
      where: { OR: [{ name: { contains: q } }, { stage: { contains: q } }] },
      include: { contact: { select: { firstName: true, lastName: true } } },
      take: 6,
    }),
  ])
  return { contacts, companies, deals }
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

export async function updateDeal(
  id: string,
  data: { name: string; value: number; stage: string },
) {
  await prisma.deal.update({ where: { id }, data })
  revalidatePath('/deals')
}

// --- Bulk Delete ---

export async function clearAllRecords(target: 'contacts' | 'companies' | 'deals') {
  if (target === 'contacts') {
    await prisma.enrollment.deleteMany({})
    await prisma.activity.deleteMany({ where: { contactId: { not: null } } })
    await prisma.deal.updateMany({ data: { contactId: null } })
    await prisma.contact.deleteMany({})
    revalidatePath('/contacts')
    revalidatePath('/dashboard')
  } else if (target === 'companies') {
    await prisma.activity.deleteMany({ where: { companyId: { not: null } } })
    await prisma.deal.updateMany({ data: { companyId: null } })
    await prisma.contact.updateMany({ data: { companyId: null } })
    await prisma.company.deleteMany({})
    revalidatePath('/companies')
    revalidatePath('/contacts')
    revalidatePath('/dashboard')
  } else if (target === 'deals') {
    await prisma.activity.deleteMany({ where: { dealId: { not: null } } })
    await prisma.deal.deleteMany({})
    revalidatePath('/deals')
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
      for (const row of task.mappedData) {
        if (!row.name) continue
        const existing = await prisma.company.findFirst({
          where: { OR: [{ name: row.name }, row.domain ? { domain: row.domain } : { id: 'NONE' }] },
        })
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
      for (const row of task.mappedData) {
        if (!row.email) continue
        const existing = await prisma.contact.findUnique({ where: { email: row.email } })
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

export async function bulkImportCompanies(rows: Record<string, string>[]): Promise<Record<string, string>> {
  const companyMap: Record<string, string> = {}
  for (const row of rows) {
    if (!row.name) continue
    let customFields: Record<string, string> = {}
    if (row._customFields) {
      try { customFields = JSON.parse(row._customFields) } catch { /* ignore */ }
    }
    // Any mapped field not in the standard set goes to customFields
    for (const [k, v] of Object.entries(row)) {
      if (!COMPANY_STANDARD_KEYS.has(k) && v) customFields[k] = v
    }
    let company = await prisma.company.findFirst({ where: { name: row.name } })
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: row.name,
          domain: row.domain || null,
          industry: row.industry || null,
          size: row.size || null,
          website: row.website || null,
          customFields: JSON.stringify(customFields),
        },
      })
    } else if (Object.keys(customFields).length > 0) {
      let existing: Record<string, string> = {}
      try { existing = JSON.parse(company.customFields || '{}') } catch { /* ignore */ }
      await prisma.company.update({
        where: { id: company.id },
        data: { customFields: JSON.stringify({ ...existing, ...customFields }) },
      })
    }
    companyMap[company.name] = company.id
  }
  revalidatePath('/companies')
  return companyMap
}

export async function bulkImportContacts(rows: Record<string, string>[], companyMap: Record<string, string>) {
  for (const row of rows) {
    const email = row.email || `unknown_${Math.random().toString(36).slice(2)}@import.csv`
    const companyId = row._companyAssociation ? companyMap[row._companyAssociation] ?? null : null
    let customFields: Record<string, string> = {}
    if (row._customFields) {
      try { customFields = JSON.parse(row._customFields) } catch { /* ignore */ }
    }
    // Any mapped field not in the standard set goes to customFields
    for (const [k, v] of Object.entries(row)) {
      if (!CONTACT_STANDARD_KEYS.has(k) && v) customFields[k] = v
    }
    const existing = await prisma.contact.findUnique({ where: { email } })
    let mergedCustomFields = customFields
    if (existing && Object.keys(customFields).length > 0) {
      let prev: Record<string, string> = {}
      try { prev = JSON.parse(existing.customFields || '{}') } catch { /* ignore */ }
      mergedCustomFields = { ...prev, ...customFields }
    }
    await prisma.contact.upsert({
      where: { email },
      update: {
        firstName: row.firstName || undefined,
        lastName: row.lastName || undefined,
        title: row.title || undefined,
        phone: row.phone || undefined,
        linkedin: row.linkedin || undefined,
        companyId: companyId || undefined,
        ...(Object.keys(mergedCustomFields).length > 0 && { customFields: JSON.stringify(mergedCustomFields) }),
      },
      create: {
        firstName: row.firstName || 'Unknown',
        lastName: row.lastName || 'Unknown',
        email,
        title: row.title || null,
        phone: row.phone || null,
        linkedin: row.linkedin || null,
        companyId,
        customFields: JSON.stringify(customFields),
      },
    })
  }
  revalidatePath('/contacts')
}

// --- Users ---

export async function createUser(formData: FormData) {
  await prisma.user.create({
    data: {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      role: (formData.get('role') as string) || 'member',
      color: (formData.get('color') as string) || '#6366f1',
    },
  })
  revalidatePath('/users')
}

export async function updateUser(id: string, data: { name: string; email: string; role: string; color: string }) {
  await prisma.user.update({ where: { id }, data })
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
  assigneeId?: string
  contactId?: string
  companyId?: string
  dealId?: string
  segmentId?: string
}) {
  await prisma.task.create({
    data: {
      title: data.title,
      description: data.description || null,
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      assigneeId: data.assigneeId || null,
      contactId: data.contactId || null,
      companyId: data.companyId || null,
      dealId: data.dealId || null,
      segmentId: data.segmentId || null,
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
  dealId?: string | null
  segmentId?: string | null
}) {
  await prisma.task.update({
    where: { id },
    data: {
      ...data,
      dueDate: data.dueDate === undefined ? undefined : data.dueDate ? new Date(data.dueDate) : null,
    },
  })
  revalidatePath('/tasks')
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
}

export async function deleteTask(id: string) {
  await prisma.task.delete({ where: { id } })
  revalidatePath('/tasks')
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

export async function executeSegmentWorkflow(linkId: string) {
  const link = await prisma.segmentWorkflowLink.findUnique({
    where: { id: linkId },
    include: {
      segment: true,
      sequence: { include: { steps: { orderBy: { order: 'asc' } } } },
    },
  })
  if (!link) throw new Error('Link not found')

  // Load contacts and apply segment filters
  const { applyFilters, flattenContact } = await import('@/lib/filters')
  const contacts = await prisma.contact.findMany({
    include: {
      company: { select: { id: true, name: true, domain: true, industry: true, size: true } },
      deals: { select: { stage: true, value: true } },
      activities: { select: { type: true } },
      enrollments: { select: { sequenceId: true } },
    },
  })

  let filters: import('@/lib/filters').SegmentFilter[] = []
  try { filters = JSON.parse(link.segment.filtersJson) } catch { filters = [] }

  const flatRecords = contacts.map(flattenContact)
  const matching = applyFilters(flatRecords, filters)
  const matchingIds = new Set(matching.map(r => r._id))

  const matchingContacts = contacts.filter(c => matchingIds.has(c.id))

  // Parse workflow nodes to find task nodes
  let taskNodes: Array<{ title: string; priority: string; due: string }> = []
  try {
    const nodes: Array<{ type: string; data: { config?: Record<string, string> } }> = JSON.parse(link.sequence.nodesJson || '[]')
    taskNodes = nodes
      .filter(n => n.type === 'task' && n.data?.config)
      .map(n => ({
        title: n.data.config!.title || 'Follow up',
        priority: n.data.config!.priority || 'medium',
        due: n.data.config!.due || '1',
      }))
  } catch { /* */ }

  // Enroll each contact + create tasks
  let enrolled = 0
  for (const contact of matchingContacts) {
    // Create enrollment if not already enrolled
    const existing = await prisma.enrollment.findFirst({
      where: { contactId: contact.id, sequenceId: link.sequenceId },
    })
    if (!existing) {
      await prisma.enrollment.create({
        data: { contactId: contact.id, sequenceId: link.sequenceId, currentStep: 0, active: true },
      })
      enrolled++
    }

    // Create tasks from task nodes
    for (const tn of taskNodes) {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + parseInt(tn.due || '1', 10))
      await prisma.task.create({
        data: {
          title: tn.title,
          priority: tn.priority,
          dueDate,
          assigneeId: link.assignedUserId || null,
          contactId: contact.id,
          segmentId: link.segmentId,
        },
      })
    }
  }

  // Notify the workflow assignee
  if (link.assignedUserId) {
    await prisma.notification.create({
      data: {
        userId: link.assignedUserId,
        type: 'workflow',
        title: `Segment enrolled ${enrolled} contacts in ${link.sequence.name}`,
        body: `${matchingContacts.length} matching contacts`,
        link: `/segments/${link.segmentId}`,
      },
    })
  }

  revalidatePath('/segments')
  return { enrolled, total: matchingContacts.length }
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

export async function saveFieldDefinitions(
  objectType: string | null,
  customObjectDefId: string | null,
  fields: Array<{
    id?: string
    key: string
    label: string
    fieldType: string
    selectOptions: string[]
    required: boolean
    isPrimary: boolean
    order: number
    isBuiltIn: boolean
  }>
) {
  // Delete fields not in the new list (non-built-in only)
  const existingIds = fields.filter(f => f.id).map(f => f.id as string)
  const where = objectType
    ? { objectType, id: { notIn: existingIds }, isBuiltIn: false }
    : { customObjectDefId: customObjectDefId!, id: { notIn: existingIds }, isBuiltIn: false }
  await prisma.fieldDefinition.deleteMany({ where })

  for (const f of fields) {
    const payload = {
      objectType: objectType ?? undefined,
      customObjectDefId: customObjectDefId ?? undefined,
      key: f.key,
      label: f.label,
      fieldType: f.fieldType,
      selectOptions: JSON.stringify(f.selectOptions),
      required: f.required,
      isPrimary: f.isPrimary,
      order: f.order,
      isBuiltIn: f.isBuiltIn,
    }
    if (f.id) {
      await prisma.fieldDefinition.update({ where: { id: f.id }, data: payload })
    } else {
      await prisma.fieldDefinition.create({ data: payload })
    }
  }

  const path = objectType ? `/setup/objects/${objectType}` : `/setup/objects/${customObjectDefId}`
  revalidatePath(path)
  revalidatePath('/setup')
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

export async function updateObjectRelationship(id: string, data: { relType?: string; label?: string }) {
  'use server'
  return prisma.objectRelationship.update({ where: { id }, data })
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
      deals: { select: { stage: true, value: true } },
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

async function evaluateSegmentIds(
  objectType: string,
  filtersJson: string,
): Promise<string[]> {
  const { applyFilters, flattenContact, flattenCompany, flattenDeal } = await import('@/lib/filters')
  let filters: import('@/lib/filters').SegmentFilter[] = []
  try { filters = JSON.parse(filtersJson) } catch { filters = [] }

  let records: import('@/lib/filters').FlatRecord[] = []
  if (objectType === 'contact') {
    const contacts = await prisma.contact.findMany({
      include: {
        company: { select: { id: true, name: true, domain: true, industry: true, size: true } },
        deals: { select: { stage: true, value: true } },
        activities: { select: { type: true } },
        enrollments: { select: { sequenceId: true } },
      },
    })
    records = contacts.map(flattenContact)
  } else if (objectType === 'company') {
    const companies = await prisma.company.findMany({
      include: {
        contacts: { select: { id: true } },
        deals: { select: { stage: true, value: true } },
        activities: { select: { type: true } },
      },
    })
    records = companies.map(flattenCompany)
  } else if (objectType === 'deal') {
    const deals = await prisma.deal.findMany({
      include: {
        contact: { select: { firstName: true, lastName: true, email: true, title: true, leadScore: true } },
        company: { select: { name: true, industry: true } },
        activities: { select: { type: true } },
      },
    })
    records = deals.map(flattenDeal)
  }
  return applyFilters(records, filters).map(r => r._id)
}

export async function setSegmentListType(segmentId: string, listType: 'dynamic' | 'static') {
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } })
  if (!segment) return
  if (listType === 'static') {
    const ids = await evaluateSegmentIds(segment.objectType, segment.filtersJson)
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
  const ids = await evaluateSegmentIds(segment.objectType, segment.filtersJson)
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
  const current = await evaluateSegmentIds(segment.objectType, segment.filtersJson)
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
  await prisma.deal.updateMany({
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
  revalidatePath('/deals')
  return pipeline
}

export async function updatePipeline(id: string, data: { name?: string; stages?: string }) {
  await prisma.pipeline.update({ where: { id }, data })
  revalidatePath('/deals')
}

export async function deletePipeline(id: string) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id },
    include: { _count: { select: { deals: true } } },
  })
  if (!pipeline) return { ok: false, error: 'Pipeline not found' }
  if (pipeline.isDefault) return { ok: false, error: 'Cannot delete the default pipeline' }
  if (pipeline._count.deals > 0) return { ok: false, error: 'Cannot delete a pipeline with deals' }
  await prisma.pipeline.delete({ where: { id } })
  revalidatePath('/deals')
  return { ok: true }
}

export async function setDefaultPipeline(id: string) {
  await prisma.pipeline.updateMany({ data: { isDefault: false } })
  await prisma.pipeline.update({ where: { id }, data: { isDefault: true } })
  revalidatePath('/deals')
}

export async function moveDealToPipeline(dealId: string, pipelineId: string, stageKey: string) {
  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } })
  if (!pipeline) return
  let stages: Array<{ key: string; label: string; isClosedWon?: boolean; isClosedLost?: boolean }> = []
  try { stages = JSON.parse(pipeline.stages) } catch { stages = [] }
  const stage = stages.find(s => s.key === stageKey)
  if (!stage) return
  const closedAt = stage.isClosedWon || stage.isClosedLost ? new Date() : null
  await prisma.deal.update({
    where: { id: dealId },
    data: { pipelineId, stage: stage.label, closedAt },
  })
  revalidatePath('/deals')
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
