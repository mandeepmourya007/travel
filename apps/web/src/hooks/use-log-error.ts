'use client'

import { useEffect } from 'react'
import { feLogger } from '@/lib/logger'

/** Logs an error once when a route error boundary catches. */
export function useLogError(error: Error & { digest?: string }) {
  useEffect(() => {
    feLogger.error('Unhandled route error', {
      message: error.message,
      digest: error.digest,
      pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
    })
  }, [error])
}
