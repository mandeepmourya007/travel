import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { renderWithQuery } from '@/test/test-utils'
import { EmailVerificationFlow } from '../email-verification-flow'
import { API_BASE_URL as API } from '@/test/test-constants'
import { useAuthStore } from '@/store/auth.store'

describe('EmailVerificationFlow', () => {
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
      http.post(`${API}/auth/otp/attach-email/send`, () =>
        HttpResponse.json({ success: true, data: { message: 'OTP sent', retryAfter: 30 } }),
      ),
    )
  }

  it('advances from email step to otp step on successful send', async () => {
    mockSendSuccess()
    const user = userEvent.setup()
    renderWithQuery(<EmailVerificationFlow onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Email address'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: /get otp/i }))

    await waitFor(() => {
      expect(screen.getByText(/otp sent to/i)).toBeInTheDocument()
    })
  })

  it('on verify success calls updateUser (not setAuth) and fires onSuccess', async () => {
    mockSendSuccess()
    server.use(
      http.post(`${API}/auth/otp/attach-email/verify`, () =>
        HttpResponse.json({
          success: true,
          data: { email: 'new@example.com', emailVerified: true },
        }),
      ),
    )

    const user = userEvent.setup()
    renderWithQuery(<EmailVerificationFlow onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Email address'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: /get otp/i }))
    await waitFor(() => screen.getByText(/otp sent to/i))

    for (const digit of '1234') {
      await user.type(screen.getByLabelText(`Digit ${'1234'.indexOf(digit) + 1}`), digit)
    }

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    // Session preserved: token unchanged, only user.email merged in
    expect(useAuthStore.getState().accessToken).toBe('token')
    expect(useAuthStore.getState().user?.email).toBe('new@example.com')
  })

  it('surfaces a duplicate-email (409) error through the otp form error display', async () => {
    mockSendSuccess()
    server.use(
      http.post(`${API}/auth/otp/attach-email/verify`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { message: 'This email is already linked to another account.', code: 'CONFLICT', subCode: 'EMAIL_TAKEN' },
          },
          { status: 409 },
        ),
      ),
    )

    const user = userEvent.setup()
    renderWithQuery(<EmailVerificationFlow onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Email address'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: /get otp/i }))
    await waitFor(() => screen.getByText(/otp sent to/i))

    for (const digit of '1234') {
      await user.type(screen.getByLabelText(`Digit ${'1234'.indexOf(digit) + 1}`), digit)
    }

    await waitFor(() => {
      expect(screen.getByText(/already linked to another account/i)).toBeInTheDocument()
    })
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('renders a Cancel affordance only when onCancel is provided', () => {
    const onCancel = vi.fn()
    const { rerender } = renderWithQuery(<EmailVerificationFlow onSuccess={onSuccess} />)
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()

    rerender(<EmailVerificationFlow onSuccess={onSuccess} onCancel={onCancel} />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })
})
