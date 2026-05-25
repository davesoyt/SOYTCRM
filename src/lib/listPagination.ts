export const LIST_PAGE_SIZE = 50

export function parseListPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const n = Number.parseInt(raw ?? '1', 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

export function parseListQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  return (raw ?? '').trim()
}

export function listPageCount(total: number, pageSize = LIST_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function listOffset(page: number, pageSize = LIST_PAGE_SIZE): number {
  return (page - 1) * pageSize
}
