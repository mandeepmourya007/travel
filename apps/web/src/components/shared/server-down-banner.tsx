'use client'

import { useEffect, useState, useCallback } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import axios from 'axios'
import { useConnectionStore } from '@/store/connection.store'
import { cn } from '@/lib/utils'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api/v1'
const HEALTH_URL = API_BASE.replace(/\/api\/v1$/, '/health')

const HEALTH_CHECK_INTERVAL_MS = 10_000

export function ServerDownBanner() {
  const isServerDown = useConnectionStore((s) => s.isServerDown)
  const markUp = useConnectionStore((s) => s.markUp)
  const [isRetrying, setIsRetrying] = useState(false)

  const checkHealth = useCallback(async () => {
    try {
      setIsRetrying(true)
      await axios.get(HEALTH_URL, { timeout: 5000 })
      markUp()
    } catch {
      // Still down — store stays as-is
    } finally {
      setIsRetrying(false)
    }
  }, [markUp])

  // Auto-retry health check every 10s while server is down
  useEffect(() => {
    if (!isServerDown) return

    const interval = setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isServerDown, checkHealth])

  if (!isServerDown) return null

  return (
    <div
      role="alert"
      className={cn(
        'fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-3',
        'bg-error-600 text-white px-4 py-3 text-sm font-medium',
        'animate-slide-down shadow-lg',
      )}
    >
      <WifiOff className="h-4 w-4 flex-shrink-0" />
      <span>Unable to connect to the server. Retrying automatically...</span>
      <button
        onClick={checkHealth}
        disabled={isRetrying}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1',
          'bg-white/20 hover:bg-white/30 transition-colors text-white text-xs font-semibold',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <RefreshCw className={cn('h-3 w-3', isRetrying && 'animate-spin')} />
        Retry Now
      </button>
    </div>
  )
}
