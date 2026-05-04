'use client'

import { useState } from 'react'
import { useSendEmailOtp } from '@/hooks/use-email-otp'
import { getErrorMessage } from '@/lib/api-client'
import { EmailInput, isValidEmail } from '@/components/shared/email-input'

interface EmailInputFormProps {
  onOtpSent: (email: string) => void
}

export function EmailInputForm({ onOtpSent }: EmailInputFormProps) {
  const [email, setEmail] = useState('')
  const sendOtp = useSendEmailOtp()
  const isValid = isValidEmail(email)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    try {
      await sendOtp.mutateAsync(email)
      onOtpSent(email)
    } catch { /* error exposed via sendOtp.error */ }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <EmailInput
        id="email-otp"
        value={email}
        onChange={setEmail}
        autoFocus
        error={getErrorMessage(sendOtp.error)}
      />

      <button
        type="submit"
        disabled={!isValid || sendOtp.isPending}
        className="btn-primary w-full disabled:opacity-50"
      >
        {sendOtp.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="spinner spinner-sm" /> Sending OTP...
          </span>
        ) : 'Get OTP'}
      </button>

      <p className="text-center text-xs text-neutral-400">
        By continuing, you agree to our Terms of Service
      </p>
    </form>
  )
}
