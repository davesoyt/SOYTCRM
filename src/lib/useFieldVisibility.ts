'use client'

import { useState, useEffect } from 'react'

export function useFieldVisibility(storageKey: string, defaults: Record<string, boolean>) {
  const [fields, setFields] = useState<Record<string, boolean>>(defaults)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`fieldVisibility:${storageKey}`)
      if (raw) setFields({ ...defaults, ...JSON.parse(raw) })
    } catch {}
    setLoaded(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  function toggle(field: string) {
    setFields(prev => {
      const next = { ...prev, [field]: !prev[field] }
      try { localStorage.setItem(`fieldVisibility:${storageKey}`, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function reset() {
    setFields(defaults)
    try { localStorage.removeItem(`fieldVisibility:${storageKey}`) } catch {}
  }

  return { fields, toggle, reset, loaded }
}
