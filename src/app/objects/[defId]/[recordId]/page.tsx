import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'
import RecordDetailClient from './RecordDetailClient'

export const dynamic = 'force-dynamic'

export default async function CustomObjectRecordPage({
  params,
}: {
  params: Promise<{ defId: string; recordId: string }>
}) {
  const { defId, recordId } = await params
  const [obj, record] = await Promise.all([
    prisma.customObjectDef.findUnique({
      where: { id: defId },
      include: { fields: { orderBy: { order: 'asc' } } },
    }),
    prisma.customObjectRecord.findUnique({ where: { id: recordId } }),
  ])
  if (!obj || !record) notFound()

  let data: Record<string, string> = {}
  try { data = JSON.parse(record.data) } catch { /* */ }

  const fields = obj.fields.map(f => ({
    key: f.key,
    label: f.label,
    fieldType: f.fieldType,
    selectOptions: JSON.parse(f.selectOptions || '[]') as string[],
  }))

  const primaryField = fields.find(f => f.fieldType === 'text') ?? fields[0]
  const displayName = primaryField ? (data[primaryField.key] || '—') : record.id.slice(0, 8)

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/objects/${defId}`} className="text-zinc-400 hover:text-zinc-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <p className="text-xs text-zinc-400">{obj.pluralName}</p>
          <h1 className="text-xl font-bold text-zinc-900">{displayName}</h1>
        </div>
      </div>
      <RecordDetailClient
        defId={defId}
        recordId={recordId}
        fields={fields}
        initialData={data}
      />
    </div>
  )
}
