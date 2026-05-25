'use client'

import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createWebhookIntegration } from '@/app/actions'

export default function NewWebhookButton({ variant = 'default' }: { variant?: 'default' | 'primary' }) {
  const router = useRouter()

  async function handleCreate() {
    const created = await createWebhookIntegration('Stripe webhook')
    router.push(`/setup/webhooks/${created.id}`)
  }

  if (variant === 'primary') {
    return (
      <button
        type="button"
        onClick={() => void handleCreate()}
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        <Plus className="w-4 h-4" />
        New webhook
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void handleCreate()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
    >
      <Plus className="w-3.5 h-3.5" />
      New webhook
    </button>
  )
}
