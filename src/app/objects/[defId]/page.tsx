import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Box, Settings } from 'lucide-react'
import NewRecordButton from './NewRecordButton'
import CustomObjectListClient from './CustomObjectListClient'

export const dynamic = 'force-dynamic'

export default async function CustomObjectListPage({ params }: { params: Promise<{ defId: string }> }) {
  const { defId } = await params
  const obj = await prisma.customObjectDef.findUnique({
    where: { id: defId },
    include: {
      fields: { where: { hidden: false }, orderBy: { order: 'asc' } },
      records: { orderBy: { createdAt: 'desc' }, take: 500 },
    },
  })
  if (!obj) notFound()

  const records = obj.records.map((record) => {
    let data: Record<string, string> = {}
    try { data = JSON.parse(record.data) } catch { /* */ }
    return { id: record.id, createdAt: record.createdAt.toISOString(), data }
  })

  const fields = obj.fields.map((f) => ({
    key: f.key,
    label: f.label,
    fieldType: f.fieldType,
    isPrimary: f.isPrimary,
  }))

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{obj.pluralName}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{records.length} records</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/setup/objects/${obj.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors"
          >
            <Settings className="w-4 h-4" /> Fields
          </Link>
          <NewRecordButton
            defId={obj.id}
            fields={obj.fields.map((f) => ({
              key: f.key,
              label: f.label,
              fieldType: f.fieldType,
              selectOptions: JSON.parse(f.selectOptions || '[]'),
            }))}
          />
        </div>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <Box className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No records yet.</p>
        </div>
      ) : (
        <CustomObjectListClient defId={defId} records={records} fields={fields} />
      )}
    </div>
  )
}
