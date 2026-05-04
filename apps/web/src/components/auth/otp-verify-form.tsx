'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { isAppApiError } from '@/lib/api-client'

interface OtpVerifyFormProps {
  /** Display text like "+91 98765 43210" or "user@example.com" */
  identifier: string
  /** Label prefix — "OTP sent to" is default */
  identifierLabel?: string
  onEdit: () => void
  /** Parent calls the verify mutation and returns the result. Throw to show error. */
  onVerify: (otp: string) => Promise<{ isNewUser: boolean }>
  onResend: () => Promise<void>
  /** External pending state (from parent's mutation) */
  isPending?: boolean
  /** External error (from parent's mutation) */
  error?: Error | null
  /** Number of OTP digits. Defaults to 4 (backend OTP). Use 6 for Firebase. */
  otpLength?: number
}

export function OtpVerifyForm({
  identifier,
  identifierLabel = 'OTP sent to',
  onEdit,
  onVerify,
  onResend,
  isPending = false,
  error = null,
  otpLength = 4,
}: OtpVerifyFormProps) {
  const [digits, setDigits] = useState<string[]>(Array(otpLength).fill(''))
  const [countdown, setCountdown] = useState(30)
  const [shaking, setShaking] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const onVerifyRef = useRef(onVerify)
  onVerifyRef.current = onVerify

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
      await onVerifyRef.current(otp)
    } catch {
      // Trigger shake animation on error
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
      // Clear digits so user can retry
      setDigits(Array(otpLength).fill(''))
      inputRefs.current[0]?.focus()
    }
  }, [otpLength])

  // Auto-submit when all digits filled
  useEffect(() => {
    const otp = digits.join('')
    if (otp.length === otpLength && /^\d+$/.test(otp)) {
      handleVerify(otp)
    }
  }, [digits, handleVerify, otpLength])

  const handleChange = (index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...digits]
    newDigits[index] = digit
    setDigits(newDigits)

    // Auto-focus next box
    if (digit && index < otpLength - 1) {
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
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, otpLength)
    if (pasted.length === otpLength) {
      setDigits(pasted.split(''))
      inputRefs.current[otpLength - 1]?.focus()
    }
  }

  const handleResend = async () => {
    await onResend()
    setCountdown(30)
    setDigits(Array(otpLength).fill(''))
    inputRefs.current[0]?.focus()
  }

  return (
    <div className="space-y-6">
      {/* Identifier display + Edit link */}
      <div className="text-center">
        <p className="text-sm text-neutral-500">
          {identifierLabel}{' '}
          <span className="font-medium text-neutral-900">{identifier}</span>
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
      {error && (
        <div role="alert" className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-500 text-center">
          {isAppApiError(error) ? error.message : 'Something went wrong'}
        </div>
      )}

      {/* Verify button (for manual submit) */}
      <button
        type="button"
        onClick={() => handleVerify(digits.join(''))}
        disabled={digits.join('').length < otpLength || isPending}
        className="btn-primary w-full disabled:opacity-50"
      >
        {isPending ? (
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
