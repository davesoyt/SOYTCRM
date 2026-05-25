import { prisma } from '@/lib/prisma'
import {
  formatWaitLabel,
  parseWorkflowNodes,
  waitToMilliseconds,
  type FormAssignmentMode,
  type WorkflowNodeParsed,
} from '@/lib/workflowExecution'

export type EnrollmentContext = {
  formMode?: FormAssignmentMode
  segmentId?: string
  assignedUserId?: string | null
}

type GraphNode = WorkflowNodeParsed & { id: string }

type WorkflowGraph = {
  nodes: Map<string, GraphNode>
  edges: Array<{ source: string; target: string; sourceHandle?: string }>
}

function parseGraph(nodesJson: string, edgesJson: string): WorkflowGraph {
  let rawNodes: Array<{ id: string; type: string; data?: GraphNode['data'] }> = []
  let rawEdges: Array<{ source: string; target: string; sourceHandle?: string }> = []
  try {
    rawNodes = JSON.parse(nodesJson || '[]')
  } catch {
    rawNodes = []
  }
  try {
    rawEdges = JSON.parse(edgesJson || '[]')
  } catch {
    rawEdges = []
  }
  const nodes = new Map<string, GraphNode>()
  for (const n of rawNodes) {
    if (n?.id && n.type) {
      nodes.set(n.id, { id: n.id, type: n.type, data: n.data })
    }
  }
  return { nodes, edges: rawEdges }
}

function findTriggerId(graph: WorkflowGraph): string | null {
  for (const [id, n] of graph.nodes) {
    if (n.type === 'trigger') return id
  }
  return null
}

function getNextNodeId(
  graph: WorkflowGraph,
  fromId: string,
  branch?: 'yes' | 'no',
): string | null {
  const outgoing = graph.edges.filter(e => e.source === fromId)
  if (outgoing.length === 0) return null
  if (outgoing.length === 1) return outgoing[0].target
  if (branch) {
    const match = outgoing.find(e => e.sourceHandle === branch)
    return match?.target ?? outgoing[0].target
  }
  return outgoing[0].target
}

function parseContext(json: string): EnrollmentContext {
  try {
    return JSON.parse(json) as EnrollmentContext
  } catch {
    return {}
  }
}

function evaluateCondition(node: GraphNode, contact: {
  firstName: string
  lastName: string
  email: string
  leadScore: number
  title: string | null
  enriched: boolean
  company: { name: string } | null
}): boolean {
  const cfg = node.data?.config ?? {}
  const field = cfg.field ?? ''
  const op = cfg.operator ?? 'equals'
  const value = cfg.value ?? ''

  let actual = ''
  if (field === 'leadScore') actual = String(contact.leadScore)
  else if (field === 'title') actual = contact.title ?? ''
  else if (field === 'company') actual = contact.company?.name ?? ''
  else if (field === 'email') actual = contact.email
  else if (field === 'enriched') actual = contact.enriched ? 'true' : 'false'
  else actual = ''

  const a = actual.toLowerCase()
  const t = value.toLowerCase()
  switch (op) {
    case 'equals':
    case 'contains':
      return a.includes(t)
    case 'greater than':
      return parseFloat(actual) > parseFloat(value)
    case 'less than':
      return parseFloat(actual) < parseFloat(value)
    case 'is set':
      return actual.length > 0
    default:
      return a === t
  }
}

async function logStep(
  enrollmentId: string,
  stepIndex: number,
  node: GraphNode,
  status: 'running' | 'completed' | 'skipped',
  data: Record<string, unknown>,
) {
  return prisma.workflowRunLog.create({
    data: {
      enrollmentId,
      stepIndex,
      nodeType: node.type,
      nodeLabel: node.data?.label ?? node.type,
      dataJson: JSON.stringify(data),
      status,
    },
  })
}

async function completeEnrollment(enrollmentId: string, stepIndex: number) {
  await prisma.workflowRunLog.create({
    data: {
      enrollmentId,
      stepIndex,
      nodeType: 'completed',
      nodeLabel: 'Workflow Completed',
      dataJson: JSON.stringify({ event: 'Workflow finished' }),
      status: 'completed',
    },
  })
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      active: false,
      completedAt: new Date(),
      resumeAt: null,
      currentNodeId: null,
    },
  })
}

type EnrollmentRecord = {
  recordType: string
  recordId: string
  recordLabel: string
  taskLink: { contactId?: string | null; companyId?: string | null; opportunityId?: string | null }
  // Optional contact-specific data for email/sms/condition nodes
  contact?: {
    id: string
    firstName: string
    lastName: string
    email: string
    title: string | null
    leadScore: number
    enriched: boolean
    company: { name: string } | null
  } | null
}

