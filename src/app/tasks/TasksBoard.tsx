'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Plus, Trash2, Check, X, Loader2, ChevronDown, ChevronRight,
  Flag, Calendar, User, Tag, Building2, Users,
} from 'lucide-react'
import { createTask, updateTask, updateTaskStatus, deleteTask } from '@/app/actions'

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
  dealId: string | null
  segmentId: string | null
  assignee: { id: string; name: string; color: string } | null
  contact: { id: string; firstName: string; lastName: string } | null
  company: { id: string; name: string } | null
  deal: { id: string; name: string } | null
}

type Props = {
  tasks: TaskRecord[]
  users: { id: string; name: string; color: string }[]
  segments: { id: string; name: string; objectType: string }[]
  contacts: { id: string; firstName: string; lastName: string }[]
  companies: { id: string; name: string }[]
  deals: { id: string; name: string }[]
}

const COLUMNS = [
  { key: 'todo',        label: 'To Do',       color: 'bg-zinc-100 text-zinc-600'  },
  { key: 'in_progress', label: 'In Progress',  color: 'bg-blue-100 text-blue-700'  },
  { key: 'done',        label: 'Done',         color: 'bg-green-100 text-green-700'},
]

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
  users, segments, contacts, companies, deals,
  initial, onDone, defaultStatus,
}: {
  users: Props['users']
  segments: Props['segments']
  contacts: Props['contacts']
  companies: Props['companies']
  deals: Props['deals']
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
  const [contactId, setContactId] = useState(initial?.contactId ?? '')
  const [companyId, setCompanyId] = useState(initial?.companyId ?? '')
  const [dealId, setDealId] = useState(initial?.dealId ?? '')
  const [segmentId, setSegmentId] = useState(initial?.segmentId ?? '')
  const [isPending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const data = {
        title, description: description || undefined,
        status, priority,
        dueDate: dueDate || undefined,
        assigneeId: assigneeId || undefined,
        contactId: contactId || undefined,
        companyId: companyId || undefined,
        dealId: dealId || undefined,
        segmentId: segmentId || undefined,
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
        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-700 text-xs font-medium select-none">Link to record (optional)</summary>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Contact</label>
            <select value={contactId} onChange={e => setContactId(e.target.value)} className={sel}>
              <option value="">—</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Company</label>
            <select value={companyId} onChange={e => setCompanyId(e.target.value)} className={sel}>
              <option value="">—</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Deal</label>
            <select value={dealId} onChange={e => setDealId(e.target.value)} className={sel}>
              <option value="">—</option>
              {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Segment</label>
            <select value={segmentId} onChange={e => setSegmentId(e.target.value)} className={sel}>
              <option value="">—</option>
              {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
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
  task, users, segments, contacts, companies, deals,
}: { task: TaskRecord } & Omit<Props, 'tasks'>) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const pri = PRIORITIES[task.priority] ?? PRIORITIES.medium

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
        contacts={contacts} companies={companies} deals={deals}
        onDone={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-3 group hover:border-zinc-300 transition-colors cursor-pointer"
      onClick={() => setExpanded(e => !e)}>
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pri.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 leading-snug">{task.title}</p>
          {task.description && !expanded && (
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
            {task.segmentId && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <Users className="w-3 h-3" />{segments.find(s => s.id === task.segmentId)?.name ?? 'Segment'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
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

export default function TasksBoard({ tasks: initialTasks, users, segments, contacts, companies, deals }: Props) {
  const [addingCol, setAddingCol] = useState<string | null>(null)
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  const filtered = initialTasks.filter(t => {
    if (filterAssignee && t.assigneeId !== filterAssignee) return false
    if (filterPriority && t.priority !== filterPriority) return false
    return true
  })

  const byStatus = (status: string) => filtered.filter(t => t.status === status)

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
                  <button onClick={() => setAddingCol(col.key)}
                    className="ml-auto p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Add form */}
                {addingCol === col.key && (
                  <div className="mb-3">
                    <TaskForm
                      defaultStatus={col.key} users={users} segments={segments}
                      contacts={contacts} companies={companies} deals={deals}
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
                      contacts={contacts} companies={companies} deals={deals} />
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
