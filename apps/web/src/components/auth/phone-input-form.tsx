'use client'

import { useState } from 'react'
import { useSendOtp } from '@/hooks/use-otp'
import { isAppApiError } from '@/lib/api-client'
import { INDIAN_PHONE_REGEX } from '@shared/validators/auth.schema'

interface PhoneInputFormProps {
  onOtpSent: (phone: string) => void
}

export function PhoneInputForm({ onOtpSent }: PhoneInputFormProps) {
  const [phone, setPhone] = useState('')
  const sendOtp = useSendOtp()
  const isValid = INDIAN_PHONE_REGEX.test(phone)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    try {
      await sendOtp.mutateAsync(phone)
      onOtpSent(phone)
    } catch { /* error exposed via sendOtp.error */ }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-neutral-700">
          Phone number
        </label>
        <div className="flex gap-2">
          <span className="flex items-center rounded-lg border border-neutral-200 bg-neutral-100
                           px-3 text-sm font-medium text-neutral-500">
            +91
          </span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoFocus
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="input flex-1"
            placeholder="9876543210"
          />
        </div>
      </div>

      {sendOtp.error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-500">
          {isAppApiError(sendOtp.error) ? sendOtp.error.message : 'Something went wrong'}
        </div>
      )}

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
