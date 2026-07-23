'use client'

import { useEffect, useRef, useState } from 'react'
import { PhoneInputForm } from '@/components/auth/phone-input-form'
import { OtpVerifyForm } from '@/components/auth/otp-verify-form'
import { useSendAttachPhoneOtp, useVerifyAttachPhoneOtp } from '@/hooks/use-attach-phone'
import { getErrorMessage } from '@/lib/api-client'

interface PhoneVerificationFlowProps {
  onSuccess: () => void
  /** Dismiss affordance — only rendered when provided (e.g. the profile modal call site). */
  onCancel?: () => void
  /**
   * Pre-fill and auto-send the OTP to this (bare 10-digit, no country code)
   * phone instead of prompting for a new one — used by the "Verify" action
   * on an existing-but-unverified phone, so the user isn't asked to retype
   * a number they've already entered. "Change"/"Add" go through the input
   * step by omitting this.
   */
  initialPhone?: string
}

/**
 * The single reusable "attach + verify phone" wiring, used by the profile
 * "Verify phone" CTA modal — an optional, account-level phone-verification
 * flow (distinct from the mandatory, booking-scoped
 * `BookingContactVerificationFlow` shown after payment success).
 * Owns the phone -> otp step machine and wires the *attach* hooks (never the
 * public login OTP hooks) so the current session is never replaced.
 */
export function PhoneVerificationFlow({ onSuccess, onCancel, initialPhone }: PhoneVerificationFlowProps) {
  const [step, setStep] = useState<'phone' | 'otp'>(initialPhone ? 'otp' : 'phone')
  const [phone, setPhone] = useState(initialPhone ?? '')
  // Tracks only the ONE-TIME auto-send triggered below — deliberately
  // separate from sendAttach's own isSuccess/isError, which reset to
  // pending on every subsequent resend and would otherwise flicker this
  // screen back to the "sending" state (and unmount OtpVerifyForm, losing
  // any digits already typed) each time the user hits resend.
  const [autoSendState, setAutoSendState] = useState<'pending' | 'done' | 'error'>(
    initialPhone ? 'pending' : 'done',
  )
  const [autoSendError, setAutoSendError] = useState<Error | null>(null)

  const sendAttach = useSendAttachPhoneOtp()
  const verifyAttach = useVerifyAttachPhoneOtp()
  const autoSent = useRef(false)

  // `sendAttach` is intentionally omitted from the deps array below —
  // the `autoSent` ref (not the deps array) is what makes this a true
  // one-time effect, so re-running it on every new `sendAttach` identity
  // would be a no-op anyway. Guards against React 18 Strict Mode's
  // dev-only double-invoke firing two sends.
  useEffect(() => {
    if (initialPhone && !autoSent.current) {
      autoSent.current = true
      sendAttach.mutate(initialPhone, {
        onSuccess: () => setAutoSendState('done'),
        onError: (err) => {
          setAutoSendState('error')
          setAutoSendError(err instanceof Error ? err : new Error(String(err)))
        },
      })
    }
  }, [initialPhone])

  const formattedPhone = phone ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : ''

  return (
    <div className="space-y-4">
      {onCancel && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
          >
            Cancel
          </button>
        </div>
      )}

      {step === 'phone' ? (
        <PhoneInputForm
          onSubmit={(p) => sendAttach.mutateAsync(p).then(() => {})}
          onOtpSent={(p) => { setPhone(p); setStep('otp') }}
        />
      ) : autoSendState === 'pending' ? (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <span className="spinner spinner-sm" /> Sending OTP to {formattedPhone}...
        </p>
      ) : autoSendState === 'error' ? (
        <div className="space-y-3">
          <p className="text-sm text-error-500">{getErrorMessage(autoSendError)}</p>
          <button type="button" className="btn-secondary" onClick={() => setStep('phone')}>
            Try a different number
          </button>
        </div>
      ) : (
        <OtpVerifyForm
          identifier={formattedPhone}
          identifierLabel="WhatsApp OTP sent to"
          otpLength={4}
          onEdit={() => setStep('phone')}
          onVerify={async (otp) => {
            await verifyAttach.mutateAsync({ phone, otp })
            onSuccess()
            return { isNewUser: false }
          }}
          onResend={() => sendAttach.mutateAsync(phone).then(() => {})}
          isPending={verifyAttach.isPending}
          error={verifyAttach.error}
        />
      )}
    </div>
  )
}
