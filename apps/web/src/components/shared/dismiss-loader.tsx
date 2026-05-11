'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useLoadingStore } from '@/store/loading.store'

/**
 * Dismisses the FullScreenLoader whenever the route changes.
 * Mounted once in Providers to auto-clear auth transition overlays (login/logout).
 * Uses requestAnimationFrame so the new page paints before the overlay is removed.
 */
export function DismissLoader() {
  const pathname = usePathname()
  const hide = useLoadingStore((s) => s.hide)
  useEffect(() => {
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => hide(true))
    })
    let inner = 0
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner) }
  }, [pathname, hide])
  return null
}
