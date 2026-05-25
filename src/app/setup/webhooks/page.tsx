import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Webhook, ChevronRight } from 'lucide-react'
import NewWebhookButton from './NewWebhookButton'

export default async function WebhooksPage() {
  const integrations = await prisma.webhookIntegration.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-zinc-500" />
          <h1 className="text-xl font-bold text-zinc-900">Webhooks</h1>
        </div>
        <NewWebhookButton />
      </div>
      <p className="text-sm text-zinc-500 mb-8">
        Connect Stripe to create or update object records using field mappings you define below.
      </p>

      {integrations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-zinc-700">No webhooks configured</p>
          <p className="text-xs text-zinc-400 mt-1 mb-4">
            Create a webhook, map Stripe fields to your object, then paste the URL into Stripe.
          </p>
          <NewWebhookButton variant="primary" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
          {integrations.map((w) => (
            <Link
              key={w.id}
              href={`/setup/webhooks/${w.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors group"
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  w.enabled ? 'bg-violet-100 text-violet-600' : 'bg-zinc-100 text-zinc-400'
                }`}
              >
                <Webhook className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900">{w.name}</p>
                <p className="text-xs text-zinc-400 capitalize">
                  {w.provider} → {w.targetSlug}
                  {!w.enabled && ' · disabled'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
