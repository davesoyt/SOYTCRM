export type FormAssignmentMode = 'per_record' | 'per_segment'

export type ExecuteWorkflowOptions = {
  formMode: FormAssignmentMode
}

export type WorkflowNodeParsed = {
  type: string
  data?: { label?: string; config?: Record<string, string> }
}

export type WorkflowFormNode = {
  formId: string
  label: string
  assigneeId?: string
}

export type WorkflowTaskNode = {
  title: string
  priority: string
  due: string
  assigneeId?: string
}

export function parseWorkflowNodes(nodesJson: string): WorkflowNodeParsed[] {
  try {
    const nodes = JSON.parse(nodesJson || '[]')
    return Array.isArray(nodes) ? nodes : []
  } catch {
    return []
  }
}

export function extractFormNodes(
  nodes: WorkflowNodeParsed[],
  formNames: Map<string, string>,
): WorkflowFormNode[] {
  return nodes
    .filter(n => n.type === 'form' && n.data?.config?.formId)
    .map(n => ({
      formId: n.data!.config!.formId,
      label: formNames.get(n.data!.config!.formId) ?? n.data?.label ?? 'Form',
      assigneeId: n.data?.config?.assigneeId,
    }))
}

export type WaitUnit = 'seconds' | 'minutes' | 'days'

export function normalizeWaitConfig(config: Record<string, string> = {}): { duration: string; unit: WaitUnit } {
  if (config.duration !== undefined && config.duration !== '') {
    const unit = config.unit as WaitUnit
    return {
      duration: config.duration,
      unit: unit === 'seconds' || unit === 'minutes' || unit === 'days' ? unit : 'days',
    }
  }
  if (config.days !== undefined && config.days !== '') {
    return { duration: config.days, unit: 'days' }
  }
  return { duration: '', unit: 'days' }
}

export function formatWaitLabel(config: Record<string, string> = {}): string {
  const { duration, unit } = normalizeWaitConfig(config)
  if (!duration || duration === '0') return ''
  const n = parseFloat(duration)
  if (isNaN(n)) return ''
  const word =
    unit === 'seconds' ? (n === 1 ? 'second' : 'seconds')
    : unit === 'minutes' ? (n === 1 ? 'minute' : 'minutes')
    : (n === 1 ? 'day' : 'days')
  return `${duration} ${word}`
}

export function waitToMilliseconds(config: Record<string, string> = {}): number {
  const { duration, unit } = normalizeWaitConfig(config)
  const n = parseFloat(duration)
  if (isNaN(n) || n <= 0) return 0
  if (unit === 'seconds') return n * 1000
  if (unit === 'minutes') return n * 60 * 1000
  return n * 24 * 60 * 60 * 1000
}

export function extractTaskNodes(nodes: WorkflowNodeParsed[]): WorkflowTaskNode[] {
  return nodes
    .filter(n => n.type === 'task' && n.data?.config)
    .map(n => ({
      title: n.data!.config!.title || 'Follow up',
      priority: n.data!.config!.priority || 'medium',
      due: n.data!.config!.due || '1',
      assigneeId: n.data?.config?.assigneeId,
    }))
}
