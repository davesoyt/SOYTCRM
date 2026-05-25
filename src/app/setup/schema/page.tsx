import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { STANDARD_OBJECTS } from '@/lib/objectSchemaShared'
import { Users, Building2, TrendingUp, Box, ChevronRight, Table2 } from 'lucide-react'

const ICONS: Record<string, typeof Users> = {
  contact: Users,
  company: Building2,
  opportunity: TrendingUp,
}

const COLORS: Record<string, string> = {
  contact: 'bg-violet-100 text-violet-600',
  company: 'bg-blue-100 text-blue-600',
  opportunity: 'bg-emerald-100 text-emerald-600',
}

export default async function SchemaIndexPage() {
  const customObjects = await prisma.customObjectDef.findMany({ orderBy: { createdAt: 'asc' } })

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Table2 className="w-5 h-5 text-zinc-500" />
        <h1 className="text-xl font-bold text-zinc-900">Schema Editor</h1>
      </div>
      <p className="text-sm text-zinc-500 mb-8">
        Add, rename, or remove fields. Changes to custom fields update data stored on every record.
      </p>

      <section className="mb-8">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Standard objects</p>
        <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
          {STANDARD_OBJECTS.map(({ slug, label }) => {
            const Icon = ICONS[slug] ?? Box
            return (
              <Link
                key={slug}
                href={`/setup/schema/${slug}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors group"
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${COLORS[slug] ?? 'bg-zinc-100 text-zinc-600'}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{label}</p>
                  <p className="text-xs text-zinc-400">Edit fields &amp; labels</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500" />
              </Link>
            )
          })}
        </div>
      </section>

      {customObjects.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Custom objects</p>
          <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
            {customObjects.map((obj) => (
              <Link
                key={obj.id}
                href={`/setup/schema/${obj.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-zinc-100 text-zinc-600">
                  <Box className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{obj.pluralName}</p>
                  <p className="text-xs text-zinc-400">/{obj.slug}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
