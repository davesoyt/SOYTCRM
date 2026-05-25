'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LayoutGrid, CheckSquare, GitBranch, ClipboardList,
  Calendar, Flag, ChevronDown, ChevronRight,
  Check, AlertCircle, Clock, User, Building2, ExternalLink,
  Circle, ArrowRight,
} from 'lucide-react'
import { updateTaskStatus } from '@/app/actions'
import { isFillFormTask, parseFormIdFromTask, formFillUrl } from '@/lib/formTasks'

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRec = { id: string; name: string; color: string }

type TaskRec = {
  id: string; title: string; description: string | null
  status: string; priority: string; dueDate: string | null
  assigneeId: string | null
  contact:  { id: string; firstName: string; lastName: string } | null
  company:  { id: string; name: string } | null
  opportunity:     { id: string; name: string } | null
  segmentId: string | null
}

type EnrollmentRec = {
  id: string; startedAt: string; currentStep: number
  contact:  { id: string; firstName: string; lastName: string; email: string }
  sequence: { id: string; name: string; nodesJson: string }
}

type FormRec = { id: string; name: string; description: string | null }

type WorkflowAction = {
  enrollmentId: string
  contactId: string; contactName: string; contactEmail: string
  sequenceId: string; sequenceName: string
  nodeLabel: string; nodeType: 'task' | 'form'
  formId?: string; formName?: string
  assigneeId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_CFG: Record<string, { label: string; dot: string; text: string; border: string }> = {
  high:   { label: 'High',   dot: 'bg-red-500',   text: 'text-red-600',   border: 'border-l-red-400'   },
  medium: { label: 'Medium', dot: 'bg-amber-400',  text: 'text-amber-600', border: 'border-l-amber-400' },
  low:    { label: 'Low',    dot: 'bg-zinc-400',   text: 'text-zinc-400',  border: 'border-l-zinc-300'  },
}

function avatar(name: string, color: string, size = 8) {
  const init = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}
      style={{ backgroundColor: color }}
    >
      {init}
    </div>
  )
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Parse workflow nodes for a given userId and extract task/form actions
function extractWorkflowActions(
  enrollments: EnrollmentRec[],
  userId: string,
  forms: FormRec[],
): WorkflowAction[] {
  const actions: WorkflowAction[] = []
  const formMap = new Map(forms.map(f => [f.id, f.name]))

  for (const e of enrollments) {
    let nodes: Array<{ type: string; data?: { config?: Record<string, string>; label?: string } }> = []
    try { nodes = JSON.parse(e.sequence.nodesJson || '[]') } catch { continue }

    for (const node of nodes) {
      const cfg = node.data?.config ?? {}
      if ((node.type === 'task' || node.type === 'form') && cfg.assigneeId === userId) {
        actions.push({
          enrollmentId: e.id,
          contactId: e.contact.id,
          contactName: `${e.contact.firstName} ${e.contact.lastName}`,
          contactEmail: e.contact.email,
          sequenceId: e.sequence.id,
          sequenceName: e.sequence.name,
          nodeLabel: node.data?.label ?? (node.type === 'task' ? 'Task' : 'Form'),
          nodeType: node.type as 'task' | 'form',
          ...(node.type === 'form' && cfg.formId ? {
            formId: cfg.formId,
            formName: formMap.get(cfg.formId) ?? 'Form',
          } : {}),
          assigneeId: userId,
        })
      }
    }
  }
  return actions
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, count, color }: {
  icon: React.ElementType; title: string; count: number; color: string
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`p-1.5 rounded-lg ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <h2 className="font-semibold text-zinc-900">{title}</h2>
      <span className="ml-auto text-xs font-semibold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">{count}</span>
    </div>
  )
}

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({ task }: { task: TaskRec }) {
  const router = useRouter()
  const [status, setStatus] = useState(task.status)
  const [, startTransition] = useTransition()
  const pri = PRIORITY_CFG[task.priority] ?? PRIORITY_CFG.medium
  const overdue = isOverdue(task.dueDate) && status !== 'done'
  const [expanded, setExpanded] = useState(false)
  const formId = parseFormIdFromTask(task)
  const isFormTask = isFillFormTask(task) && !!formId

  function advance() {
    const next = status === 'todo' ? 'in_progress' : 'done'
    setStatus(next)
    startTransition(async () => { await updateTaskStatus(task.id, next) })
  }

  return (
    <div
      className={`bg-white rounded-xl border border-l-4 ${pri.border} border-zinc-200 p-3 hover:shadow-sm transition-shadow cursor-pointer ${status === 'in_progress' ? 'ring-1 ring-blue-200' : ''}`}
      onClick={() => {
        if (isFormTask && formId) router.push(formFillUrl(formId, task.id))
        else setExpanded(v => !v)
      }}
    >
      <div className="flex items-start gap-2.5">
        {/* Status toggle */}
        <button
          onClick={e => { e.stopPropagation(); isFormTask && formId ? router.push(formFillUrl(formId, task.id)) : advance() }}
          title={status === 'todo' ? 'Mark in progress' : 'Mark done'}
          className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            status === 'done' ? 'bg-green-500 border-green-500' :
            status === 'in_progress' ? 'border-blue-400 bg-blue-50' :
            'border-zinc-300 hover:border-zinc-500'
          }`}
        >
          {status === 'done' && <Check className="w-3 h-3 text-white" />}
          {status === 'in_progress' && <Circle className="w-2 h-2 text-blue-400 fill-blue-400" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${status === 'done' ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
            {task.title}
            {isFormTask && (
              <span className="ml-2 text-[10px] font-medium text-violet-600 not-italic">· open form</span>
            )}
          </p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.dueDate && (
              <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-500 font-medium' : 'text-zinc-400'}`}>
                {overdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                {fmtDate(task.dueDate)}
              </span>
            )}
            <span className={`flex items-center gap-1 text-xs ${pri.text}`}>
              <Flag className="w-3 h-3" />{pri.label}
            </span>
            {status !== 'todo' && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {status === 'in_progress' ? 'In Progress' : 'Done'}
              </span>
            )}
          </div>

          {expanded && (
            <div className="mt-2 space-y-1.5" onClick={e => e.stopPropagation()}>
              {task.description && (
                <p className="text-xs text-zinc-500 whitespace-pre-wrap">{task.description}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {task.contact && (
                  <Link href={`/contacts/${task.contact.id}`}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:underline">
                    <User className="w-3 h-3" />
                    {task.contact.firstName} {task.contact.lastName}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
                {task.company && (
                  <Link href={`/companies/${task.company.id}`}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Building2 className="w-3 h-3" />{task.company.name}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-zinc-300 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>
    </div>
  )
}

// ── Workflow action card ───────────────────────────────────────────────────────

function WorkflowCard({ action }: { action: WorkflowAction }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${action.nodeType === 'form' ? 'bg-rose-100' : 'bg-green-100'}`}>
          {action.nodeType === 'form'
            ? <ClipboardList className="w-3.5 h-3.5 text-rose-600" />
            : <CheckSquare className="w-3.5 h-3.5 text-green-600" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 truncate">{action.nodeLabel}</p>
          <div className="flex items-center gap-1 text-xs text-zinc-400 mt-0.5">
            <GitBranch className="w-3 h-3 shrink-0" />
            <span className="truncate">{action.sequenceName}</span>
          </div>
          <div className="flex items-center gap-1 text-xs mt-1.5">
            <Link href={`/contacts/${action.contactId}`}
              className="flex items-center gap-1 text-violet-600 hover:underline font-medium">
              <User className="w-3 h-3" />{action.contactName}
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
            <span className="text-zinc-300">·</span>
            <span className="text-zinc-400 truncate">{action.contactEmail}</span>
          </div>
        </div>

        {action.nodeType === 'form' && action.formId && (
          <Link
            href={`/forms/${action.formId}`}
            onClick={e => e.stopPropagation()}
            className="shrink-0 flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg transition-colors"
          >
            Open <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed border-zinc-200 text-center">
      <Check className="w-6 h-6 text-zinc-300 mb-2" />
      <p className="text-sm text-zinc-400">{message}</p>
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function MyWorkDashboard({
  users, tasks, enrollments, forms,
}: {
  users: UserRec[]
  tasks: TaskRec[]
  enrollments: EnrollmentRec[]
  forms: FormRec[]
}) {
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const selectedUser = users.find(u => u.id === selectedUserId)

  // Filter tasks for this user
  const myTasks = useMemo(
    () => tasks.filter(t => t.assigneeId === selectedUserId),
    [tasks, selectedUserId]
  )

  const todoTasks       = myTasks.filter(t => t.status === 'todo')
  const inProgressTasks = myTasks.filter(t => t.status === 'in_progress')

  // Extract workflow / form actions for this user
  const workflowActions = useMemo(
    () => selectedUserId ? extractWorkflowActions(enrollments, selectedUserId, forms) : [],
    [enrollments, selectedUserId, forms]
  )
  const taskActions = workflowActions.filter(a => a.nodeType === 'task')
  const formActions = workflowActions.filter(a => a.nodeType === 'form')

  const totalActions = myTasks.length + workflowActions.length

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-50">

      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 bg-white shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-violet-100 rounded-xl">
              <LayoutGrid className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900">My Work</h1>
              <p className="text-xs text-zinc-500">Unified action dashboard</p>
            </div>
          </div>

          {/* User selector */}
          <div className="flex items-center gap-2 ml-auto">
            {selectedUser && avatar(selectedUser.name, selectedUser.color, 8)}
            <div className="relative">
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="appearance-none rounded-xl border border-zinc-300 pl-3 pr-8 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer min-w-[180px]"
              >
                <option value="">— Select a user —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Summary bar */}
        {selectedUser && (
          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-zinc-100">
            <Stat label="Open Tasks"      value={myTasks.length}         color="text-violet-600" />
            <Stat label="In Progress"     value={inProgressTasks.length} color="text-blue-600" />
            <Stat label="Overdue"         value={myTasks.filter(t => isOverdue(t.dueDate)).length} color="text-red-500" />
            <Stat label="Workflow Items"  value={taskActions.length}     color="text-green-600" />
            <Stat label="Forms to Fill"   value={formActions.length}     color="text-rose-600" />
            <div className="ml-auto text-xs text-zinc-400 font-medium">{totalActions} total actions</div>
          </div>
        )}
      </div>

      {/* Body */}
      {!selectedUserId ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-8 h-8 text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-700 mb-1">Select a user</h2>
            <p className="text-sm text-zinc-400">Choose a user from the dropdown to see their open tasks,<br />workflow actions, and form assignments.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* ── Column 1: Tasks ─────────────────────────────────────────── */}
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200">
              <SectionHeader icon={CheckSquare} title="Open Tasks" count={myTasks.length} color="bg-violet-600" />

              {myTasks.length === 0 ? (
                <EmptyState message="All caught up — no open tasks!" />
              ) : (
                <div className="space-y-2">
                  {/* In progress first */}
                  {inProgressTasks.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide px-1 mb-1">In Progress</p>
                      {inProgressTasks.map(t => <TaskCard key={t.id} task={t} />)}
                      {todoTasks.length > 0 && <div className="border-t border-zinc-200 my-3" />}
                    </>
                  )}
                  {todoTasks.length > 0 && (
                    <>
                      {inProgressTasks.length > 0 && (
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide px-1 mb-1">To Do</p>
                      )}
                      {todoTasks.map(t => <TaskCard key={t.id} task={t} />)}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Column 2: Workflow actions ───────────────────────────────── */}
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200">
              <SectionHeader icon={GitBranch} title="Workflow Actions" count={taskActions.length} color="bg-green-600" />

              {taskActions.length === 0 ? (
                <EmptyState message="No active workflow actions assigned" />
              ) : (
                <div className="space-y-2">
                  {taskActions.map((a, i) => <WorkflowCard key={i} action={a} />)}
                </div>
              )}

              {/* Enrolled contacts count */}
              {taskActions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-200 text-xs text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Set(taskActions.map(a => a.enrollmentId)).size} active enrollment{taskActions.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* ── Column 3: Form assignments ───────────────────────────────── */}
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200">
              <SectionHeader icon={ClipboardList} title="Forms to Fill" count={formActions.length} color="bg-rose-600" />

              {formActions.length === 0 ? (
                <EmptyState message="No form assignments pending" />
              ) : (
                <div className="space-y-2">
                  {formActions.map((a, i) => <WorkflowCard key={i} action={a} />)}
                </div>
              )}

              {/* Browse forms link */}
              <div className="mt-3 pt-3 border-t border-zinc-200">
                <Link href="/forms"
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-rose-600 transition-colors">
                  <ClipboardList className="w-3 h-3" />
                  Browse all forms
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-lg font-bold ${color}`}>{value}</span>
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  )
}
