'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { X, Play, ClipboardList, ListChecks, Users, Loader2, CheckCircle2 } from 'lucide-react'
import { executeSegmentWorkflow, getWorkflowExecutionPreview } from '@/app/actions'
import type { FormAssignmentMode } from '@/lib/workflowExecution'

type Preview = Awaited<ReturnType<typeof getWorkflowExecutionPreview>>

type Props = {
  open: boolean
  onClose: () => void
  linkId: string | null
  title?: string
  onExecuted?: (
    result: { enrolled: number; total: number; tasksCreated: number; formsAssigned: number },
    linkId: string,
  ) => void
}

export default function ExecuteWorkflowModal({
  open,
  onClose,
  linkId,
  title = 'Configure workflow',
  onExecuted,
}: Props) {
  const [step, setStep] = useState<'options' | 'done'>('options')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [formMode, setFormMode] = useState<FormAssignmentMode>('per_record')
  const [result, setResult] = useState<{ enrolled: number; total: number; tasksCreated: number; formsAssigned: number } | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || !linkId) return
    setStep('options')
    setResult(null)
    setFormMode('per_record')
    setLoadingPreview(true)
    getWorkflowExecutionPreview(linkId)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setLoadingPreview(false))
  }, [open, linkId])

  if (!open || !linkId) return null

  function handleExecute() {
    const id = linkId!
    startTransition(async () => {
      const res = await executeSegmentWorkflow(id, { formMode })
      setResult(res)
      setStep('done')
      onExecuted?.(res, id)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              {step === 'done' ? 'Workflow executed' : title}
            </h2>
            {preview && step !== 'done' && (
              <p className="text-xs text-zinc-500 mt-0.5">
                {preview.workflowName} → {preview.segmentName}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {loadingPreview && (
            <div className="flex items-center justify-center py-10 text-zinc-400 gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}

          {!loadingPreview && step === 'options' && preview && (
            <div className="space-y-4">
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <Users className="w-4 h-4 text-violet-600 shrink-0" />
                  <span>
                    <strong>{preview.recordCount}</strong> record{preview.recordCount !== 1 ? 's' : ''} from this segment
                    {preview.recordSummary ? ` (${preview.recordSummary})` : ''}
                  </span>
                </div>
                {preview.contactCount > 0 && (
                  <p className="text-xs text-zinc-500 pl-6">
                    {preview.contactCount} contact{preview.contactCount !== 1 ? 's' : ''} will be enrolled in the workflow
                  </p>
                )}
                {preview.taskNodeCount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <ListChecks className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{preview.taskNodeCount} task step{preview.taskNodeCount !== 1 ? 's' : ''} — one task per record</span>
                  </div>
                )}
                {preview.formNodes.length > 0 && (
                  <div className="flex items-start gap-2 text-sm text-zinc-600">
                    <ClipboardList className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>
                      Form{preview.formNodes.length !== 1 ? 's' : ''}:{' '}
                      {preview.formNodes.map(f => f.label).join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {preview.formNodes.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Form assignment</p>
                  <div className="space-y-2">
                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${formMode === 'per_record' ? 'border-violet-400 bg-violet-50' : 'border-zinc-200 hover:border-zinc-300'}`}>
                      <input
                        type="radio"
                        name="formMode"
                        checked={formMode === 'per_record'}
                        onChange={() => setFormMode('per_record')}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-medium text-zinc-900">One form per record</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Creates {preview.recordCount} task{preview.recordCount !== 1 ? 's' : ''} — one per record on this list
                        </p>
                      </div>
                    </label>
                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${formMode === 'per_segment' ? 'border-violet-400 bg-violet-50' : 'border-zinc-200 hover:border-zinc-300'}`}>
                      <input
                        type="radio"
                        name="formMode"
                        checked={formMode === 'per_segment'}
                        onChange={() => setFormMode('per_segment')}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-medium text-zinc-900">One form for the entire segment</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Creates 1 task for the whole list ({preview.recordCount} records)
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  This workflow has no form steps. Click <strong>Run workflow</strong> to run actions on all segment records.
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecute}
                  disabled={isPending || preview.recordCount === 0}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {isPending ? 'Running…' : 'Run workflow'}
                </button>
              </div>
              {preview.recordCount === 0 && (
                <p className="text-xs text-amber-600 text-center">No records in this segment list.</p>
              )}
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-4 text-center py-2">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
              <div>
                <p className="text-sm font-medium text-zinc-900">Workflow run complete</p>
                <p className="text-sm text-zinc-500 mt-1">
                  Processed {result.total} record{result.total !== 1 ? 's' : ''}
                  {result.enrolled > 0 && ` · ${result.enrolled} contact${result.enrolled !== 1 ? 's' : ''} enrolled`}
                </p>
                {(result.tasksCreated > 0 || result.formsAssigned > 0) && (
                  <p className="text-xs text-zinc-400 mt-1">
                    {result.tasksCreated > 0 && `${result.tasksCreated} task${result.tasksCreated !== 1 ? 's' : ''}`}
                    {result.tasksCreated > 0 && result.formsAssigned > 0 && ' · '}
                    {result.formsAssigned > 0 && `${result.formsAssigned} form assignment${result.formsAssigned !== 1 ? 's' : ''}`}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Link
                  href="/sequences/history"
                  className="flex-1 rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 text-center"
                >
                  View history
                </Link>
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
