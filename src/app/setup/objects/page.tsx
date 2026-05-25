import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Users, Building2, TrendingUp, Box, ChevronRight } from 'lucide-react'
import NewObjectButton from './NewObjectButton'

const STANDARD_OBJECTS = [
  { slug: 'contact', label: 'Contacts', icon: Users, color: 'bg-violet-100 text-violet-600', desc: 'People in your CRM' },
  { slug: 'company', label: 'Companies', icon: Building2, color: 'bg-blue-100 text-blue-600', desc: 'Organizations you work with' },
  { slug: 'opportunity', label: 'Opportunities', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-600', desc: 'Opportunities in your pipeline' },
]

export default async function ObjectsPage() {
  const customObjects = await prisma.customObjectDef.findMany({ orderBy: { createdAt: 'asc' } })

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-zinc-900">Objects &amp; Fields</h1>
        <NewObjectButton />
      </div>
      <p className="text-sm text-zinc-500 mb-8">
        Define fields for standard and custom objects.{' '}
        <Link href="/setup/schema" className="text-zinc-900 underline">
          Open Schema Editor
        </Link>{' '}
        to add, rename, or remove fields with data migration.
      </p>

      <section className="mb-8">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Standard Objects</p>
        <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
          {STANDARD_OBJECTS.map(({ slug, label, icon: Icon, color, desc }) => (
            <Link key={slug} href={`/setup/objects/${slug}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors group">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900">{label}</p>
                <p className="text-xs text-zinc-400">{desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
            </Link>
          ))}
        </div>
      </section>

      {customObjects.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Custom Objects</p>
          <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
            {customObjects.map(obj => (
              <Link key={obj.id} href={`/setup/objects/${obj.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors group">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-zinc-100 text-zinc-600">
                  <Box className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{obj.pluralName}</p>
                  <p className="text-xs text-zinc-400">Custom object · /{obj.slug}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
