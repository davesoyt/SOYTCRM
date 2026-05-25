'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format, formatDistanceToNow, isToday, isYesterday, isSameDay } from 'date-fns'
import {
  Mail,
  Phone,
  StickyNote,
  TrendingUp,
  MoveRight,
  CheckSquare,
  Sparkles,
  GitBranch,
  ClipboardList,
  Inbox,
} from 'lucide-react'

type Activity = {
  id: string
  type: string
  title: string
  body: string | null
  createdAt: string | Date
  opportunityId?: string | null
  opportunity?: { name: string } | null
}

type TaskItem = {
  id: string
  title: string
  status: string
  dueDate: string | Date | null
  createdAt: string | Date
}

type EnrollmentItem = {
  id: string
  sequenceId: string
  sequence: { name: string }
  startedAt: string | Date
  active: boolean
}

type Props = {
  activities: Activity[]
  tasks?: TaskItem[]
  enrollments?: EnrollmentItem[]
  showFilters?: boolean
}

type TimelineItem = {
  id: string
  kind: 'activity' | 'task' | 'enrollment'
  type: string
  title: string
  subtitle: string | null
  timestamp: Date
  link: string | null
  Icon: React.ElementType
  color: string
  ring: string
  filterGroup: FilterGroup
}

type FilterGroup = 'all' | 'emails' | 'calls' | 'notes' | 'tasks' | 'opportunities' | 'workflows'

const TYPE_STYLES: Record<string, { Icon: React.ElementType; color: string; ring: string; group: FilterGroup }> = {
  email:             { Icon: Mail,            color: 'bg-blue-100 text-blue-600',       ring: 'ring-blue-50',     group: 'emails' },
  call:              { Icon: Phone,           color: 'bg-green-100 text-green-600',     ring: 'ring-green-50',    group: 'calls' },
  note:              { Icon: StickyNote,      color: 'bg-amber-100 text-amber-600',     ring: 'ring-amber-50',    group: 'notes' },
  opportunity_created: { Icon: TrendingUp, color: 'bg-emerald-100 text-emerald-600', ring: 'ring-emerald-50', group: 'opportunities' },
  deal_created:        { Icon: TrendingUp, color: 'bg-emerald-100 text-emerald-600', ring: 'ring-emerald-50', group: 'opportunities' },
  stage_change:        { Icon: MoveRight,  color: 'bg-indigo-100 text-indigo-600',   ring: 'ring-indigo-50',   group: 'opportunities' },
  task_created:      { Icon: CheckSquare,     color: 'bg-violet-100 text-violet-600',   ring: 'ring-violet-50',   group: 'tasks' },
  enrichment:        { Icon: Sparkles,        color: 'bg-pink-100 text-pink-600',       ring: 'ring-pink-50',     group: 'workflows' },
  sequence_enrolled: { Icon: GitBranch,       color: 'bg-cyan-100 text-cyan-600',       ring: 'ring-cyan-50',     group: 'workflows' },
  form_submitted:    { Icon: ClipboardList,   color: 'bg-rose-100 text-rose-600',       ring: 'ring-rose-50',     group: 'workflows' },
}

const DEFAULT_STYLE = {
  Icon: StickyNote,
  color: 'bg-zinc-100 text-zinc-600',
  ring: 'ring-zinc-50',
  group: 'all' as FilterGroup,
}

const FILTER_LABELS: { key: FilterGroup; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'emails', label: 'Emails' },
  { key: 'calls', label: 'Calls' },
  { key: 'notes', label: 'Notes' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'opportunities', label: 'Opportunities' },
  { key: 'workflows', label: 'Workflows' },
]

function dayHeader(d: Date): string {
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMMM d, yyyy')
}

function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v)
}

export default function ActivityTimeline({
  activities,
  tasks = [],
  enrollments = [],
  showFilters = false,
}: Props) {
  const [filter, setFilter] = useState<FilterGroup>('all')

  const items: TimelineItem[] = useMemo(() => {
    const list: TimelineItem[] = []

    for (const a of activities) {
      const style = TYPE_STYLES[a.type] ?? DEFAULT_STYLE
      list.push({
        id: `activity-${a.id}`,
        kind: 'activity',
        type: a.type,
        title: a.title,
        subtitle: a.body,
        timestamp: toDate(a.createdAt),
        link: a.opportunityId ? `/opportunities` : null,
        Icon: style.Icon,
        color: style.color,
        ring: style.ring,
        filterGroup: style.group,
      })
    }

    for (const t of tasks) {
      const style = TYPE_STYLES.task_created
      const due = t.dueDate ? toDate(t.dueDate) : null
      const dueLabel = due ? `Due ${format(due, 'MMM d')}` : 'No due date'
      list.push({
        id: `task-${t.id}`,
        kind: 'task',
        type: 'task_created',
        title: t.title,
        subtitle: `${dueLabel} · ${t.status}`,
        timestamp: toDate(t.createdAt),
        link: '/tasks',
        Icon: style.Icon,
        color: style.color,
        ring: style.ring,
        filterGroup: 'tasks',
      })
    }

    for (const e of enrollments) {
      const style = TYPE_STYLES.sequence_enrolled
      list.push({
        id: `enrollment-${e.id}`,
        kind: 'enrollment',
        type: 'sequence_enrolled',
        title: `Enrolled in ${e.sequence.name}`,
        subtitle: e.active ? 'Active' : 'Completed',
        timestamp: toDate(e.startedAt),
        link: `/sequences/${e.sequenceId}`,
        Icon: style.Icon,
        color: style.color,
        ring: style.ring,
        filterGroup: 'workflows',
      })
    }

    return list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }, [activities, tasks, enrollments])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter(i => i.filterGroup === filter)
  }, [items, filter])

  // Group by day
  const grouped: { day: string; items: TimelineItem[] }[] = []
  for (const item of filtered) {
    const last = grouped[grouped.length - 1]
    if (last && isSameDay(last.items[0].timestamp, item.timestamp)) {
      last.items.push(item)
    } else {
      grouped.push({ day: dayHeader(item.timestamp), items: [item] })
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-400">
        <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity yet</p>
      </div>
    )
  }

  return (
    <div>
      {showFilters && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {FILTER_LABELS.map(({ key, label }) => {
            const active = filter === key
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-400 py-6 text-center">No items match this filter.</p>
      ) : (
        <div className="relative">
          {/* Continuous left rail */}
          <div className="absolute left-3 top-2 bottom-2 w-px bg-violet-200" aria-hidden="true" />

          <div className="space-y-6">
            {grouped.map(group => (
              <div key={group.day}>
                <div className="sticky top-0 z-10 -ml-1 mb-3 bg-white/80 backdrop-blur-sm py-1">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                    {group.day}
                  </span>
                </div>

                <ul className="space-y-3">
                  {group.items.map(item => {
                    const Icon = item.Icon
                    const inner = (
                      <div className="flex gap-3 items-start">
                        <span
                          className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-4 ${item.color} ${item.ring}`}
                        >
                          <Icon className="w-3 h-3" />
                        </span>
                        <div className="flex-1 min-w-0 -mt-0.5">
                          <p className="text-sm font-medium text-zinc-900 truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed line-clamp-3">
                              {item.subtitle}
                            </p>
                          )}
                          <time className="block mt-1 text-xs text-zinc-400">
                            {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                          </time>
                        </div>
                      </div>
                    )

                    return (
                      <li key={item.id}>
                        {item.link ? (
                          <Link
                            href={item.link}
                            className="block rounded-lg -mx-2 px-2 py-1 hover:bg-zinc-50 transition-colors"
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div className="px-0 py-1">{inner}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
