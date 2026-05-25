'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Check, X, Loader2, ChevronRight,
  Calendar, User, Building2, Filter, TrendingUp, ClipboardList,
} from 'lucide-react'
import { createTask, updateTask, updateTaskStatus, deleteTask, deleteTasks } from '@/app/actions'
import { isFillFormTask, parseFormIdFromTask, formFillUrl } from '@/lib/formTasks'

type TaskRecord = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  assigneeId: string | null
  contactId: string | null
  companyId: string | null
  opportunityId: string | null
  segmentId: string | null
  assignee: { id: string; name: string; color: string } | null
  contact: { id: string; firstName: string; lastName: string } | null
  company: { id: string; name: string } | null
  opportunity: { id: string; name: string } | null
}

type Props = {
  tasks: TaskRecord[]
  users: { id: string; name: string; color: string }[]
  segments: { id: string; name: string; objectType: string }[]
  contacts: { id: string; firstName: string; lastName: string }[]
  companies: { id: string; name: string }[]
  opportunities: { id: string; name: string }[]
}

const COLUMNS = [
  { key: 'not_started', label: 'Not Started',  color: 'bg-zinc-50 text-zinc-500'   },
  { key: 'todo',        label: 'To Do',        color: 'bg-zinc-100 text-zinc-600'  },
  { key: 'in_progress', label: 'In Progress',  color: 'bg-blue-100 text-blue-700'  },
  { key: 'done',        label: 'Done',         color: 'bg-green-100 text-green-700' },
]

type LinkMode = 'none' | 'segment' | 'record'
type RecordKind = 'contact' | 'company' | 'opportunity'

function inferLinkMode(initial?: TaskRecord): LinkMode {
  if (initial?.segmentId) return 'segment'
  if (initial?.contactId || initial?.companyId || initial?.opportunityId) return 'record'
  return 'none'
}

function inferRecordKind(initial?: TaskRecord): RecordKind {
  if (initial?.companyId) return 'company'
  if (initial?.opportunityId) return 'opportunity'
  return 'contact'
}

const PRIORITIES: Record<string, { label: string; color: string; dot: string }> = {
  low:    { label: 'Low',    color: 'text-zinc-400',   dot: 'bg-zinc-400'  },
  medium: { label: 'Medium', color: 'text-amber-500',  dot: 'bg-amber-400' },
  high:   { label: 'High',   color: 'text-red-500',    dot: 'bg-red-500'   },
}

