'use client'

import { usePathname } from 'next/navigation'

/**
 * Wraps page content with a fade + slide-up entrance animation.
 *
 * Uses `key={pathname}` to re-trigger the CSS animation whenever the
 * route changes.  The animation is defined in globals.css as
 * `animate-page-enter` (opacity 0→1, translateY 12→0, 350 ms).
 *
 * Place this in the root layout so every child page gets the
 * transition automatically — no per-page changes needed.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div key={pathname} className="animate-page-enter">
      {children}
    </div>
  )
}
