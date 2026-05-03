'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useVerifyOtp } from '@/hooks/use-otp'
import { isAppApiError } from '@/lib/api-client'

interface OtpVerifyFormProps {
  phone: string
  onVerified: (data: { isNewUser: boolean }) => void
  onEdit: () => void
  onResend: () => Promise<void>
}

const OTP_LENGTH = 4

export function OtpVerifyForm({ phone, onVerified, onEdit, onResend }: OtpVerifyFormProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [countdown, setCountdown] = useState(30)
  const [shaking, setShaking] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const verifyOtp = useVerifyOtp()

  // Auto-focus first box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleVerify = useCallback(async (otp: string) => {
    try {
      const data = await verifyOtp.mutateAsync({ phone, otp })
      onVerified({ isNewUser: data.isNewUser })
    } catch {
      // Trigger shake animation on error
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
      // Clear digits so user can retry
      setDigits(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    }
  }, [phone, onVerified, verifyOtp.mutateAsync])

  // Auto-submit when all 4 digits filled
  useEffect(() => {
    const otp = digits.join('')
    if (otp.length === OTP_LENGTH && /^\d{4}$/.test(otp)) {
      handleVerify(otp)
    }
  }, [digits, handleVerify])

  const handleChange = (index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...digits]
    newDigits[index] = digit
    setDigits(newDigits)

    // Auto-focus next box
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Backspace on empty box → go to previous
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits]
      newDigits[index - 1] = ''
      setDigits(newDigits)
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (pasted.length === OTP_LENGTH) {
      setDigits(pasted.split(''))
      inputRefs.current[OTP_LENGTH - 1]?.focus()
    }
  }

  const handleResend = async () => {
    await onResend()
    setCountdown(30)
    setDigits(Array(OTP_LENGTH).fill(''))
    inputRefs.current[0]?.focus()
  }

  // Format phone: 9876543210 → 98765 43210
  const formattedPhone = `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`

  return (
    <div className="space-y-6">
      {/* Phone display + Edit link */}
      <div className="text-center">
        <p className="text-sm text-neutral-500">
          OTP sent to{' '}
          <span className="font-medium text-neutral-900">{formattedPhone}</span>
          {' '}
          <button type="button" onClick={onEdit} className="font-medium text-primary-600 hover:text-primary-700">
            Edit
          </button>
        </p>
      </div>

      {/* 4 OTP boxes */}
      <div className={`flex justify-center gap-3 ${shaking ? 'animate-shake' : ''}`}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            aria-label={`Digit ${i + 1}`}
            className="otp-input"
          />
        ))}
      </div>

      {/* Error message */}
      {verifyOtp.error && (
        <div role="alert" className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-500 text-center">
          {isAppApiError(verifyOtp.error) ? verifyOtp.error.message : 'Something went wrong'}
        </div>
      )}

      {/* Verify button (for manual submit) */}
      <button
        type="button"
        onClick={() => handleVerify(digits.join(''))}
        disabled={digits.join('').length < OTP_LENGTH || verifyOtp.isPending}
        className="btn-primary w-full disabled:opacity-50"
      >
        {verifyOtp.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="spinner spinner-sm" /> Verifying...
          </span>
        ) : 'Verify OTP'}
      </button>

      {/* Countdown + Resend */}
      <div className="text-center text-sm">
        {countdown > 0 ? (
          <p className="text-neutral-500" aria-live="polite">
            Resend OTP in 0:{countdown.toString().padStart(2, '0')}
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="btn-ghost text-primary-600 hover:text-primary-700 font-medium"
          >
            Resend OTP
          </button>
        )}
      </div>
    </div>
  )
}
