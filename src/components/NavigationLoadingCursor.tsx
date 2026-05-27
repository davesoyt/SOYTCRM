'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const ROUTE_LOADING_CLASS = 'route-loading-cursor'
const CURSOR_DELAY_MS = 150

export default function NavigationLoadingCursor() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const timerRef = useRef<number | null>(null)

  function clearPendingTimer() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function clearLoadingCursor() {
    document.documentElement.classList.remove(ROUTE_LOADING_CLASS)
  }

  useEffect(() => {
    clearPendingTimer()
    clearLoadingCursor()
  }, [pathname, searchParams])

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      const nextUrl = new URL(anchor.href, window.location.href)
      if (nextUrl.origin !== window.location.origin) return

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      if (next === current) return

      clearPendingTimer()
      timerRef.current = window.setTimeout(() => {
        document.documentElement.classList.add(ROUTE_LOADING_CLASS)
      }, CURSOR_DELAY_MS)
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => {
      document.removeEventListener('click', handleDocumentClick, true)
      clearPendingTimer()
      clearLoadingCursor()
    }
  }, [])

  return null
}
