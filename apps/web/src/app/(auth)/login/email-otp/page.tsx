'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EmailInputForm } from '@/components/auth/email-input-form'
import { OtpVerifyForm } from '@/components/auth/otp-verify-form'
import { useSendEmailOtp, useVerifyEmailOtp } from '@/hooks/use-email-otp'
import { useAuthStore } from '@/store/auth.store'
import { APP_NAME, getHomeRoute } from '@/lib/constants'
import { GoogleAuthSection } from '@/components/auth/google-auth-section'
import { useLoadingStore } from '@/store/loading.store'

export default function EmailOtpLoginPage() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const completedOnboarding = useAuthStore((s) => s.completedOnboarding)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const markOnboardingComplete = useAuthStore((s) => s.markOnboardingComplete)
  const sendOtp = useSendEmailOtp()
  const verifyOtp = useVerifyEmailOtp()

  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (hasHydrated && isAuthenticated && completedOnboarding) router.replace(getHomeRoute(useAuthStore.getState().user?.role))
  }, [hasHydrated, isAuthenticated, completedOnboarding, router])

  const handleVerified = (data: { isNewUser: boolean }) => {
    useLoadingStore.getState().show('Signing in...')
    if (data.isNewUser) {
      router.push('/onboarding')
    } else {
      markOnboardingComplete()
      router.push(getHomeRoute(useAuthStore.getState().user?.role))
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-3xl font-extrabold text-primary-600">
            {APP_NAME}
          </Link>
          <p className="mt-2 text-neutral-500">
            {step === 'email' ? 'Login with your email' : 'Enter the OTP sent to your email'}
          </p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-card border border-neutral-100">
          {step === 'email' ? (
            <EmailInputForm onOtpSent={(e) => { setEmail(e); setStep('otp') }} />
          ) : (
            <OtpVerifyForm
              identifier={email}
              onEdit={() => setStep('email')}
              onVerify={async (otp) => {
                const data = await verifyOtp.mutateAsync({ email, otp })
                handleVerified({ isNewUser: data.isNewUser })
                return { isNewUser: data.isNewUser }
              }}
              onResend={async () => { await sendOtp.mutateAsync(email) }}
              isPending={verifyOtp.isPending}
              error={verifyOtp.error}
            />
          )}

          {step === 'email' && (
            <GoogleAuthSection
              onSuccess={(isNewUser) => {
                useLoadingStore.getState().show('Signing in...')
                if (!isNewUser) markOnboardingComplete()
                router.push(isNewUser ? '/onboarding' : getHomeRoute(useAuthStore.getState().user?.role))
              }}
            />
          )}
        </div>

        {step === 'email' && (
          <p className="mt-6 text-center text-sm text-neutral-500">
            Or{' '}
            <Link href="/login/email" className="font-medium text-primary-600 hover:text-primary-700">
              login with email & password
            </Link>
            {' · '}
            <Link href="/login/phone" className="font-medium text-primary-600 hover:text-primary-700">
              login with WhatsApp
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
