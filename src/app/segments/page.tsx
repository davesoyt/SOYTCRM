import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Plus, Filter, Box } from 'lucide-react'
import { parseObjectTypes, type SegmentFilter } from '@/lib/filters'
import { buildObjectTypeMeta, getObjectTypeLabel, resolveIcon } from '@/lib/segmentObjects'
import SegmentDeleteButton from './SegmentDeleteButton'

export default async function SegmentsPage() {
  const [segments, customObjects] = await Promise.all([
    prisma.segment.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.customObjectDef.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, pluralName: true, icon: true, color: true },
    }),
  ])
  const objectTypeMeta = buildObjectTypeMeta(customObjects)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Segments</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Saved lists with dynamic filters across contacts, companies, pipeline, and custom objects
          </p>
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
          <p className="text-sm text-zinc-400 mb-4">Create a segment to define a filtered list across any object type</p>
          <Link href="/segments/new" className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
            <Plus className="w-4 h-4" /> New Segment
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map(seg => {
            let filters: SegmentFilter[] = []
            try { filters = JSON.parse(seg.filtersJson) } catch {}
            const objectTypes = parseObjectTypes(seg)
            return (
              <Link
                key={seg.id}
                href={`/segments/${seg.id}`}
                className="bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-400 transition-colors block group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex flex-wrap gap-1">
                    {objectTypes.map(t => {
                      const badge = objectTypeMeta[t]
                      if (!badge) {
                        return (
                          <div key={t} className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center" title={t}>
                            <Box className="w-4 h-4 text-zinc-500" />
                          </div>
                        )
                      }
                      const Icon = resolveIcon(badge.iconName)
                      return (
                        <div key={t} className={`w-8 h-8 rounded-lg ${badge.bg} flex items-center justify-center`} title={badge.label}>
                          <Icon className={`w-4 h-4 ${badge.color}`} />
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap gap-1 justify-end">
                      {objectTypes.map(t => {
                        const badge = objectTypeMeta[t]
                        return (
                          <span
                            key={t}
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge?.bg ?? 'bg-zinc-100'} ${badge?.color ?? 'text-zinc-600'}`}
                          >
                            {getObjectTypeLabel(t, objectTypeMeta)}
                          </span>
                        )
                      })}
                    </div>
                    <span className="text-xs text-zinc-400 whitespace-nowrap">{filters.length} filter{filters.length !== 1 ? 's' : ''}</span>
                    <SegmentDeleteButton segmentId={seg.id} segmentName={seg.name} />
                  </div>
                </div>
                <p className="font-semibold text-zinc-900 group-hover:underline">{seg.name}</p>
                {seg.description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{seg.description}</p>}
                {filters.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {filters.slice(0, 3).map(f => {
                      const typeLabel = f.objectType
                        ? getObjectTypeLabel(f.objectType, objectTypeMeta)
                        : ''
                      return (
                        <span key={f.id} className="text-xs bg-zinc-50 text-zinc-600 px-2 py-0.5 rounded-full border border-zinc-200">
                          {typeLabel ? `${typeLabel}: ` : ''}{f.field}
                        </span>
                      )
                    })}
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
