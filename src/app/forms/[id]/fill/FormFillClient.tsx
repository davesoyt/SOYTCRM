'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { submitFormFromTask } from '@/app/actions'
import type { FormField, FormSection } from '@/lib/formLayout'
import { fieldValueKey } from '@/lib/formLayout'

type Props = {
  formId: string
  formName: string
  formDescription: string | null
  sections: FormSection[]
  taskId: string | null
  taskStatus: string | null
  initialValues: Record<string, string>
}

function inputTypeForField(field: FormField): string {
  if (field.fieldKey === 'email') return 'email'
  if (field.fieldKey === 'phone') return 'tel'
  if (field.fieldKey === 'website' || field.fieldKey === 'linkedin') return 'url'
  if (field.fieldKey === 'leadScore' || field.fieldKey === 'value') return 'number'
  if (['dueDate', 'closedAt', 'createdAt'].includes(field.fieldKey)) return 'date'
  return 'text'
}

function isTextareaField(field: FormField): boolean {
  return ['description', 'message', 'notes'].includes(field.fieldKey)
}

function isCheckboxField(field: FormField): boolean {
  return field.fieldKey === 'enriched'
}

export default function FormFillClient({
  formId,
  formName,
  formDescription,
  sections,
  taskId,
  taskStatus,
  initialValues,
}: Props) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(taskStatus === 'done')
  const [isPending, startTransition] = useTransition()

  function setField(field: FormField, value: string) {
    setValues(prev => ({ ...prev, [fieldValueKey(field)]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!taskId) {
      setError('This form must be opened from a task to submit.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await submitFormFromTask(taskId, formId, values)
        setSubmitted(true)
        setTimeout(() => router.push('/tasks'), 1200)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit form')
      }
    })
  }

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-600 mb-3" />
        <p className="text-lg font-semibold text-zinc-900">Form submitted</p>
        <p className="text-sm text-zinc-500 mt-1">Task marked complete. Returning to tasks…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {formDescription && (
          <p className="text-sm text-zinc-500 mb-6">{formDescription}</p>
        )}

        {sections.length === 0 ? (
          <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center text-zinc-400">
            This form has no fields yet.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {sections.map(section => (
              <div key={section.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                  {section.label}
                </div>
                <div className="p-4 space-y-4">
                  {section.rows.map(row => {
                    const cols = row.columns.filter(Boolean) as FormField[]
                    const colCount = cols.length || 1
                    return (
                      <div
                        key={row.id}
                        className="grid gap-4"
                        style={{
                          gridTemplateColumns:
                            colCount === 3 ? 'repeat(3, 1fr)' : colCount === 2 ? 'repeat(2, 1fr)' : '1fr',
                        }}
                      >
                        {cols.map(field => {
                          const key = fieldValueKey(field)
                          const val = values[key] ?? ''

                          if (isCheckboxField(field)) {
                            return (
                              <label key={field.id} className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={val === 'true'}
                                  onChange={e => setField(field, e.target.checked ? 'true' : 'false')}
                                  className="w-4 h-4 accent-violet-600"
                                />
                                {field.label}
                                {field.required && <span className="text-red-500">*</span>}
                              </label>
                            )
                          }

                          if (isTextareaField(field)) {
                            return (
                              <div key={field.id}>
                                <label className="block text-xs font-medium text-zinc-700 mb-1">
                                  {field.label}
                                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                </label>
                                <textarea
                                  value={val}
                                  onChange={e => setField(field, e.target.value)}
                                  required={field.required}
                                  placeholder={field.placeholder}
                                  rows={3}
                                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 resize-y"
                                />
                              </div>
                            )
                          }

                          return (
                            <div key={field.id}>
                              <label className="block text-xs font-medium text-zinc-700 mb-1">
                                {field.label}
                                {field.required && <span className="text-red-500 ml-0.5">*</span>}
                              </label>
                              <input
                                type={inputTypeForField(field)}
                                value={val}
                                onChange={e => setField(field, e.target.value)}
                                required={field.required}
                                placeholder={field.placeholder}
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                              />
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isPending || !taskId}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Submit & complete task
              </button>
              <button
                type="button"
                onClick={() => router.push('/tasks')}
                className="text-sm text-zinc-500 hover:text-zinc-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
