import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Plus, Box, Settings } from 'lucide-react'
import NewRecordButton from './NewRecordButton'

export default async function CustomObjectListPage({ params }: { params: Promise<{ defId: string }> }) {
  const { defId } = await params
  const obj = await prisma.customObjectDef.findUnique({
    where: { id: defId },
    include: {
      fields: { orderBy: { order: 'asc' } },
      records: { orderBy: { createdAt: 'desc' }, take: 100 },
    },
  })
  if (!obj) notFound()

  // Primary display field = first text field, or fallback to record id
  const primaryField = obj.fields.find(f => f.fieldType === 'text') ?? obj.fields[0]

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{obj.pluralName}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{obj.records.length} records</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/setup/objects/${obj.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors">
            <Settings className="w-4 h-4" /> Fields
          </Link>
          <NewRecordButton defId={obj.id} fields={obj.fields.map(f => ({ key: f.key, label: f.label, fieldType: f.fieldType, selectOptions: JSON.parse(f.selectOptions || '[]') }))} />
        </div>
      </div>

      {obj.records.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <Box className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No records yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
          {obj.records.map(record => {
            let data: Record<string, string> = {}
            try { data = JSON.parse(record.data) } catch { /* */ }
            const displayName = primaryField ? (data[primaryField.key] || '—') : record.id.slice(0, 8)
            const subtitle = obj.fields
              .filter(f => f !== primaryField)
              .slice(0, 2)
              .map(f => data[f.key])
              .filter(Boolean)
              .join(' · ')
            return (
              <Link key={record.id} href={`/objects/${defId}/${record.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500 text-sm font-bold shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{displayName}</p>
                  {subtitle && <p className="text-xs text-zinc-400 truncate">{subtitle}</p>}
                </div>
                <p className="text-xs text-zinc-400 shrink-0">{new Date(record.createdAt).toLocaleDateString()}</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
