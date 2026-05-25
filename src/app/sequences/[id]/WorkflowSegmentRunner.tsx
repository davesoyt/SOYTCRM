'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'
import ExecuteWorkflowModal from '@/components/ExecuteWorkflowModal'

type SegmentLink = {
  id: string
  segment: { id: string; name: string }
}

type Props = {
  segmentLinks: SegmentLink[]
}

export default function WorkflowSegmentRunner({ segmentLinks }: Props) {
  const [selectedLinkId, setSelectedLinkId] = useState(segmentLinks[0]?.id ?? '')
  const [modalOpen, setModalOpen] = useState(false)

  if (segmentLinks.length === 0) {
    return (
      <span
        className="text-xs text-zinc-400 italic px-2"
        title="Link this workflow from a segment list to run it on matching contacts"
      >
        No segments linked
      </span>
    )
  }

  return (
    <>
      {segmentLinks.length > 1 && (
        <select
          value={selectedLinkId}
          onChange={e => setSelectedLinkId(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 max-w-[140px]"
        >
          {segmentLinks.map(l => (
            <option key={l.id} value={l.id}>{l.segment.name}</option>
          ))}
        </select>
      )}
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 shadow-sm transition-colors"
        title={segmentLinks.length === 1 ? `Run on ${segmentLinks[0].segment.name}` : 'Run workflow on segment'}
      >
        <Play className="w-4 h-4" />
        Run on Segment
      </button>

      <ExecuteWorkflowModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        linkId={selectedLinkId || null}
        title="Run workflow"
      />
    </>
  )
}
