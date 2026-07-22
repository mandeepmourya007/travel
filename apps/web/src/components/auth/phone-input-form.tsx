'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSendOtp } from '@/hooks/use-otp'
import { getErrorMessage } from '@/lib/api-client'
import { PhoneInput } from '@/components/shared/phone-input'
import { INDIAN_PHONE_REGEX } from '@shared/validators/auth.schema'

interface PhoneInputFormProps {
  onOtpSent: (phone: string) => void
  /** When provided, replaces the internal sendOtp mutation (e.g. Firebase strategy). */
  onSubmit?: (phone: string) => Promise<void>
}

export function PhoneInputForm({ onOtpSent, onSubmit }: PhoneInputFormProps) {
  const [phone, setPhone] = useState('')
  const [externalError, setExternalError] = useState<Error | null>(null)
  const [externalPending, setExternalPending] = useState(false)
  const sendOtp = useSendOtp()
  const isValid = INDIAN_PHONE_REGEX.test(phone)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    try {
      if (onSubmit) {
        setExternalPending(true)
        setExternalError(null)
        await onSubmit(phone)
      } else {
        await sendOtp.mutateAsync(phone)
      }
      onOtpSent(phone)
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
      <PhoneInput
        value={phone}
        onChange={setPhone}
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
            <span className="spinner spinner-sm" /> Sending OTP via WhatsApp...
          </span>
        ) : 'Get OTP via WhatsApp'}
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
