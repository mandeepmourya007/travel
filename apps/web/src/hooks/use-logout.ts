'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { useLoadingStore } from '@/store/loading.store'
import { apiClient } from '@/lib/api-client'

/**
 * Shared logout hook — calls POST /auth/logout, clears Zustand auth store, redirects.
 * Uses FullScreenLoader to mask the transition so the navbar doesn't flash.
 */
export function useLogout(redirectTo = '/login/phone') {
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const showLoader = useLoadingStore((s) => s.show)
  const [loggingOut, setLoggingOut] = useState(false)

  const logout = useCallback(async () => {
    setLoggingOut(true)
    showLoader('Logging out...')
    try { await apiClient.post('/auth/logout') } catch { /* best-effort */ }
    clearAuth()
    router.replace(redirectTo)
  }, [clearAuth, router, redirectTo, showLoader])

  return { logout, loggingOut }
}