function Avatar({ name, color, size = 6 }: { name: string; color: string; size?: number }) {
  const init = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`} style={{ backgroundColor: color }}>
      {init}
    </div>
  )
}

function TaskForm({
  users, segments, contacts, companies, opportunities,
  initial, onDone, defaultStatus,
}: {
  users: Props['users']
  segments: Props['segments']
  contacts: Props['contacts']
  companies: Props['companies']
  opportunities: Props['opportunities']
  initial?: TaskRecord
  onDone: () => void
  defaultStatus?: string
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [status, setStatus] = useState(initial?.status ?? defaultStatus ?? 'todo')
  const [priority, setPriority] = useState(initial?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(initial?.dueDate ? initial.dueDate.slice(0, 10) : '')
  const [assigneeId, setAssigneeId] = useState(initial?.assigneeId ?? '')
  const [linkMode, setLinkMode] = useState<LinkMode>(() => inferLinkMode(initial))
  const [recordKind, setRecordKind] = useState<RecordKind>(() => inferRecordKind(initial))
  const [contactId, setContactId] = useState(initial?.contactId ?? '')
  const [companyId, setCompanyId] = useState(initial?.companyId ?? '')
  const [opportunityId, setOpportunityId] = useState(initial?.opportunityId ?? '')
  const [segmentId, setSegmentId] = useState(initial?.segmentId ?? '')
  const [isPending, startTransition] = useTransition()

  function onLinkModeChange(mode: LinkMode) {
    setLinkMode(mode)
    if (mode !== 'segment') setSegmentId('')
    if (mode !== 'record') {
      setContactId('')
      setCompanyId('')
      setOpportunityId('')
    }
  }

  function onRecordKindChange(kind: RecordKind) {
    setRecordKind(kind)
    setContactId('')
    setCompanyId('')
    setOpportunityId('')
  }

  function submit() {
    startTransition(async () => {
      const data = {
        title, description: description || undefined,
        status, priority,
        dueDate: dueDate || undefined,
        assigneeId: assigneeId || null,
        contactId: linkMode === 'record' && recordKind === 'contact' ? (contactId || null) : null,
        companyId: linkMode === 'record' && recordKind === 'company' ? (companyId || null) : null,
        opportunityId: linkMode === 'record' && recordKind === 'opportunity' ? (opportunityId || null) : null,
        segmentId: linkMode === 'segment' ? (segmentId || null) : null,
      }
      if (initial) {
        await updateTask(initial.id, data)
      } else {
        await createTask(data)
      }
      onDone()
    })
  }

  const sel = 'w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900'
  const inp = 'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900'

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 space-y-3">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title *" autoFocus
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900" />
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)"
        rows={2} className={`${inp} resize-none`} />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className={sel}>
            {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} className={sel}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Due Date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Assignee</label>
          <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className={sel}>
            <option value="">— unassigned —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-700 text-xs font-medium select-none">Link (optional)</summary>
        <div className="mt-2 space-y-2">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Link type</label>
            <select
              value={linkMode}
              onChange={e => onLinkModeChange(e.target.value as LinkMode)}
              className={sel}
            >
              <option value="none">No link</option>
              <option value="segment">Segment list</option>
              <option value="record">Record</option>
            </select>
          </div>
          {linkMode === 'segment' && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Segment</label>
              <select value={segmentId} onChange={e => setSegmentId(e.target.value)} className={sel}>
                <option value="">Select a segment…</option>
                {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {linkMode === 'record' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Record type</label>
                <select
                  value={recordKind}
                  onChange={e => onRecordKindChange(e.target.value as RecordKind)}
                  className={sel}
                >
                  <option value="contact">Contact</option>
                  <option value="company">Company</option>
                  <option value="opportunity">Opportunity</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  {recordKind === 'contact' ? 'Contact' : recordKind === 'company' ? 'Company' : 'Opportunity'}
                </label>
                {recordKind === 'contact' && (
                  <select value={contactId} onChange={e => setContactId(e.target.value)} className={sel}>
                    <option value="">Select…</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                  </select>
                )}
                {recordKind === 'company' && (
                  <select value={companyId} onChange={e => setCompanyId(e.target.value)} className={sel}>
                    <option value="">Select…</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                {recordKind === 'opportunity' && (
                  <select value={opportunityId} onChange={e => setOpportunityId(e.target.value)} className={sel}>
                    <option value="">Select…</option>
                    {opportunities.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>
      </details>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onDone} className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button onClick={submit} disabled={isPending || !title.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {initial ? 'Save' : 'Add Task'}
        </button>
      </div>
    </div>
  )
}

function TaskCard({
  task, users, segments, contacts, companies, opportunities,
}: { task: TaskRecord } & Omit<Props, 'tasks'>) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const pri = PRIORITIES[task.priority] ?? PRIORITIES.medium
  const formId = parseFormIdFromTask(task)
  const isFormTask = isFillFormTask(task) && !!formId

  function openForm() {
    if (formId) router.push(formFillUrl(formId, task.id))
  }

  function moveStatus(status: string) {
    startTransition(async () => { await updateTaskStatus(task.id, status) })
  }

  function remove() {
    if (!confirm('Delete this task?')) return
    startTransition(async () => { await deleteTask(task.id) })
  }

  if (editing) {
    return (
      <TaskForm
        initial={task} users={users} segments={segments}
        contacts={contacts} companies={companies} opportunities={opportunities}
        onDone={() => setEditing(false)}
      />
    )
  }

  return (
    <div
      className={`bg-white rounded-xl border p-3 group transition-colors ${
        isFormTask
          ? 'border-violet-200 hover:border-violet-400 cursor-pointer ring-1 ring-violet-50'
          : 'border-zinc-200 hover:border-zinc-300 cursor-pointer'
      }`}
      onClick={() => (isFormTask ? openForm() : setExpanded(e => !e))}
    >
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pri.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-zinc-900 leading-snug">{task.title}</p>
            {isFormTask && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                <ClipboardList className="w-3 h-3" />
                Click to fill
              </span>
            )}
          </div>
          {task.description && !expanded && !isFormTask && (
            <p className="text-xs text-zinc-400 mt-0.5 truncate">{task.description}</p>
          )}
          {expanded && task.description && (
            <p className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {task.assignee && (
              <span className="flex items-center gap-1">
                <Avatar name={task.assignee.name} color={task.assignee.color} size={5} />
                <span className="text-xs text-zinc-500">{task.assignee.name.split(' ')[0]}</span>
              </span>
            )}
            {task.dueDate && (
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <Calendar className="w-3 h-3" />
                {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
            {task.contact && (
              <Link href={`/contacts/${task.contact.id}`} onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-violet-600 hover:underline">
                <User className="w-3 h-3" />{task.contact.firstName}
              </Link>
            )}
            {task.company && (
              <Link href={`/companies/${task.company.id}`} onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <Building2 className="w-3 h-3" />{task.company.name}
              </Link>
            )}
            {task.opportunity && (
              <Link href="/opportunities" onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-amber-600 hover:underline">
                <TrendingUp className="w-3 h-3" />{task.opportunity.name}
              </Link>
            )}
            {task.segmentId && (
              <Link href={`/segments/${task.segmentId}`} onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                <Filter className="w-3 h-3" />
                {segments.find(s => s.id === task.segmentId)?.name ?? 'Segment'}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
          {isFormTask && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1 rounded text-violet-500 hover:text-violet-700 hover:bg-violet-50"
              title="Status options"
            >
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          )}
          <button onClick={() => setEditing(true)} className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={remove} className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-zinc-100 flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
          {COLUMNS.filter(c => c.key !== task.status).map(c => (
            <button key={c.key} onClick={() => moveStatus(c.key)} disabled={isPending}
              className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${c.color} hover:opacity-80`}>
              → {c.label}
            </button>
          ))}
          <button onClick={() => setEditing(true)}
            className="text-xs px-2 py-1 rounded-full font-medium bg-zinc-100 text-zinc-600 hover:bg-zinc-200 ml-auto">
            Edit
          </button>
        </div>
      )}
    </div>
  )
}

