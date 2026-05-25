/** True when the task was created by a workflow form step. */
export function isFillFormTask(task: { title: string }): boolean {
  return task.title.startsWith('Fill form:')
}

/** Extract form id from task description (`/forms/{id}`) or title fallback. */
export function parseFormIdFromTask(task: {
  title: string
  description: string | null
}): string | null {
  if (!isFillFormTask(task)) return null
  const fromDesc = task.description?.match(/\/forms\/([a-z0-9]+)/i)?.[1]
  if (fromDesc) return fromDesc
  return null
}

export function formFillUrl(formId: string, taskId?: string): string {
  const base = `/forms/${formId}/fill`
  return taskId ? `${base}?taskId=${encodeURIComponent(taskId)}` : base
}