async function executeNode(
  node: GraphNode,
  record: EnrollmentRecord,
  ctx: EnrollmentContext,
  formsById: Map<string, string>,
): Promise<{ tasksCreated: number; formsAssigned: number }> {
  let tasksCreated = 0
  let formsAssigned = 0
  const cfg = node.data?.config ?? {}

  switch (node.type) {
    case 'email': {
      if (!record.contact) break
      await prisma.activity.create({
        data: {
          type: 'email',
          title: cfg.subject || 'Email',
          body: cfg.body || '',
          contactId: record.contact.id,
        },
      })
      break
    }
    case 'task': {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + parseInt(cfg.due || '1', 10))
      await prisma.task.create({
        data: {
          title: cfg.title || 'Follow up',
          priority: cfg.priority || 'medium',
          dueDate,
          assigneeId: cfg.assigneeId || ctx.assignedUserId || null,
          segmentId: ctx.segmentId || null,
          ...record.taskLink,
        },
      })
      tasksCreated++
      break
    }
    case 'form': {
      const formId = cfg.formId
      if (!formId) break
      const label = formsById.get(formId) ?? 'Form'
      const formMode = ctx.formMode ?? 'per_record'
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + (formMode === 'per_segment' ? 7 : 3))
      if (formMode === 'per_record') {
        await prisma.task.create({
          data: {
            title: `Fill form: ${label}`,
            description: `Complete form for ${record.recordLabel} (${record.recordType}).\n/forms/${formId}`,
            priority: 'medium',
            dueDate,
            assigneeId: cfg.assigneeId || ctx.assignedUserId || null,
            segmentId: ctx.segmentId || null,
            ...record.taskLink,
          },
        })
        formsAssigned++
      } else if (formMode === 'per_segment' && ctx.segmentId) {
        const existing = await prisma.task.findFirst({
          where: {
            segmentId: ctx.segmentId,
            title: `Fill form: ${label}`,
            contactId: null,
            companyId: null,
            opportunityId: null,
          },
        })
        if (!existing) {
          await prisma.task.create({
            data: {
              title: `Fill form: ${label}`,
              description: `One shared form assignment for the segment.\n/forms/${formId}`,
              priority: 'medium',
              dueDate,
              assigneeId: cfg.assigneeId || ctx.assignedUserId || null,
              segmentId: ctx.segmentId,
            },
          })
          formsAssigned++
        }
      }
      break
    }
    case 'updatescore': {
      if (!record.contact) break
      const delta = parseInt(cfg.delta || '0', 10)
      if (!isNaN(delta) && delta !== 0) {
        const c = await prisma.contact.findUnique({ where: { id: record.contact.id } })
        if (c) {
          await prisma.contact.update({
            where: { id: record.contact.id },
            data: { leadScore: Math.max(0, c.leadScore + delta) },
          })
        }
      }
      break
    }
    case 'sms': {
      if (!record.contact) break
      await prisma.activity.create({
        data: {
          type: 'note',
          title: 'SMS (simulated)',
          body: cfg.message || '',
          contactId: record.contact.id,
        },
      })
      break
    }
    default:
      break
  }

  return { tasksCreated, formsAssigned }
}

function recordFromEnrollment(enrollment: {
  recordType: string
  recordId: string
  recordLabel: string
  contactId: string | null
  companyId: string | null
  opportunityId: string | null
  contact: {
    id: string
    firstName: string
    lastName: string
    email: string
    title: string | null
    leadScore: number
    enriched: boolean
    company: { name: string } | null
  } | null
}): EnrollmentRecord {
  const taskLink: EnrollmentRecord['taskLink'] = {
    contactId: enrollment.contactId ?? null,
    companyId: enrollment.companyId ?? null,
    opportunityId: enrollment.opportunityId ?? null,
  }
  return {
    recordType: enrollment.recordType,
    recordId: enrollment.recordId,
    recordLabel: enrollment.recordLabel || enrollment.recordId,
    taskLink,
    contact: enrollment.contact,
  }
}

