import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  useSendBookingContactOtp,
  useVerifyBookingContactOtp,
  useUseAccountPhoneForBooking,
} from '../use-booking-contact'
import { useAuthStore } from '@/store/auth.store'
import { createTestQueryClient } from '@/test/test-utils'
import { server } from '@/test/mocks/server'
import { API_BASE_URL as API } from '@/test/test-constants'

const BOOKING_ID = 'booking-1'

function createWrapper() {
  const queryClient = createTestQueryClient()
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const Wrapper = function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { Wrapper, invalidateSpy }
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'test-token' })
})

afterEach(() => {
  useAuthStore.setState({ accessToken: null })
  vi.restoreAllMocks()
})

describe('useSendBookingContactOtp', () => {
  it('posts to /bookings/:id/contact/send-otp with the name and phone', async () => {
    let capturedBody: unknown
    server.use(
      http.post(`${API}/bookings/${BOOKING_ID}/contact/send-otp`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ success: true, data: { cooldownSeconds: 30 } })
      }),
    )
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useSendBookingContactOtp(BOOKING_ID), { wrapper: Wrapper })

    // Backend validates send-otp against the same bookingContactSchema as
    // verify-otp ({ name, phone }) — regression test for a bug where the
    // frontend only sent { phone }, which the backend rejected with a 400
    // "name Required" validation error.
    const data = await result.current.mutateAsync({ name: 'Shreya Kapoor', phone: '9876543210' })

    expect(capturedBody).toEqual({ name: 'Shreya Kapoor', phone: '9876543210' })
    expect(data).toEqual({ cooldownSeconds: 30 })
  })
})

describe('useVerifyBookingContactOtp', () => {
  it('posts to /bookings/:id/contact/verify-otp and invalidates bookingKeys.all', async () => {
    server.use(
      http.post(`${API}/bookings/${BOOKING_ID}/contact/verify-otp`, () =>
        HttpResponse.json({
          success: true,
          data: { name: 'Jane', phone: '9876543210', phoneVerified: true, isPrimary: true },
        }),
      ),
    )
    const { Wrapper, invalidateSpy } = createWrapper()
    const { result } = renderHook(() => useVerifyBookingContactOtp(BOOKING_ID), { wrapper: Wrapper })

    const data = await result.current.mutateAsync({ name: 'Jane', phone: '9876543210', otp: '1234' })

    expect(data.phoneVerified).toBe(true)
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled())
  })

  it('rejects on invalid OTP without invalidating the cache', async () => {
    server.use(
      http.post(`${API}/bookings/${BOOKING_ID}/contact/verify-otp`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'INVALID_OTP', message: 'Invalid OTP' } },
          { status: 400 },
        ),
      ),
    )
    const { Wrapper, invalidateSpy } = createWrapper()
    const { result } = renderHook(() => useVerifyBookingContactOtp(BOOKING_ID), { wrapper: Wrapper })

    await expect(
      result.current.mutateAsync({ name: 'Jane', phone: '9876543210', otp: '0000' }),
    ).rejects.toThrow()
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})

describe('useUseAccountPhoneForBooking', () => {
  it('posts to /bookings/:id/contact/use-account-phone with no body and invalidates bookingKeys.all', async () => {
    server.use(
      http.post(`${API}/bookings/${BOOKING_ID}/contact/use-account-phone`, () =>
        HttpResponse.json({
          success: true,
          data: { name: 'Jane', phone: '9876543210', phoneVerified: true, isPrimary: true },
        }),
      ),
    )
    const { Wrapper, invalidateSpy } = createWrapper()
    const { result } = renderHook(() => useUseAccountPhoneForBooking(BOOKING_ID), { wrapper: Wrapper })

    const data = await result.current.mutateAsync()

    expect(data.phoneVerified).toBe(true)
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled())
  })

  it('rejects when the account has no verified phone', async () => {
    server.use(
      http.post(`${API}/bookings/${BOOKING_ID}/contact/use-account-phone`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'No verified phone on account' } },
          { status: 400 },
        ),
      ),
    )
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useUseAccountPhoneForBooking(BOOKING_ID), { wrapper: Wrapper })

    await expect(result.current.mutateAsync()).rejects.toThrow()
  })
})
