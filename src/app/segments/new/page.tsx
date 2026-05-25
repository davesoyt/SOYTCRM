import { prisma } from '@/lib/prisma'
import NewSegmentForm from './NewSegmentForm'

export default async function NewSegmentPage() {
  const customObjects = await prisma.customObjectDef.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, pluralName: true, icon: true, color: true },
  })

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">New Segment</h1>
      <p className="text-zinc-500 text-sm mb-6">
        Select one or more object types (standard and custom), then build filters for each.
        Records from all selected types appear in one segment.
      </p>
      <NewSegmentForm customObjects={customObjects} />
    </div>
  )
}
