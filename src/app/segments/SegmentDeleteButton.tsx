'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteSegment } from '@/app/actions'

export default function SegmentDeleteButton({
  segmentId,
  segmentName,
}: {
  segmentId: string
  segmentName: string
}) {
  const [isPending, startTransition] = useTransition()

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete segment "${segmentName}"? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteSegment(segmentId)
    })
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
      title="Delete segment"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
