'use client'

import { useActionState } from 'react'
import { enrollContact } from '@/app/actions'
import type { Sequence } from '../../../generated/prisma/client'

export default function EnrollForm({ contactId, sequences }: { contactId: string; sequences: Sequence[] }) {
  const [, action, pending] = useActionState(async (_: unknown, formData: FormData) => {
    await enrollContact(formData)
    return null
  }, null)

  if (!sequences.length) return <p className="text-sm text-zinc-400">No sequences yet.</p>

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="contactId" value={contactId} />
      <select name="sequenceId" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
        {sequences.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Enrolling…' : 'Enroll in Sequence'}
      </button>
    </form>
  )
}
