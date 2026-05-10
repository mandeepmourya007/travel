'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useLoadingStore } from '@/store/loading.store'

/**
 * Dismisses the FullScreenLoader whenever the route changes.
 * Mounted once in Providers to auto-clear auth transition overlays (login/logout).
 */
export function DismissLoader() {
  const pathname = usePathname()
  const hide = useLoadingStore((s) => s.hide)
  useEffect(() => { hide() }, [pathname, hide])
  return null
}
