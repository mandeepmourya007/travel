'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Thin animated progress bar at the top of the viewport.
 *
 * - **Start**: Global click listener detects `<a>` with internal href
 *   different from the current path.
 * - **Complete**: `usePathname()` change → fill to 100% → fade out.
 * - **Safety**: Auto-completes after 5 s if navigation stalls.
 *
 * Matches the design system preview (gradient-primary, 3 px, z-[9999]).
 */
export function RouteProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRunningRef = useRef(false)
  const prevPathRef = useRef(pathname)

  const clearAllTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current)
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current)
  }, [])

  const start = useCallback(() => {
    if (isRunningRef.current) return
    isRunningRef.current = true
    clearAllTimers()

    setProgress(0)
    setVisible(true)

    // Animate towards 80 % in random increments
    let p = 0
    intervalRef.current = setInterval(() => {
      p += 5 + Math.random() * 10
      if (p >= 80) {
        p = 80
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
      setProgress(p)
    }, 200)

    // Safety: auto-complete after 5 s
    safetyTimeoutRef.current = setTimeout(() => complete(), 5000)
  }, [clearAllTimers])

  const complete = useCallback(() => {
    clearAllTimers()
    isRunningRef.current = false
    setProgress(100)

    fadeTimeoutRef.current = setTimeout(() => setVisible(false), 300)
    resetTimeoutRef.current = setTimeout(() => setProgress(0), 600)
  }, [clearAllTimers])

  // Detect navigation completion via pathname change
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname
      if (isRunningRef.current) {
        complete()
      }
    }
  }, [pathname, complete])

  // Global click listener: detect internal link clicks
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (
        !href ||
        href.startsWith('http') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        anchor.getAttribute('target') === '_blank'
      ) {
        return
      }

      // Skip same-page navigation
      try {
        const url = new URL(href, window.location.origin)
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return
        }
      } catch {
        return
      }

      start()
    }

    document.addEventListener('click', handleClick, { capture: true })
    return () => document.removeEventListener('click', handleClick, { capture: true })
  }, [start])

  // Cleanup on unmount
  useEffect(() => () => clearAllTimers(), [clearAllTimers])

  if (!visible && progress === 0) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-full rounded-r-full bg-gradient-to-r from-primary-500 to-highlight-500 transition-[width] duration-[400ms] ease-out"
        style={{
          width: `${progress}%`,
          boxShadow: '0 0 8px rgba(15, 186, 181, 0.4)',
        }}
      />
    </div>
  )
}
