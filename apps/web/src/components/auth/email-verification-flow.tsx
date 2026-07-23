'use client'

import { useEffect, useRef, useState } from 'react'
import { EmailInputForm } from '@/components/auth/email-input-form'
import { OtpVerifyForm } from '@/components/auth/otp-verify-form'
import { useSendAttachEmailOtp, useVerifyAttachEmailOtp } from '@/hooks/use-attach-email'
import { getErrorMessage } from '@/lib/api-client'

interface EmailVerificationFlowProps {
  onSuccess: () => void
  /** Dismiss affordance — only rendered when provided (e.g. the profile edit modal call site). */
  onCancel?: () => void
  /**
   * Pre-fill and auto-send the OTP to this email instead of prompting for a
   * new one — used by the "Verify" action on an existing-but-unverified
   * email, so the user isn't asked to retype an address they've already
   * entered. "Change"/"Add" still go through the input step by omitting this.
   */
  initialEmail?: string
}

/**
 * The single reusable "attach + verify email" wiring — mirrors
 * `PhoneVerificationFlow` exactly, for email instead of phone. Owns the
 * email -> otp step machine and wires the *attach* hooks (never the public
 * login OTP hooks) so the current session is never replaced.
 */
export function EmailVerificationFlow({ onSuccess, onCancel, initialEmail }: EmailVerificationFlowProps) {
  const [step, setStep] = useState<'email' | 'otp'>(initialEmail ? 'otp' : 'email')
  const [email, setEmail] = useState(initialEmail ?? '')
  // Tracks only the ONE-TIME auto-send triggered below — deliberately
  // separate from sendAttach's own isSuccess/isError, which reset to
  // pending on every subsequent resend and would otherwise flicker this
  // screen back to the "sending" state (and unmount OtpVerifyForm, losing
  // any digits already typed) each time the user hits resend.
  const [autoSendState, setAutoSendState] = useState<'pending' | 'done' | 'error'>(
    initialEmail ? 'pending' : 'done',
  )
  const [autoSendError, setAutoSendError] = useState<Error | null>(null)

  const sendAttach = useSendAttachEmailOtp()
  const verifyAttach = useVerifyAttachEmailOtp()
  const autoSent = useRef(false)

  // `sendAttach` is intentionally omitted from the deps array below —
  // the `autoSent` ref (not the deps array) is what makes this a true
  // one-time effect, so re-running it on every new `sendAttach` identity
  // would be a no-op anyway. Guards against React 18 Strict Mode's
  // dev-only double-invoke firing two sends.
  useEffect(() => {
    if (initialEmail && !autoSent.current) {
      autoSent.current = true
      sendAttach.mutate(initialEmail, {
        onSuccess: () => setAutoSendState('done'),
        onError: (err) => {
          setAutoSendState('error')
          setAutoSendError(err instanceof Error ? err : new Error(String(err)))
        },
      })
    }
  }, [initialEmail])

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

      {step === 'email' ? (
        <EmailInputForm
          onSubmit={(e) => sendAttach.mutateAsync(e).then(() => {})}
          onOtpSent={(e) => { setEmail(e); setStep('otp') }}
        />
      ) : autoSendState === 'pending' ? (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <span className="spinner spinner-sm" /> Sending OTP to {email}...
        </p>
      ) : autoSendState === 'error' ? (
        <div className="space-y-3">
          <p className="text-sm text-error-500">{getErrorMessage(autoSendError)}</p>
          <button type="button" className="btn-secondary" onClick={() => setStep('email')}>
            Try a different email
          </button>
        </div>
      ) : (
        <OtpVerifyForm
          identifier={email}
          identifierLabel="OTP sent to"
          otpLength={4}
          onEdit={() => setStep('email')}
          onVerify={async (otp) => {
            await verifyAttach.mutateAsync({ email, otp })
            onSuccess()
            return { isNewUser: false }
          }}
          onResend={() => sendAttach.mutateAsync(email).then(() => {})}
          isPending={verifyAttach.isPending}
          error={verifyAttach.error}
        />
      )}
    </div>
  )
}
