import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Plus, Users, Building2, TrendingUp, Filter } from 'lucide-react'
import type { SegmentFilter } from '@/lib/filters'

const OBJECT_BADGE: Record<string, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  contact: { label: 'Contacts', Icon: Users,      color: 'text-violet-700', bg: 'bg-violet-100' },
  company: { label: 'Companies', Icon: Building2, color: 'text-blue-700',   bg: 'bg-blue-100'   },
  deal:    { label: 'Deals',     Icon: TrendingUp, color: 'text-emerald-700', bg: 'bg-emerald-100' },
}

export default async function SegmentsPage() {
  const segments = await prisma.segment.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Segments</h1>
          <p className="text-sm text-zinc-500 mt-1">Saved lists with dynamic filters across any object</p>
        </div>
        <Link
          href="/segments/new"
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Segment
        </Link>
      </div>

      {segments.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-16 text-center">
          <Filter className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
          <p className="font-medium text-zinc-600 mb-1">No segments yet</p>
          <p className="text-sm text-zinc-400 mb-4">Create a segment to define a filtered list of contacts, companies, or deals</p>
          <Link href="/segments/new" className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
            <Plus className="w-4 h-4" /> New Segment
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map(seg => {
            let filters: SegmentFilter[] = []
            try { filters = JSON.parse(seg.filtersJson) } catch {}
            const badge = OBJECT_BADGE[seg.objectType] ?? OBJECT_BADGE.contact
            return (
              <Link
                key={seg.id}
                href={`/segments/${seg.id}`}
                className="bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-400 transition-colors block group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg ${badge.bg} flex items-center justify-center`}>
                    <badge.Icon className={`w-4 h-4 ${badge.color}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.bg} ${badge.color}`}>{badge.label}</span>
                    <span className="text-xs text-zinc-400">{filters.length} filter{filters.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <p className="font-semibold text-zinc-900 group-hover:underline">{seg.name}</p>
                {seg.description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{seg.description}</p>}
                {filters.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {filters.slice(0, 3).map(f => (
                      <span key={f.id} className="text-xs bg-zinc-50 text-zinc-600 px-2 py-0.5 rounded-full border border-zinc-200">
                        {f.field}
                      </span>
                    ))}
                    {filters.length > 3 && (
                      <span className="text-xs text-zinc-400 px-1">+{filters.length - 3} more</span>
                    )}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
