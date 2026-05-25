import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { loadSchemaFields } from '@/lib/objectSchema'
import SchemaEditor from '../SchemaEditor'

export default async function SchemaObjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let data
  try {
    data = await loadSchemaFields(slug)
  } catch {
    notFound()
  }

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href="/setup/schema"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Schema Editor
      </Link>
      <h1 className="text-xl font-bold text-zinc-900 mb-6">{data.label} schema</h1>
      <SchemaEditor
        objectType={data.objectType}
        customObjectDefId={data.customObjectDefId}
        fields={data.fields}
      />
    </div>
  )
}
