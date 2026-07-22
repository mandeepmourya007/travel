'use client'

import { useState } from 'react'
import { PhoneInputForm } from '@/components/auth/phone-input-form'
import { OtpVerifyForm } from '@/components/auth/otp-verify-form'
import { useSendAttachPhoneOtp, useVerifyAttachPhoneOtp } from '@/hooks/use-attach-phone'

interface PhoneVerificationFlowProps {
  onSuccess: () => void
  /** Dismiss affordance — only rendered when provided (e.g. the profile modal call site). */
  onCancel?: () => void
}

/**
 * The single reusable "attach + verify phone" wiring, shared by the mandatory
 * gate route (`/verify-phone`) and the profile "Verify phone" CTA modal.
 * Owns the phone -> otp step machine and wires the *attach* hooks (never the
 * public login OTP hooks) so the current session is never replaced.
 */
export function PhoneVerificationFlow({ onSuccess, onCancel }: PhoneVerificationFlowProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')

  const sendAttach = useSendAttachPhoneOtp()
  const verifyAttach = useVerifyAttachPhoneOtp()

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
