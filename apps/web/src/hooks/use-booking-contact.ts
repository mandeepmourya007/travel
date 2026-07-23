import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { bookingKeys } from '@/lib/query-keys'
import type { OtpSendResponse } from '@shared/types/auth.types'
import type { TravelerDetailItem } from '@shared/types/booking.types'

/**
 * Sends a WhatsApp OTP for a booking-scoped contact number. Distinct from
 * `useSendAttachPhoneOtp` (account-level) — this never reads/writes
 * `useAuthStore`, since the contact being verified may not belong to the
 * account owner (e.g. booking on behalf of someone else).
 */
export function useSendBookingContactOtp(bookingId: string) {
  return useMutation({
    // `name` is required here too — the backend validates send-otp against the
    // same `bookingContactSchema` used by verify-otp (`{ name, phone }`).
    mutationFn: (dto: { name: string; phone: string }) =>
      apiClient
        .post<{ data: OtpSendResponse }>(`/bookings/${bookingId}/contact/send-otp`, dto)
        .then((r) => r.data.data),
  })
}

/**
 * Verifies the booking-contact OTP. On success the backend writes
 * `{ name, phone, phoneVerified: true, isPrimary: true }` onto this
 * booking's `TravelerDetail` — it never touches the `User` table.
 */
export function useVerifyBookingContactOtp(bookingId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dto: { name: string; phone: string; otp: string }) =>
      apiClient
        .post<{ data: TravelerDetailItem }>(`/bookings/${bookingId}/contact/verify-otp`, dto)
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all })
    },
  })
}

/**
 * Copies the caller's own verified account phone onto this booking's
 * `TravelerDetail`, no OTP round-trip. Throws if the account has no
 * verified phone. Never writes to `User`.
 */
export function useUseAccountPhoneForBooking(bookingId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiClient
        .post<{ data: TravelerDetailItem }>(`/bookings/${bookingId}/contact/use-account-phone`)
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all })
    },
  })
}
