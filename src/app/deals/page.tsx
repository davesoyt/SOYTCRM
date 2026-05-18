import { prisma } from '@/lib/prisma'
import { createDeal, ensureDefaultPipeline } from '@/app/actions'
import DealsView from './DealsView'
import DeleteAllButton from '@/components/DeleteAllButton'

export const dynamic = 'force-dynamic'

export type PipelineStage = {
  key: string
  label: string
  order: number
  isClosedWon?: boolean
  isClosedLost?: boolean
}

export type PipelineDTO = {
  id: string
  name: string
  isDefault: boolean
  order: number
  stages: PipelineStage[]
  dealCount: number
}

export default async function DealsPage() {
  // Ensure default pipeline exists and all deals are assigned
  await ensureDefaultPipeline()

  const [deals, contacts, pipelinesRaw] = await Promise.all([
    prisma.deal.findMany({
      include: { contact: true, company: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.contact.findMany({ orderBy: { firstName: 'asc' } }),
    prisma.pipeline.findMany({
      orderBy: [{ isDefault: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { deals: true } } },
    }),
  ])

  const pipelines: PipelineDTO[] = pipelinesRaw.map(p => {
    let stages: PipelineStage[] = []
    try { stages = JSON.parse(p.stages) } catch { stages = [] }
    stages.sort((a, b) => a.order - b.order)
    return {
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      order: p.order,
      stages,
      dealCount: p._count.deals,
    }
  })

  const totalPipeline = deals
    .filter((d) => d.stage !== 'Closed Lost' && d.stage !== 'Closed Won')
    .reduce((sum, d) => sum + d.value, 0)
  const wonValue = deals
    .filter((d) => d.stage === 'Closed Won')
    .reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Pipeline</h1>
        <div className="flex items-center gap-4">
          <div className="flex gap-4 text-sm text-zinc-600">
            <span>Pipeline: <strong className="text-zinc-900">${totalPipeline.toLocaleString()}</strong></span>
            <span>Won: <strong className="text-green-700">${wonValue.toLocaleString()}</strong></span>
          </div>
          <DeleteAllButton target="deals" count={deals.length} />
        </div>
      </div>

      {/* New Deal Form */}
      <details className="mb-6 bg-white rounded-xl border border-zinc-200">
        <summary className="px-5 py-3 font-medium text-sm cursor-pointer select-none">+ New Deal</summary>
        <form action={createDeal} className="px-5 pb-5 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Deal Name</label>
            <input name="name" required className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Value ($)</label>
            <input name="value" type="number" min="0" step="100" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Stage</label>
            <select name="stage" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
              {(pipelines.find(p => p.isDefault)?.stages ?? []).map((s) => (
                <option key={s.key} value={s.label}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Contact</label>
            <select name="contactId" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
              <option value="">— None —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
              Create Deal
            </button>
          </div>
        </form>
      </details>

      <DealsView
        pipelines={pipelines}
        deals={deals.map(d => ({
          id: d.id,
          name: d.name,
          value: d.value,
          stage: d.stage,
          pipelineId: d.pipelineId,
          createdAt: d.createdAt.toISOString(),
          contactName: d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : null,
          companyName: d.company?.name ?? null,
        }))}
      />
    </div>
  )
}
