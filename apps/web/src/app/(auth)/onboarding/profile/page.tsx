'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { NameInputForm } from '@/components/auth/name-input-form'
import { useAuthStore } from '@/store/auth.store'
import { APP_NAME, getHomeRoute } from '@/lib/constants'
import { useLoadingStore } from '@/store/loading.store'

export default function OnboardingProfilePage() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)

  // Redirect if not logged in
  useEffect(() => {
    if (hasHydrated && !isAuthenticated) router.replace('/login/email')
  }, [hasHydrated, isAuthenticated, router])

  if (!hasHydrated || !isAuthenticated) return null

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-3xl font-extrabold text-primary-600">
            {APP_NAME}
          </Link>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-card border border-neutral-100">
          <NameInputForm onComplete={() => { useLoadingStore.getState().show('Setting up...'); router.push(getHomeRoute(useAuthStore.getState().user?.role)) }} />
        </div>
      </div>
    </div>
  )
}