export default function TasksBoard({ tasks: initialTasks, users, segments, contacts, companies, opportunities }: Props) {
  const [addingCol, setAddingCol] = useState<string | null>(null)
  const [deletingCol, setDeletingCol] = useState<string | null>(null)
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [isBulkPending, startBulkTransition] = useTransition()

  const filtered = initialTasks.filter(t => {
    if (filterAssignee && t.assigneeId !== filterAssignee) return false
    if (filterPriority && t.priority !== filterPriority) return false
    return true
  })

  const byStatus = (status: string) => filtered.filter(t => t.status === status)

  function deleteColumn(status: string, label: string) {
    const ids = byStatus(status).map(t => t.id)
    if (ids.length === 0) return
    if (!confirm(`Delete all ${ids.length} task${ids.length !== 1 ? 's' : ''} in "${label}"?`)) return
    setDeletingCol(status)
    startBulkTransition(async () => {
      await deleteTasks(ids)
      setDeletingCol(null)
    })
  }

  const sel = 'rounded-lg border border-zinc-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900'

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 bg-white flex items-center gap-4 shrink-0 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">Tasks</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{initialTasks.length} total · {initialTasks.filter(t => t.status !== 'done').length} open</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className={sel}>
            <option value="">All assignees</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={sel}>
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button onClick={() => setAddingCol('todo')}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
            <Plus className="w-4 h-4" /> New Task
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-6 h-full min-w-0" style={{ minWidth: 'max-content' }}>
          {COLUMNS.map(col => {
            const colTasks = byStatus(col.key)
            return (
              <div key={col.key} className="w-72 shrink-0 flex flex-col min-h-0">
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.color}`}>{col.label}</span>
                  <span className="text-xs text-zinc-400 font-medium">{colTasks.length}</span>
                  <div className="ml-auto flex items-center gap-0.5">
                    {colTasks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => deleteColumn(col.key, col.label)}
                        disabled={isBulkPending && deletingCol === col.key}
                        title={`Delete all tasks in ${col.label}`}
                        className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {isBulkPending && deletingCol === col.key
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAddingCol(col.key)}
                      title={`Add task to ${col.label}`}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Add form */}
                {addingCol === col.key && (
                  <div className="mb-3">
                    <TaskForm
                      defaultStatus={col.key} users={users} segments={segments}
                      contacts={contacts} companies={companies} opportunities={opportunities}
                      onDone={() => setAddingCol(null)}
                    />
                  </div>
                )}

                {/* Cards */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {colTasks.length === 0 && addingCol !== col.key && (
                    <div className="rounded-xl border-2 border-dashed border-zinc-200 p-6 text-center">
                      <p className="text-xs text-zinc-400">No tasks</p>
                    </div>
                  )}
                  {colTasks.map(task => (
                    <TaskCard key={task.id} task={task} users={users} segments={segments}
                      contacts={contacts} companies={companies} opportunities={opportunities} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