/** Advance one enrollment through the canvas workflow until wait or completion. */
export async function advanceWorkflowEnrollment(enrollmentId: string): Promise<{
  status: 'waiting' | 'completed' | 'advanced'
  tasksCreated: number
  formsAssigned: number
}> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      contact: {
        include: { company: { select: { name: true } } },
      },
      sequence: true,
      runLogs: { orderBy: { executedAt: 'desc' } },
    },
  })
  if (!enrollment || !enrollment.active) {
    return { status: 'completed', tasksCreated: 0, formsAssigned: 0 }
  }

  const now = new Date()
  if (enrollment.resumeAt && enrollment.resumeAt > now) {
    return { status: 'waiting', tasksCreated: 0, formsAssigned: 0 }
  }

  const graph = parseGraph(enrollment.sequence.nodesJson, enrollment.sequence.edgesJson)
  const ctx = parseContext(enrollment.contextJson)
  const forms = await prisma.form.findMany({ select: { id: true, name: true } })
  const formsById = new Map(forms.map(f => [f.id, f.name]))
  const record = recordFromEnrollment(enrollment)

  let tasksCreated = 0
  let formsAssigned = 0
  let stepIndex = enrollment.currentStep
  let nodeId = enrollment.currentNodeId

  // Resume after wait: mark running wait log completed
  if (enrollment.resumeAt && enrollment.resumeAt <= now && nodeId) {
    const node = graph.nodes.get(nodeId)
    if (node?.type === 'wait') {
      const runningLog = enrollment.runLogs.find(
        l => l.nodeType === 'wait' && l.status === 'running',
      )
      if (runningLog) {
        await prisma.workflowRunLog.update({
          where: { id: runningLog.id },
          data: {
            status: 'completed',
            dataJson: JSON.stringify({
              ...JSON.parse(runningLog.dataJson || '{}'),
              event: 'Wait completed',
              completedAt: now.toISOString(),
            }),
          },
        })
      }
      await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { resumeAt: null },
      })
      nodeId = getNextNodeId(graph, nodeId)
      stepIndex++
    }
  }

  if (!nodeId) {
    const triggerId = findTriggerId(graph)
    if (!triggerId) {
      await completeEnrollment(enrollmentId, stepIndex)
      return { status: 'completed', tasksCreated, formsAssigned }
    }
    nodeId = getNextNodeId(graph, triggerId)
    if (!nodeId) {
      await completeEnrollment(enrollmentId, stepIndex)
      return { status: 'completed', tasksCreated, formsAssigned }
    }
  }

  const maxSteps = graph.nodes.size + 5
  let iterations = 0

  while (nodeId && iterations < maxSteps) {
    iterations++
    const node = graph.nodes.get(nodeId)
    if (!node) break

    if (node.type === 'wait') {
      const ms = waitToMilliseconds(node.data?.config ?? {})
      const waitLabel = formatWaitLabel(node.data?.config ?? {}) || 'Wait'
      if (ms <= 0) {
        await logStep(enrollmentId, stepIndex, node, 'completed', {
          event: 'Zero-duration wait skipped',
        })
        nodeId = getNextNodeId(graph, nodeId)
        stepIndex++
        continue
      }

      const resumeAt = new Date(now.getTime() + ms)
      await logStep(enrollmentId, stepIndex, node, 'running', {
        event: 'Waiting',
        waitLabel,
        resumeAt: resumeAt.toISOString(),
        durationMs: ms,
      })
      await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: {
          currentNodeId: nodeId,
          currentStep: stepIndex,
          resumeAt,
        },
      })
      return { status: 'waiting', tasksCreated, formsAssigned }
    }

    if (node.type === 'condition') {
      const pass = record.contact
        ? evaluateCondition(node, {
            firstName: record.contact.firstName,
            lastName: record.contact.lastName,
            email: record.contact.email,
            leadScore: record.contact.leadScore,
            title: record.contact.title,
            enriched: record.contact.enriched,
            company: record.contact.company,
          })
        : false
      await logStep(enrollmentId, stepIndex, node, 'completed', {
        event: !record.contact
          ? `Condition skipped for ${record.recordType} (no contact data)`
          : pass
            ? 'Condition met (yes)'
            : 'Condition not met (no)',
        field: node.data?.config?.field,
        operator: node.data?.config?.operator,
        value: node.data?.config?.value,
      })
      nodeId = getNextNodeId(graph, nodeId, pass ? 'yes' : 'no')
      stepIndex++
      continue
    }

    if (node.type === 'trigger') {
      nodeId = getNextNodeId(graph, nodeId)
      continue
    }

    const result = await executeNode(node, record, ctx, formsById)
    tasksCreated += result.tasksCreated
    formsAssigned += result.formsAssigned

    await logStep(enrollmentId, stepIndex, node, 'completed', {
      event: `${node.type} step executed`,
      record: record.recordLabel,
      ...(node.type === 'email' && record.contact
        ? { subject: node.data?.config?.subject, to: record.contact.email }
        : {}),
    })

    stepIndex++
    const nextId = getNextNodeId(graph, nodeId)
    if (!nextId) {
      await completeEnrollment(enrollmentId, stepIndex)
      return { status: 'completed', tasksCreated, formsAssigned }
    }
    nodeId = nextId

    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { currentNodeId: nodeId, currentStep: stepIndex, resumeAt: null },
    })
  }

  await completeEnrollment(enrollmentId, stepIndex)
  return { status: 'completed', tasksCreated, formsAssigned }
}

/** Process enrollments whose wait delay has elapsed. */
export async function processDueWorkflowEnrollments(): Promise<number> {
  const now = new Date()
  const due = await prisma.enrollment.findMany({
    where: {
      active: true,
      resumeAt: { not: null, lte: now },
    },
    select: { id: true },
  })

  let processed = 0
  for (const { id } of due) {
    await advanceWorkflowEnrollment(id)
    processed++
  }
  return processed
}

export function sequenceHasCanvasWorkflow(nodesJson: string, edgesJson = '[]'): boolean {
  const graph = parseGraph(nodesJson, edgesJson)
  if (graph.nodes.size <= 1) return false
  const hasActionable = [...graph.nodes.values()].some(
    n => n.type !== 'trigger',
  )
  if (!hasActionable) return false
  const triggerId = findTriggerId(graph)
  if (triggerId && getNextNodeId(graph, triggerId)) return true
  // Nodes exist but edges missing/unsaved — still run the canvas engine
  return hasActionable
}
