'use client'

import { useState, useLayoutEffect, useMemo } from 'react'

export type ListColumnDef = {
  key: string
  label: string
  defaultVisible?: boolean
  pinned?: boolean
  customizable?: boolean
}

export function buildColumnDefaults(columns: ListColumnDef[]): Record<string, boolean> {
  return Object.fromEntries(
    columns.map((c) => [c.key, c.pinned === true || c.defaultVisible !== false]),
  )
}

/** Stable id for the current set of columns (keys + visibility defaults). Reacts to schema changes. */
function columnsSignature(columns: ListColumnDef[]): string {
  return columns.map((c) => `${c.key}\t${c.pinned ? 1 : 0}\t${c.defaultVisible === false ? 0 : 1}`).join('\n')
}

export function useListColumns(storageKey: string, columns: ListColumnDef[]) {
  const defaults = useMemo(() => buildColumnDefaults(columns), [columns])
  const signature = useMemo(() => columnsSignature(columns), [columns])
  const [visibility, setVisibility] = useState<Record<string, boolean>>(defaults)
  const [loaded, setLoaded] = useState(false)

  useLayoutEffect(() => {
    const merged: Record<string, boolean> = { ...defaults }
    try {
      const raw = localStorage.getItem(`listColumns:${storageKey}`)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>
        for (const col of columns) {
          if (col.pinned) merged[col.key] = true
          else if (parsed[col.key] !== undefined) merged[col.key] = parsed[col.key]
        }
      }
    } catch { /* ignore */ }
    setVisibility(merged)
    setLoaded(true)
  }, [storageKey, signature, columns, defaults])

  const visibleColumns = useMemo(
    () => columns.filter((c) => visibility[c.key] ?? defaults[c.key] ?? true),
    [columns, visibility, defaults],
  )

  function toggle(key: string) {
    const col = columns.find((c) => c.key === key)
    if (col?.pinned) return
    setVisibility((prev) => {
      const next: Record<string, boolean> = {}
      for (const c of columns) {
        const v = prev[c.key] ?? defaults[c.key] ?? true
        next[c.key] = c.key === key ? !v : v
      }
      try {
        localStorage.setItem(`listColumns:${storageKey}`, JSON.stringify(next))
      } catch { /* ignore */ }
      return next
    })
  }

  function reset() {
    setVisibility(defaults)
    try { localStorage.removeItem(`listColumns:${storageKey}`) } catch { /* ignore */ }
  }

  return { visibility, visibleColumns, toggle, reset, loaded, defaults }
}
