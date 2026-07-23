'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PhoneInputForm } from '@/components/auth/phone-input-form'
import { OtpVerifyForm } from '@/components/auth/otp-verify-form'
import { useSendOtp, useVerifyOtp } from '@/hooks/use-otp'
import { useFirebasePhoneAuth } from '@/hooks/use-firebase-phone-auth'
import { useAuthStore } from '@/store/auth.store'
import { useRedirectIfAuthenticated } from '@/hooks/use-redirect-if-authenticated'
import { APP_NAME, getPostAuthRoute } from '@/lib/constants'
import { GoogleAuthSection } from '@/components/auth/google-auth-section'
import { useLoadingStore } from '@/store/loading.store'

const PHONE_STRATEGY = process.env.NEXT_PUBLIC_PHONE_AUTH_STRATEGY || 'backend'
const RECAPTCHA_CONTAINER_ID = 'recaptcha-container'

export default function PhoneLoginPage() {
  const router = useRouter()
  const markOnboardingComplete = useAuthStore((s) => s.markOnboardingComplete)

  const sendOtp = useSendOtp()
  const verifyOtp = useVerifyOtp()

  const firebase = useFirebasePhoneAuth()

  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')

  const formattedPhone = phone ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : ''

  // requireOnboarded: false — bounce an authenticated visitor away immediately
  // (matches the original behavior: no completedOnboarding gate on this page).
  useRedirectIfAuthenticated({ requireOnboarded: false })

  const handleVerified = (data: { isNewUser: boolean }) => {
    useLoadingStore.getState().show('Signing in...')
    if (!data.isNewUser) markOnboardingComplete()
    router.push(getPostAuthRoute({ isNewUser: data.isNewUser, user: useAuthStore.getState().user }))
  }

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
            {step === 'phone' ? 'Login with WhatsApp' : 'Enter the OTP sent to your WhatsApp'}
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
              identifierLabel="WhatsApp OTP sent to"
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
                useLoadingStore.getState().show('Signing in...')
                if (!isNewUser) markOnboardingComplete()
                router.push(getPostAuthRoute({ isNewUser, user: useAuthStore.getState().user }))
              }}
            />
          )}
        </div>

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
