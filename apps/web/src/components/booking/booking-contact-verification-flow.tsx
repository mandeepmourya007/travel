'use client'

import { useState } from 'react'
import { PhoneInputForm } from '@/components/auth/phone-input-form'
import { OtpVerifyForm } from '@/components/auth/otp-verify-form'
import {
  useSendBookingContactOtp,
  useVerifyBookingContactOtp,
  useUseAccountPhoneForBooking,
} from '@/hooks/use-booking-contact'
import { useAuthStore } from '@/store/auth.store'
import { getErrorMessage } from '@/lib/api-client'
import { useToast } from '@/components/shared/toast'
import { bookingContactSchema } from '@shared/validators/booking.schema'

interface BookingContactVerificationFlowProps {
  bookingId: string
  onComplete: () => void
}

type Step = 'shortcut' | 'phone' | 'otp'

/**
 * Formats a phone number for display. Strips any existing country-code
 * prefix (e.g. `User.phone` is stored as `+919876543210`, but the fresh-entry
 * flow's local `phone` state is a bare 10-digit number) before re-prepending
 * `+91`, so both sources render identically instead of double-prefixing.
 */
function formatPhone(phone: string): string {
  const last10 = phone.replace(/\D/g, '').slice(-10)
  return last10 ? `+91 ${last10.slice(0, 5)} ${last10.slice(5)}` : ''
}

/**
 * Mandatory, non-dismissible, booking-scoped contact-verification step shown
 * right after a booking payment succeeds. Deliberately has no `onCancel`/
 * skip affordance — this is the enforcement point for the "cannot be
 * skipped" product requirement. Never reads/writes the account's own
 * `User.phone` — only this booking's `TravelerDetail`.
 */
export function BookingContactVerificationFlow({
  bookingId,
  onComplete,
}: BookingContactVerificationFlowProps) {
  const user = useAuthStore((s) => s.user)
  const { toast } = useToast()
  const [step, setStep] = useState<Step>(user?.phoneVerified === true ? 'shortcut' : 'phone')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [nameTouched, setNameTouched] = useState(false)

  const sendOtp = useSendBookingContactOtp(bookingId)
  const verifyOtp = useVerifyBookingContactOtp(bookingId)
  const useAccountPhone = useUseAccountPhoneForBooking(bookingId)

  const nameValidation = bookingContactSchema.shape.name.safeParse(name)
  const isNameValid = nameValidation.success

  return (
    <div className="card-static space-y-4 p-6" data-testid="booking-contact-verification">
      <h3 className="text-base font-semibold text-neutral-900">Verify a contact number</h3>
      <p className="text-sm text-neutral-500">
        We need a reachable WhatsApp number for this trip so the organizer can keep you updated.
      </p>

      {step === 'shortcut' && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            Use <span className="font-medium">{formatPhone(user?.phone ?? '')}</span>
            {user?.name ? ` (${user.name})` : ''} to keep you updated about this trip?
          </p>
          {useAccountPhone.error && (
            <div role="alert" className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-500">
              {getErrorMessage(useAccountPhone.error)}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn-primary flex-1 disabled:opacity-50"
              disabled={useAccountPhone.isPending}
              onClick={async () => {
                await useAccountPhone.mutateAsync()
                toast({ variant: 'success', title: 'Contact number verified for this trip.' })
                onComplete()
              }}
            >
              {useAccountPhone.isPending ? 'Saving...' : 'Yes, use this number'}
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              disabled={useAccountPhone.isPending}
              onClick={() => setStep('phone')}
            >
              No, booking for someone else
            </button>
          </div>
        </div>
      )}

      {step === 'phone' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="booking-contact-name" className="label">
              Contact name
            </label>
            <input
              id="booking-contact-name"
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setNameTouched(true)}
              placeholder="Full name"
            />
            {nameTouched && !isNameValid && (
              <p className="mt-1 text-xs text-error-500">Enter a valid name (at least 2 characters)</p>
            )}
          </div>

          <PhoneInputForm
            onSubmit={(p) => {
              if (!isNameValid) {
                setNameTouched(true)
                return Promise.reject(new Error('Enter a valid contact name first'))
              }
              return sendOtp.mutateAsync({ name, phone: p }).then(() => {})
            }}
            onOtpSent={(p) => {
              setPhone(p)
              setStep('otp')
            }}
          />
        </div>
      )}

      {step === 'otp' && (
        <OtpVerifyForm
          identifier={formatPhone(phone)}
          identifierLabel="WhatsApp OTP sent to"
          otpLength={4}
          onEdit={() => setStep('phone')}
          onVerify={async (otp) => {
            await verifyOtp.mutateAsync({ name, phone, otp })
            toast({ variant: 'success', title: 'Contact number verified for this trip.' })
            onComplete()
            return { isNewUser: false }
          }}
          onResend={() => sendOtp.mutateAsync({ name, phone }).then(() => {})}
          isPending={verifyOtp.isPending}
          error={verifyOtp.error}
        />
      )}
    </div>
  )
}
