'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PhoneVerificationFlow } from '@/components/auth/phone-verification-flow'
import { useAuthStore } from '@/store/auth.store'
import { useProfile } from '@/hooks/use-profile'
import { APP_NAME, getPostAuthRoute } from '@/lib/constants'

export default function VerifyPhonePage() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const updateUser = useAuthStore((s) => s.updateUser)

  // Server truth — guards the stale-rehydrated-session edge case where the
  // persisted store says unverified but the server has since verified this
  // user (e.g. verified via the profile CTA on another device/tab).
  const { data: profile } = useProfile()

  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuthenticated) { router.replace('/login/email'); return }
    if (profile && profile.phoneVerified) {
      updateUser({ phoneVerified: true, phone: profile.phone ?? undefined })
      router.replace(getPostAuthRoute({ isNewUser: false, user: useAuthStore.getState().user }))
    }
  }, [hasHydrated, isAuthenticated, profile, updateUser, router])

  if (!hasHydrated || !isAuthenticated || (profile && profile.phoneVerified)) return null

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-3xl font-extrabold text-primary-600">
            {APP_NAME}
          </Link>
          <p className="mt-2 text-neutral-500">
            Verify your WhatsApp number to continue — this keeps your account and bookings secure.
          </p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-card border border-neutral-100">
          <PhoneVerificationFlow
            onSuccess={() =>
              router.replace(
                getPostAuthRoute({ isNewUser: false, user: useAuthStore.getState().user }),
              )
            }
          />
        </div>
      </div>
    </div>
  )
}
