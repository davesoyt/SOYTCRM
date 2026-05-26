import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import FieldEditor from './FieldEditor'
import { deleteCustomObjectDef } from '@/app/actions'
import { loadSchemaFields } from '@/lib/objectSchema'
import { Trash2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ObjectFieldsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let data
  try {
    data = await loadSchemaFields(slug)
  } catch {
    notFound()
  }

  if (data.isStandard) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-xl font-bold text-zinc-900 mb-1">{data.label} Fields</h1>
        <p className="text-sm text-zinc-500 mb-8">
          Customize field labels, types, and designate a primary field. For add/remove/rename with data
          migration, use the{' '}
          <a href={`/setup/schema/${slug}`} className="text-zinc-900 underline">
            Schema Editor
          </a>
          .
        </p>
        <FieldEditor
          objectType={data.objectType}
          customObjectDefId={null}
          fields={data.fields}
        />
      </div>
    )
  }

  const obj = await prisma.customObjectDef.findUnique({ where: { id: slug } })
  if (!obj) notFound()

  async function handleDelete() {
    'use server'
    await deleteCustomObjectDef(slug)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">{obj.pluralName} Fields</h1>
          <p className="text-sm text-zinc-500 mt-1 mb-8">
            Define fields and designate a primary field.{' '}
            <a href={`/setup/schema/${slug}`} className="text-zinc-900 underline">
              Open Schema Editor
            </a>
          </p>
        </div>
        <form action={handleDelete}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete Object
          </button>
        </form>
      </div>
      <FieldEditor
        objectType={null}
        customObjectDefId={data.customObjectDefId}
        fields={data.fields}
      />
    </div>
  )
}
