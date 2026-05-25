'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Clock, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronRight, User, GitBranch, Zap, ListChecks,
  Play, Layers, Search, Filter, Calendar,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

type RunLog = {
  id: string
  stepIndex: number
  nodeType: string
  nodeLabel: string
  dataJson: string
  status: string
  executedAt: string
}

type Enrollment = {
  id: string
  contactId: string | null
  contact: { id: string; firstName: string; lastName: string; email: string } | null
  recordType: string
  recordId: string
  recordLabel: string
  sequenceId: string
  sequence: { id: string; name: string; trigger: string }
  currentStep: number
  currentNodeId: string | null
  resumeAt: string | null
  active: boolean
  startedAt: string
  completedAt: string | null
  runLogs: RunLog[]
}

function enrollmentStatus(e: Enrollment): 'waiting' | 'in_progress' | 'completed' {
  if (!e.active) return 'completed'
  if (e.resumeAt && new Date(e.resumeAt) > new Date()) return 'waiting'
  return 'in_progress'
}

type Props = {
  enrollments: Enrollment[]
  sequences: { id: string; name: string }[]
}

// ---- Node type styling ----

const NODE_STYLES: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  enrolled:  { icon: Play,         color: 'text-blue-600',   bg: 'bg-blue-100',   label: 'Enrolled' },
  email:     { icon: Mail,         color: 'text-violet-600', bg: 'bg-violet-100', label: 'Email Sent' },
  task:      { icon: ListChecks,   color: 'text-amber-600',  bg: 'bg-amber-100',  label: 'Task Created' },
  wait:      { icon: Clock,        color: 'text-zinc-500',   bg: 'bg-zinc-100',   label: 'Wait' },
  condition: { icon: Filter,       color: 'text-purple-600', bg: 'bg-purple-100', label: 'Condition' },
  completed: { icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-100',  label: 'Completed' },
  webhook:   { icon: Zap,          color: 'text-orange-600', bg: 'bg-orange-100', label: 'Webhook' },
  moveopportunity:  { icon: Layers,       color: 'text-indigo-600', bg: 'bg-indigo-100', label: 'Move Opportunity' },
  updatescore:{ icon: Zap,         color: 'text-pink-600',   bg: 'bg-pink-100',   label: 'Update Score' },
}

function nodeStyle(type: string) {
  return NODE_STYLES[type] ?? { icon: Zap, color: 'text-zinc-500', bg: 'bg-zinc-100', label: type }
}

