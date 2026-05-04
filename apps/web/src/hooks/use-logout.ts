'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { apiClient } from '@/lib/api-client'

/**
 * Shared logout hook — calls POST /auth/logout, clears Zustand auth store, redirects.
 * Used by Header and DashboardLayout to avoid duplicate implementations.
 */
export function useLogout(redirectTo = '/login') {
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [loggingOut, setLoggingOut] = useState(false)

  const logout = useCallback(async () => {
    setLoggingOut(true)
    try { await apiClient.post('/auth/logout') } catch { /* best-effort */ }
    clearAuth()
    router.push(redirectTo)
  }, [clearAuth, router, redirectTo])

  return { logout, loggingOut }
}
