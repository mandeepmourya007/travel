'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PhoneInputForm } from '@/components/auth/phone-input-form'
import { OtpVerifyForm } from '@/components/auth/otp-verify-form'
import { useSendOtp, useVerifyOtp } from '@/hooks/use-otp'
import { useFirebasePhoneAuth } from '@/hooks/use-firebase-phone-auth'
import { useAuthStore } from '@/store/auth.store'
import { APP_NAME, getHomeRoute } from '@/lib/constants'
import { GoogleAuthSection } from '@/components/auth/google-auth-section'

const PHONE_STRATEGY = process.env.NEXT_PUBLIC_PHONE_AUTH_STRATEGY || 'backend'
const RECAPTCHA_CONTAINER_ID = 'recaptcha-container'

export default function PhoneLoginPage() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const markOnboardingComplete = useAuthStore((s) => s.markOnboardingComplete)

  // Backend OTP hooks (always called — hooks must not be conditional)
  const sendOtp = useSendOtp()
  const verifyOtp = useVerifyOtp()

  // Firebase phone auth hook
  const firebase = useFirebasePhoneAuth()

  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')

  // Format phone: 9876543210 → +91 98765 43210
  const formattedPhone = phone ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : ''

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

  // Firebase strategy: override PhoneInputForm's internal sendOtp
  const firebaseSubmit = PHONE_STRATEGY === 'firebase'
    ? async (p: string) => { await firebase.sendCode(p, RECAPTCHA_CONTAINER_ID) }
    : undefined

  const handleVerify = PHONE_STRATEGY === 'firebase'
    ? async (otp: string) => {
        const result = await firebase.verifyCode(otp)
        handleVerified(result)
        return result
      }
    : async (otp: string) => {
        const data = await verifyOtp.mutateAsync({ phone, otp })
        handleVerified({ isNewUser: data.isNewUser })
        return { isNewUser: data.isNewUser }
      }

  const handleResend = PHONE_STRATEGY === 'firebase'
    ? async () => { await firebase.sendCode(phone, RECAPTCHA_CONTAINER_ID) }
    : async () => { await sendOtp.mutateAsync(phone) }

  const currentIsPending = PHONE_STRATEGY === 'firebase' ? firebase.isPending : verifyOtp.isPending
  const currentError = PHONE_STRATEGY === 'firebase' ? firebase.error : verifyOtp.error

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4">
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
            <PhoneInputForm
              onOtpSent={(p) => { setPhone(p); setStep('otp') }}
              onSubmit={firebaseSubmit}
            />
          ) : (
            <OtpVerifyForm
              identifier={formattedPhone}
              onEdit={() => { setStep('phone'); firebase.reset() }}
              onVerify={handleVerify}
              onResend={handleResend}
              isPending={currentIsPending}
              error={currentError}
              otpLength={PHONE_STRATEGY === 'firebase' ? 6 : 4}
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

        {/* Invisible reCAPTCHA container for Firebase phone auth */}
        <div id={RECAPTCHA_CONTAINER_ID} />

        {step === 'phone' && (
          <p className="mt-6 text-center text-sm text-neutral-500">
            Or{' '}
            <Link href="/login/email" className="font-medium text-primary-600 hover:text-primary-700">
              login with email
            </Link>
            {' · '}
            <Link href="/login/email-otp" className="font-medium text-primary-600 hover:text-primary-700">
              email OTP
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
