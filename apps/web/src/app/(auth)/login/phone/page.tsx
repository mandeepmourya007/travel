'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PhoneInputForm } from '@/components/auth/phone-input-form'
import { OtpVerifyForm } from '@/components/auth/otp-verify-form'
import { useSendOtp } from '@/hooks/use-otp'
import { useAuthStore } from '@/store/auth.store'
import { APP_NAME, getHomeRoute } from '@/lib/constants'
import { GoogleAuthSection } from '@/components/auth/google-auth-section'

export default function PhoneLoginPage() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const markOnboardingComplete = useAuthStore((s) => s.markOnboardingComplete)
  const sendOtp = useSendOtp()

  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (hasHydrated && isAuthenticated) router.replace(getHomeRoute(useAuthStore.getState().user?.role))
  }, [hasHydrated, isAuthenticated, router])

  /** Route based on isNewUser — new users need onboarding (name + role) */
  const handleVerified = (data: { isNewUser: boolean }) => {
    if (data.isNewUser) {
      router.push('/onboarding')
    } else {
      markOnboardingComplete()
      router.push(getHomeRoute(useAuthStore.getState().user?.role))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-3xl font-extrabold text-primary-600">
            {APP_NAME}
          </Link>
          <p className="mt-2 text-neutral-500">
            {step === 'phone' ? 'Login with your phone number' : 'Enter the OTP'}
          </p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-card border border-neutral-100">
          {step === 'phone' ? (
            <PhoneInputForm onOtpSent={(p) => { setPhone(p); setStep('otp') }} />
          ) : (
            <OtpVerifyForm
              phone={phone}
              onVerified={handleVerified}
              onEdit={() => setStep('phone')}
              onResend={async () => { await sendOtp.mutateAsync(phone) }}
            />
          )}

          {step === 'phone' && (
            <GoogleAuthSection
              onSuccess={(isNewUser) => {
                if (!isNewUser) markOnboardingComplete()
                router.push(isNewUser ? '/onboarding' : getHomeRoute(useAuthStore.getState().user?.role))
              }}
            />
          )}
        </div>

        {step === 'phone' && (
          <p className="mt-6 text-center text-sm text-neutral-500">
            Or{' '}
            <Link href="/login/email" className="font-medium text-primary-600 hover:text-primary-700">
              login with email
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