// ---- Duration helper ----
function duration(start: string, end: string | null): string {
  if (!end) return 'In progress'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

// ---- Log detail renderer ----
function LogDetail({ log }: { log: RunLog }) {
  let data: Record<string, unknown> = {}
  try { data = JSON.parse(log.dataJson) } catch {}

  const style = nodeStyle(log.nodeType)
  const Icon = style.icon

  return (
    <div className="flex gap-3 py-2">
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className={`w-7 h-7 rounded-full ${style.bg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${style.color}`} />
        </div>
        <div className="w-px flex-1 bg-zinc-200 min-h-[8px]" />
      </div>
      <div className="flex-1 pb-2 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-zinc-800">{log.nodeLabel}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${style.bg} ${style.color}`}>{style.label}</span>
          <span className="text-xs text-zinc-400 ml-auto shrink-0">
            {format(new Date(log.executedAt), 'MMM d, h:mm a')}
          </span>
        </div>

        {/* Data details */}
        {Object.keys(data).length > 0 && (
          <div className="bg-zinc-50 rounded-lg border border-zinc-200 p-2.5 space-y-1 mt-1">
            {log.nodeType === 'email' && (
              <>
                {data.to && <div className="text-xs text-zinc-500"><span className="font-medium text-zinc-700">To:</span> {String(data.to)}</div>}
                {data.subject && <div className="text-xs text-zinc-500"><span className="font-medium text-zinc-700">Subject:</span> {String(data.subject)}</div>}
                {data.body && (
                  <div className="text-xs text-zinc-500 mt-1 border-t border-zinc-200 pt-1 line-clamp-3 whitespace-pre-line">
                    {String(data.body).slice(0, 300)}{String(data.body).length > 300 ? '…' : ''}
                  </div>
                )}
              </>
            )}
            {log.nodeType === 'task' && (
              <>
                {data.title && <div className="text-xs text-zinc-500"><span className="font-medium text-zinc-700">Task:</span> {String(data.title)}</div>}
                {data.priority && <div className="text-xs text-zinc-500"><span className="font-medium text-zinc-700">Priority:</span> {String(data.priority)}</div>}
                {data.dueDate && <div className="text-xs text-zinc-500"><span className="font-medium text-zinc-700">Due:</span> {String(data.dueDate)}</div>}
              </>
            )}
            {log.nodeType === 'wait' && (
              <>
                {data.waitLabel != null && data.waitLabel !== '' && (
                  <div className="text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700">Duration:</span> {String(data.waitLabel)}
                  </div>
                )}
                {data.resumeAt != null && (
                  <div className="text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700">Resumes:</span>{' '}
                    {format(new Date(String(data.resumeAt)), 'MMM d, h:mm:ss a')}
                  </div>
                )}
                {log.status === 'running' && (
                  <div className="text-xs text-blue-600 font-medium mt-1 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Waiting…
                  </div>
                )}
              </>
            )}
            {(log.nodeType === 'enrolled' || log.nodeType === 'completed') && (
              <div className="text-xs text-zinc-500">{String(data.event ?? '')}</div>
            )}
            {!['email', 'task', 'enrolled', 'completed', 'wait'].includes(log.nodeType) && (
              Object.entries(data).map(([k, v]) => (
                <div key={k} className="text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700">{k}:</span> {String(v)}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Enrollment row ----
function EnrollmentRow({ enrollment }: { enrollment: Enrollment }) {
  const [expanded, setExpanded] = useState(false)
  const status = enrollmentStatus(enrollment)
  const isActive = status !== 'completed'
  const logCount = enrollment.runLogs.length

  const statusLabel =
    status === 'waiting' ? 'Waiting'
    : status === 'in_progress' ? 'In Progress'
    : 'Completed'

  const statusColor =
    status === 'waiting' ? 'bg-amber-100 text-amber-700'
    : status === 'in_progress' ? 'bg-blue-100 text-blue-700'
    : 'bg-green-100 text-green-700'

  const totalSteps = Math.max(enrollment.currentStep, logCount)

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* Row header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          status === 'completed' ? 'bg-green-100' : status === 'waiting' ? 'bg-amber-100' : 'bg-blue-100'
        }`}>
          {status === 'completed'
            ? <CheckCircle2 className="w-4 h-4 text-green-600" />
            : status === 'waiting'
              ? <Clock className="w-4 h-4 text-amber-600" />
              : <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {enrollment.contact ? (
              <>
                <Link
                  href={`/contacts/${enrollment.contact.id}`}
                  onClick={e => e.stopPropagation()}
                  className="text-sm font-semibold text-zinc-900 hover:underline"
                >
                  {enrollment.contact.firstName} {enrollment.contact.lastName}
                </Link>
                <span className="text-xs text-zinc-400">{enrollment.contact.email}</span>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-zinc-900">{enrollment.recordLabel}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 capitalize">{enrollment.recordType}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Link
              href={`/sequences/${enrollment.sequence.id}`}
              onClick={e => e.stopPropagation()}
              className="text-xs text-violet-600 hover:underline flex items-center gap-1"
            >
              <GitBranch className="w-3 h-3" />
              {enrollment.sequence.name}
            </Link>
            <span className="text-xs text-zinc-400">
              Started {formatDistanceToNow(new Date(enrollment.startedAt), { addSuffix: true })}
            </span>
            {enrollment.completedAt && (
              <span className="text-xs text-zinc-400">
                · {duration(enrollment.startedAt, enrollment.completedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
            {statusLabel}
          </span>
          {logCount > 0 && (
            <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
              {logCount} step{logCount !== 1 ? 's' : ''}
            </span>
          )}
          {expanded
            ? <ChevronDown className="w-4 h-4 text-zinc-400" />
            : <ChevronRight className="w-4 h-4 text-zinc-400" />
          }
        </div>
      </button>

      {/* Step progress bar */}
      {totalSteps > 0 && (
        <div className="px-4 pb-2">
          <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                status === 'completed' ? 'bg-green-400' : status === 'waiting' ? 'bg-amber-400' : 'bg-blue-400'
              }`}
              style={{ width: isActive && totalSteps > 0 ? `${Math.min((enrollment.currentStep / Math.max(totalSteps, 1)) * 100, 95)}%` : '100%' }}
            />
          </div>
        </div>
      )}

      {/* Expanded step log */}
      {expanded && (
        <div className="border-t border-zinc-100 px-4 pt-3 pb-1">
          {enrollment.runLogs.length === 0 ? (
            <p className="text-xs text-zinc-400 py-3 text-center">No step logs recorded yet.</p>
          ) : (
            <div>
              {enrollment.runLogs.map((log, i) => (
                <div key={log.id} style={{ position: 'relative' }}>
                  {i === enrollment.runLogs.length - 1
                    ? <LogDetail log={{ ...log, dataJson: log.dataJson }} />
                    : <LogDetail log={log} />
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Main ----
export default function WorkflowHistoryClient({ enrollments, sequences }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterSeq, setFilterSeq] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'running' | 'completed'>('all')

  const hasActive = enrollments.some(e => e.active)

  useEffect(() => {
    if (!hasActive) return
    const tick = async () => {
      try {
        await fetch('/api/workflows/tick', { cache: 'no-store' })
        router.refresh()
      } catch {
        /* ignore network errors during poll */
      }
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => clearInterval(id)
  }, [hasActive, router])

  const filtered = useMemo(() => {
    return enrollments.filter(e => {
      if (filterSeq && e.sequenceId !== filterSeq) return false
      if (filterStatus === 'running' && !e.active) return false
      if (filterStatus === 'completed' && e.active) return false
      if (search) {
        const q = search.toLowerCase()
        const name = e.contact
          ? `${e.contact.firstName} ${e.contact.lastName}`.toLowerCase()
          : e.recordLabel.toLowerCase()
        const email = e.contact?.email.toLowerCase() ?? ''
        const seq = e.sequence.name.toLowerCase()
        if (!name.includes(q) && !email.includes(q) && !seq.includes(q)) return false
      }
      return true
    })
  }, [enrollments, filterSeq, filterStatus, search])

  const running = enrollments.filter(e => e.active).length
  const waiting = enrollments.filter(e => enrollmentStatus(e) === 'waiting').length
  const completed = enrollments.filter(e => !e.active).length

  const inp = 'rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900'

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center gap-4 flex-wrap">
        <Link href="/sequences" className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-violet-600" />
            <h1 className="text-lg font-semibold text-zinc-900">Workflow Run History</h1>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-zinc-500">{enrollments.length} total enrollments</span>
            <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />{running} in progress
            </span>
            {waiting > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <Clock className="w-3 h-3" />{waiting} waiting
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="w-3 h-3" />{completed} completed
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 bg-zinc-50 border-b border-zinc-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contact or workflow…"
            className={`${inp} pl-8 w-full`}
          />
        </div>
        <select value={filterSeq} onChange={e => setFilterSeq(e.target.value)} className={inp}>
          <option value="">All workflows</option>
          {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          {(['all', 'running', 'completed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${filterStatus === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {s === 'running' ? 'in progress' : s}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-400 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Calendar className="w-10 h-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 font-medium">No workflow runs found</p>
            <p className="text-zinc-400 text-sm mt-1">
              {enrollments.length === 0
                ? 'Enroll a contact in a workflow to see history here.'
                : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl">
            {filtered.map(e => <EnrollmentRow key={e.id} enrollment={e} />)}
          </div>
        )}
      </div>
    </div>
  )
}
