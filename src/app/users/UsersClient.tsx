'use client'

import { useState, useTransition } from 'react'
import { UserCircle, Plus, Pencil, Trash2, Check, X, Loader2, Mail, Shield } from 'lucide-react'
import { createUser, updateUser, deleteUser } from '@/app/actions'

type User = { id: string; name: string; email: string; role: string; color: string }

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

const ROLES = ['admin', 'manager', 'member']

function Avatar({ user, size = 'md' }: { user: { name: string; color: string }; size?: 'sm' | 'md' | 'lg' }) {
  const initials = user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const cls = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-sm'
  return (
    <div className={`${cls} rounded-full flex items-center justify-center font-bold text-white shrink-0`} style={{ backgroundColor: user.color }}>
      {initials}
    </div>
  )
}

function UserForm({ onDone, initial }: { onDone: () => void; initial?: User }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [role, setRole] = useState(initial?.role ?? 'member')
  const [color, setColor] = useState(initial?.color ?? COLORS[0])
  const [isPending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      if (initial) {
        await updateUser(initial.id, { name, email, role, color })
      } else {
        const fd = new FormData()
        fd.set('name', name); fd.set('email', email)
        fd.set('role', role); fd.set('color', color)
        await createUser(fd)
      }
      onDone()
    })
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
      <h3 className="font-semibold text-zinc-900">{initial ? 'Edit User' : 'Add User'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Full Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Email *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white">
            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Avatar Color</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-1 ring-zinc-700 scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <div className="flex items-center gap-2 text-sm text-zinc-500 mr-auto">
          <Avatar user={{ name: name || 'Preview', color }} size="sm" />
          <span>{name || 'Preview'}</span>
        </div>
        <button onClick={onDone} className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button onClick={submit} disabled={isPending || !name || !email}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {initial ? 'Save' : 'Add User'}
        </button>
      </div>
    </div>
  )
}

export default function UsersClient({ users: initial }: { users: User[] }) {
  const [users, setUsers] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    if (!confirm('Delete this user? Their tasks will become unassigned.')) return
    startTransition(async () => { await deleteUser(id) })
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage CRM team members who own tasks and segments</p>
        </div>
        <button onClick={() => { setShowAdd(true); setEditingId(null) }}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {showAdd && <div className="mb-4"><UserForm onDone={() => setShowAdd(false)} /></div>}

      {users.length === 0 && !showAdd ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-16 text-center">
          <UserCircle className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
          <p className="font-medium text-zinc-600 mb-1">No users yet</p>
          <p className="text-sm text-zinc-400 mb-4">Add team members to assign tasks and segments</p>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            <Plus className="w-4 h-4" /> Add your first user
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id}>
              {editingId === user.id ? (
                <UserForm initial={user} onDone={() => setEditingId(null)} />
              ) : (
                <div className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-4 group hover:border-zinc-300 transition-colors">
                  <Avatar user={user} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900">{user.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-zinc-500"><Mail className="w-3 h-3" />{user.email}</span>
                      <span className="flex items-center gap-1 text-xs text-zinc-500"><Shield className="w-3 h-3" />{user.role}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingId(user.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(user.id)} disabled={isPending}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
