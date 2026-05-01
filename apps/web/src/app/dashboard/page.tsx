'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { apiClient } from '@/lib/api-client'

export default function DashboardPage() {
  const router = useRouter()
  const { user, clearAuth, isAuthenticated, _hasHydrated } = useAuthStore()

  const handleLogout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // ignore — still clear local state
    }
    localStorage.removeItem('accessToken')
    clearAuth()
    router.push('/')
  }, [clearAuth, router])

  useEffect(() => {
    if (_hasHydrated && (!isAuthenticated || !user)) {
      router.push('/login')
    }
  }, [_hasHydrated, isAuthenticated, user, router])

  if (!_hasHydrated || !isAuthenticated || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="font-display text-xl font-bold text-primary-600">TravelApp</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-neutral-800">{user.name}</p>
              <p className="text-xs text-neutral-400">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="font-display text-2xl font-bold text-neutral-800">
          Welcome back, {user.name.split(' ')[0]}!
        </h2>
        <p className="mt-2 text-neutral-500">
          You&apos;re logged in as <span className="font-medium text-primary-600">{user.role}</span>.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { label: 'User ID', value: user.id.slice(0, 12) + '...' },
            { label: 'Email', value: user.email },
            { label: 'Role', value: user.role },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-white border border-neutral-200 p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{item.label}</p>
              <p className="mt-1 text-lg font-semibold text-neutral-800">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="text-neutral-500">
            Auth is working end-to-end! Next up: Trip browsing, Booking flow, Organizer dashboard.
          </p>
        </div>
      </main>
    </div>
  )
}
