'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { OnboardingForm } from '@/components/auth/onboarding-form'
import { useAuthStore } from '@/store/auth.store'
import { APP_NAME, getHomeRoute } from '@/lib/constants'

export default function OnboardingPage() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const completedOnboarding = useAuthStore((s) => s.completedOnboarding)
  const markOnboardingComplete = useAuthStore((s) => s.markOnboardingComplete)

  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuthenticated) { router.replace('/login/phone'); return }
    if (completedOnboarding) { router.replace(getHomeRoute(useAuthStore.getState().user?.role)); return }
  }, [hasHydrated, isAuthenticated, completedOnboarding, router])

  if (!hasHydrated || !isAuthenticated || completedOnboarding) return null

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-3xl font-extrabold text-primary-600">
            {APP_NAME}
          </Link>
          <p className="mt-2 text-neutral-500">Complete your profile to get started</p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-card border border-neutral-100">
          <OnboardingForm onComplete={() => { markOnboardingComplete(); router.push(getHomeRoute(useAuthStore.getState().user?.role)) }} />
        </div>
      </div>
    </div>
  )
}
