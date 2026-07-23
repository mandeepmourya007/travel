import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { renderWithQuery } from '@/test/test-utils'
import { PhoneVerificationFlow } from '../phone-verification-flow'
import { API_BASE_URL as API } from '@/test/test-constants'
import { useAuthStore } from '@/store/auth.store'

describe('PhoneVerificationFlow', () => {
  const onSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: { id: 'u1', name: 'Jane', role: 'TRAVELER', phoneVerified: false },
      accessToken: 'token',
      isAuthenticated: true,
      completedOnboarding: true,
      _hasHydrated: true,
    })
  })

  function mockSendSuccess() {
    server.use(
      http.post(`${API}/auth/otp/attach/send`, () =>
        HttpResponse.json({ success: true, data: { message: 'OTP sent', retryAfter: 30 } }),
      ),
    )
  }

  it('advances from phone step to otp step on successful send', async () => {
    mockSendSuccess()
    const user = userEvent.setup()
    renderWithQuery(<PhoneVerificationFlow onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Phone number'), '9876543210')
    await user.click(screen.getByRole('button', { name: /get otp/i }))

    await waitFor(() => {
      expect(screen.getByText(/whatsapp otp sent to/i)).toBeInTheDocument()
    })
  })

  it('on verify success calls updateUser (not setAuth) and fires onSuccess', async () => {
    mockSendSuccess()
    server.use(
      http.post(`${API}/auth/otp/attach/verify`, () =>
        HttpResponse.json({
          success: true,
          data: { phone: '9876543210', phoneVerified: true },
        }),
      ),
    )

    const user = userEvent.setup()
    renderWithQuery(<PhoneVerificationFlow onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Phone number'), '9876543210')
    await user.click(screen.getByRole('button', { name: /get otp/i }))
    await waitFor(() => screen.getByText(/whatsapp otp sent to/i))

    for (const digit of '1234') {
      await user.type(screen.getByLabelText(`Digit ${'1234'.indexOf(digit) + 1}`), digit)
    }

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    // Session preserved: token unchanged, only user.phone/phoneVerified merged in
    expect(useAuthStore.getState().accessToken).toBe('token')
    expect(useAuthStore.getState().user?.phoneVerified).toBe(true)
    expect(useAuthStore.getState().user?.phone).toBe('9876543210')
  })

  it('surfaces a duplicate-phone (409) error through the otp form error display', async () => {
    mockSendSuccess()
    server.use(
      http.post(`${API}/auth/otp/attach/verify`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { message: 'This phone number is already registered to another account.', code: 'CONFLICT', subCode: 'PHONE_TAKEN' },
          },
          { status: 409 },
        ),
      ),
    )

    const user = userEvent.setup()
    renderWithQuery(<PhoneVerificationFlow onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Phone number'), '9876543210')
    await user.click(screen.getByRole('button', { name: /get otp/i }))
    await waitFor(() => screen.getByText(/whatsapp otp sent to/i))

    for (const digit of '1234') {
      await user.type(screen.getByLabelText(`Digit ${'1234'.indexOf(digit) + 1}`), digit)
    }

    await waitFor(() => {
      expect(screen.getByText(/already registered to another account/i)).toBeInTheDocument()
    })
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('renders a Cancel affordance only when onCancel is provided', () => {
    const onCancel = vi.fn()
    const { rerender } = renderWithQuery(<PhoneVerificationFlow onSuccess={onSuccess} />)
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()

    rerender(<PhoneVerificationFlow onSuccess={onSuccess} onCancel={onCancel} />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })
})
