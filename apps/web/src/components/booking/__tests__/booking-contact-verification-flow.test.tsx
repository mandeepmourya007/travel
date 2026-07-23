import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { renderWithQuery } from '@/test/test-utils'
import { BookingContactVerificationFlow } from '../booking-contact-verification-flow'
import { API_BASE_URL as API } from '@/test/test-constants'
import { useAuthStore } from '@/store/auth.store'

const BOOKING_ID = 'booking-1'

describe('BookingContactVerificationFlow', () => {
  const onComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockSendSuccess() {
    server.use(
      // Mirrors the real backend's bookingContactSchema, which requires BOTH
      // name and phone on send-otp (not just phone) — regression guard for a
      // bug where the component only sent { phone }, silently passing here
      // because this handler didn't check the body until this assertion was
      // added.
      http.post(`${API}/bookings/${BOOKING_ID}/contact/send-otp`, async ({ request }) => {
        const body = (await request.json()) as { name?: string; phone?: string }
        if (!body.name || !body.phone) {
          return HttpResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed' } },
            { status: 400 },
          )
        }
        return HttpResponse.json({ success: true, data: { message: 'OTP sent', retryAfter: 30 } })
      }),
    )
  }

  describe('shortcut path (account phone already verified)', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: { id: 'u1', name: 'Jane', role: 'TRAVELER', phone: '9876543210', phoneVerified: true },
        accessToken: 'token',
        isAuthenticated: true,
        completedOnboarding: true,
        _hasHydrated: true,
      })
    })

    it('starts on the shortcut step showing the account phone', () => {
      renderWithQuery(
        <BookingContactVerificationFlow bookingId={BOOKING_ID} onComplete={onComplete} />,
      )

      expect(screen.getByText(/\+91 98765 43210/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /yes, use this number/i })).toBeInTheDocument()
    })

    it('"Yes, use this number" calls use-account-phone and fires onComplete', async () => {
      server.use(
        http.post(`${API}/bookings/${BOOKING_ID}/contact/use-account-phone`, () =>
          HttpResponse.json({
            success: true,
            data: { name: 'Jane', phone: '9876543210', phoneVerified: true, isPrimary: true },
          }),
        ),
      )
      const user = userEvent.setup()
      renderWithQuery(
        <BookingContactVerificationFlow bookingId={BOOKING_ID} onComplete={onComplete} />,
      )

      await user.click(screen.getByRole('button', { name: /yes, use this number/i }))

      await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    })

    it('"No, booking for someone else" transitions to the fresh name+phone step', async () => {
      const user = userEvent.setup()
      renderWithQuery(
        <BookingContactVerificationFlow bookingId={BOOKING_ID} onComplete={onComplete} />,
      )

      await user.click(screen.getByRole('button', { name: /booking for someone else/i }))

      expect(screen.getByLabelText(/contact name/i)).toBeInTheDocument()
      expect(onComplete).not.toHaveBeenCalled()
    })

    it('after "No", completing name + phone + OTP fires onComplete', async () => {
      mockSendSuccess()
      server.use(
        http.post(`${API}/bookings/${BOOKING_ID}/contact/verify-otp`, () =>
          HttpResponse.json({
            success: true,
            data: { name: 'Alex', phone: '9123456780', phoneVerified: true, isPrimary: true },
          }),
        ),
      )
      const user = userEvent.setup()
      renderWithQuery(
        <BookingContactVerificationFlow bookingId={BOOKING_ID} onComplete={onComplete} />,
      )

      await user.click(screen.getByRole('button', { name: /booking for someone else/i }))
      await user.type(screen.getByLabelText(/contact name/i), 'Alex')
      await user.type(screen.getByLabelText('Phone number'), '9123456780')
      await user.click(screen.getByRole('button', { name: /get otp/i }))

      await waitFor(() => screen.getByText(/whatsapp otp sent to/i))

      for (const digit of '1234') {
        await user.type(screen.getByLabelText(`Digit ${'1234'.indexOf(digit) + 1}`), digit)
      }

      await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    })
  })

  describe('fresh-phone path (account has no verified phone)', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: { id: 'u1', name: 'Jane', role: 'TRAVELER', phoneVerified: false },
        accessToken: 'token',
        isAuthenticated: true,
        completedOnboarding: true,
        _hasHydrated: true,
      })
    })

    it('starts directly on the phone step, skipping the shortcut', () => {
      renderWithQuery(
        <BookingContactVerificationFlow bookingId={BOOKING_ID} onComplete={onComplete} />,
      )

      expect(screen.queryByRole('button', { name: /yes, use this number/i })).not.toBeInTheDocument()
      expect(screen.getByLabelText(/contact name/i)).toBeInTheDocument()
    })

    it('shows both name and phone fields together, but blocks submission until a valid name is entered', async () => {
      // No send-otp handler registered — if the component incorrectly let the
      // submission through without a name, MSW would warn on an unhandled
      // request and the mutation would reject with a network error instead of
      // the expected "enter a valid contact name" validation message,
      // failing this test either way.
      const user = userEvent.setup()
      renderWithQuery(
        <BookingContactVerificationFlow bookingId={BOOKING_ID} onComplete={onComplete} />,
      )

      // Both fields are visible immediately — no need to type a name first
      expect(screen.getByLabelText(/contact name/i)).toBeInTheDocument()
      expect(screen.getByLabelText('Phone number')).toBeInTheDocument()

      await user.type(screen.getByLabelText('Phone number'), '9123456780')
      await user.click(screen.getByRole('button', { name: /get otp/i }))

      await waitFor(() => {
        expect(screen.getByText(/enter a valid contact name/i)).toBeInTheDocument()
      })
      // Never advanced past the phone step — confirms the OTP send was blocked
      expect(screen.queryByText(/whatsapp otp sent to/i)).not.toBeInTheDocument()
      expect(onComplete).not.toHaveBeenCalled()
    })

    it('happy path: name + phone + OTP verifies and fires onComplete', async () => {
      mockSendSuccess()
      server.use(
        http.post(`${API}/bookings/${BOOKING_ID}/contact/verify-otp`, () =>
          HttpResponse.json({
            success: true,
            data: { name: 'Jane', phone: '9876543210', phoneVerified: true, isPrimary: true },
          }),
        ),
      )
      const user = userEvent.setup()
      renderWithQuery(
        <BookingContactVerificationFlow bookingId={BOOKING_ID} onComplete={onComplete} />,
      )

      await user.type(screen.getByLabelText(/contact name/i), 'Jane')
      await waitFor(() => expect(screen.getByLabelText('Phone number')).toBeInTheDocument())
      await user.type(screen.getByLabelText('Phone number'), '9876543210')
      await user.click(screen.getByRole('button', { name: /get otp/i }))

      await waitFor(() => screen.getByText(/whatsapp otp sent to/i))

      for (const digit of '1234') {
        await user.type(screen.getByLabelText(`Digit ${'1234'.indexOf(digit) + 1}`), digit)
      }

      await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    })
  })

  it('never renders a dismiss/skip/cancel affordance in any step', async () => {
    useAuthStore.setState({
      user: { id: 'u1', name: 'Jane', role: 'TRAVELER', phone: '9876543210', phoneVerified: true },
      accessToken: 'token',
      isAuthenticated: true,
      completedOnboarding: true,
      _hasHydrated: true,
    })
    const user = userEvent.setup()
    renderWithQuery(
      <BookingContactVerificationFlow bookingId={BOOKING_ID} onComplete={onComplete} />,
    )

    // shortcut step
    expect(screen.queryByRole('button', { name: /cancel|skip|close|dismiss/i })).not.toBeInTheDocument()

    // phone step
    await user.click(screen.getByRole('button', { name: /booking for someone else/i }))
    expect(screen.queryByRole('button', { name: /cancel|skip|close|dismiss/i })).not.toBeInTheDocument()

    // otp step
    mockSendSuccess()
    await user.type(screen.getByLabelText(/contact name/i), 'Alex')
    await waitFor(() => expect(screen.getByLabelText('Phone number')).toBeInTheDocument())
    await user.type(screen.getByLabelText('Phone number'), '9123456780')
    await user.click(screen.getByRole('button', { name: /get otp/i }))
    await waitFor(() => screen.getByText(/whatsapp otp sent to/i))
    expect(screen.queryByRole('button', { name: /cancel|skip|close|dismiss/i })).not.toBeInTheDocument()
  })
})
