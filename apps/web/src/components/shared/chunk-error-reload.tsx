'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { feLogger } from '@/lib/logger'

/** sessionStorage guard key — ensures we reload at most once per incident, never loop. */
const CHUNK_RELOAD_FLAG = 'chunk-error-reloaded'
/** How long a reload must stay stable before a future stale-chunk incident is allowed to self-heal again. */
const CHUNK_RELOAD_GUARD_RESET_MS = 5000

/** Webpack-specific signal required to trust the generic "reading 'call'" TypeError as a stale-chunk symptom. */
const WEBPACK_STACK_SIGNATURE = /__webpack_require__|\/_next\/static\/chunks\//

function isStaleChunkError(reason: unknown): boolean {
  if (!(reason instanceof Error)) return false
  const { message, stack } = reason
  if (!message) return false

  if (/Loading chunk [\d]+ failed/i.test(message) || /ChunkLoadError/i.test(message)) {
    return true
  }

  // This message is a generic JS TypeError any unrelated bug can throw, so only treat it
  // as a stale-chunk symptom when the stack also points at webpack's module loader.
  if (/Cannot read properties of undefined \(reading 'call'\)/i.test(message)) {
    return WEBPACK_STACK_SIGNATURE.test(stack ?? '')
  }

  return false
}

/**
 * Recovers from stale webpack chunks after a deploy.
 *
 * If a client tab stays open across a release, client-side navigation can fetch a
 * new route's RSC/chunk payload while the tab is still running the previous build's
 * webpack runtime. The old runtime's module map doesn't contain the new chunk's
 * module IDs, so `__webpack_require__` calls an undefined factory — surfacing as an
 * unhandled promise rejection: "Cannot read properties of undefined (reading 'call')"
 * (see Sentry WEB-NEXTJS-1, apps/web transaction /dashboard). This never reaches
 * error.tsx/global-error.tsx because it's a rejected promise, not a render-time throw.
 *
 * A hard reload re-fetches the current build's HTML/JS and resolves it. Guarded by
 * sessionStorage so a real, persistent bug can't reload-loop the user.
 */
export function ChunkErrorReload() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const resetTimer = setTimeout(() => sessionStorage.removeItem(CHUNK_RELOAD_FLAG), CHUNK_RELOAD_GUARD_RESET_MS)

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (!isStaleChunkError(event.reason)) return
      const message = (event.reason as Error).message

      if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
        feLogger.error('Stale chunk error persisted after reload', { message })
        return
      }

      // An unrelated chunk failing to load must never abort a request the user is actively
      // submitting (e.g. Request to Book) — defer the reload rather than cancel it in-flight.
      if (queryClient.isMutating() > 0) {
        feLogger.warn('Stale webpack chunk detected during an in-flight mutation, deferring reload', { message })
        return
      }

      sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1')
      feLogger.warn('Stale webpack chunk detected after deploy, reloading', { message })
      window.location.reload()
    }

    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      clearTimeout(resetTimer)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [queryClient])

  return null
}
