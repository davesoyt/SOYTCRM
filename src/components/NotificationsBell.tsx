'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Bell, BellRing, CheckSquare, GitBranch, TrendingUp, AtSign, Wrench, X, Trash2,
} from 'lucide-react'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/app/actions'

type NotificationItem = {
  id: string
  userId: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  createdAt: string
}

function iconFor(type: string) {
  switch (type) {
    case 'task': return CheckSquare
    case 'workflow': return GitBranch
    case 'opportunity': return TrendingUp
    case 'mention': return AtSign
    case 'form': return Wrench
    default: return Bell
  }
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default function NotificationsBell({ currentUserId }: { currentUserId: string | null }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement | null>(null)

  async function load() {
    if (!currentUserId) return
    const data = await getNotifications(currentUserId)
    setItems(
      data.map(d => ({
        ...d,
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : (d.createdAt as unknown as string),
      })),
    )
  }

  useEffect(() => {
    if (!currentUserId) return
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const unread = items.filter(n => !n.read).length

  function handleItemClick(n: NotificationItem) {
    if (!n.read) {
      setItems(prev => prev.map(p => (p.id === n.id ? { ...p, read: true } : p)))
      startTransition(async () => { await markNotificationRead(n.id) })
    }
  }

  function handleMarkAll() {
    if (!currentUserId) return
    setItems(prev => prev.map(p => ({ ...p, read: true })))
    startTransition(async () => { await markAllNotificationsRead(currentUserId) })
  }

  function handleDelete(id: string) {
    setItems(prev => prev.filter(p => p.id !== id))
    startTransition(async () => { await deleteNotification(id) })
  }

  const Icon = unread > 0 ? BellRing : Bell

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        className="relative inline-flex items-center justify-center rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
      >
        <Icon className={`w-4 h-4 ${unread > 0 ? 'text-violet-600' : ''}`} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-zinc-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-xs font-medium text-violet-700 hover:text-violet-900"
                  title="Mark all as read"
                >
                  Mark all as read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {!currentUserId ? (
              <div className="px-4 py-10 text-center text-sm text-zinc-400">No user configured</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-zinc-400">
                <Bell className="mx-auto mb-2 w-5 h-5 text-zinc-300" />
                No notifications yet
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {items.map(n => {
                  const ItemIcon = iconFor(n.type)
                  const content = (
                    <div
                      className={`group flex items-start gap-2.5 px-4 py-2.5 transition-colors ${
                        n.read ? 'bg-white hover:bg-zinc-50' : 'bg-violet-50/60 hover:bg-violet-50'
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          n.read ? 'bg-zinc-100 text-zinc-500' : 'bg-violet-100 text-violet-700'
                        }`}
                      >
                        <ItemIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm ${
                            n.read ? 'font-medium text-zinc-700' : 'font-semibold text-zinc-900'
                          }`}
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="line-clamp-2 text-xs text-zinc-500">{n.body}</p>
                        )}
                        <p className="mt-0.5 text-[11px] text-zinc-400">{formatRelative(n.createdAt)}</p>
                      </div>
                      <button
                        onClick={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDelete(n.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition-opacity"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => {
                            handleItemClick(n)
                            setOpen(false)
                          }}
                          className="block"
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleItemClick(n)}
                          className="block w-full text-left"
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

