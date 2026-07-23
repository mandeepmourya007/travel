'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSendEmailOtp } from '@/hooks/use-email-otp'
import { getErrorMessage } from '@/lib/api-client'
import { EmailInput, isValidEmail } from '@/components/shared/email-input'

interface EmailInputFormProps {
  onOtpSent: (email: string) => void
  /** When provided, replaces the internal sendOtp mutation (e.g. the attach-email flow). */
  onSubmit?: (email: string) => Promise<void>
}

export function EmailInputForm({ onOtpSent, onSubmit }: EmailInputFormProps) {
  const [email, setEmail] = useState('')
  const [externalError, setExternalError] = useState<Error | null>(null)
  const [externalPending, setExternalPending] = useState(false)
  const sendOtp = useSendEmailOtp()
  const isValid = isValidEmail(email)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    try {
      if (onSubmit) {
        setExternalPending(true)
        setExternalError(null)
        await onSubmit(email)
      } else {
        await sendOtp.mutateAsync(email)
      }
      onOtpSent(email)
    } catch (err) {
      if (onSubmit) setExternalError(err instanceof Error ? err : new Error(String(err)))
      /* else error exposed via sendOtp.error */
    } finally {
      if (onSubmit) setExternalPending(false)
    }
  }

  const isPending = onSubmit ? externalPending : sendOtp.isPending
  const error = onSubmit ? externalError : sendOtp.error

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <EmailInput
        id="email-otp"
        value={email}
        onChange={setEmail}
        autoFocus
        error={getErrorMessage(error)}
      />

      <button
        type="submit"
        disabled={!isValid || isPending}
        className="btn-primary w-full disabled:opacity-50"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="spinner spinner-sm" /> Sending OTP...
          </span>
        ) : 'Get OTP'}
      </button>

      <p className="text-center text-xs text-neutral-400">
        By continuing, you agree to our{' '}
        <Link href="/terms" prefetch={false} className="underline hover:text-neutral-600">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" prefetch={false} className="underline hover:text-neutral-600">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  )
}
