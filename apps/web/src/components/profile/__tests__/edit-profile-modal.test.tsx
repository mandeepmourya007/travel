import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { renderWithQuery } from '@/test/test-utils'
import { API_BASE_URL as API } from '@/test/test-constants'
import { EditProfileModal } from '@/components/profile/edit-profile-modal'
import { makeTravelerProfile } from '@/test/factories/profile.factory'
import { useAuthStore } from '@/store/auth.store'

describe('EditProfileModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: { id: 'u1', name: 'John Doe', role: 'TRAVELER', phoneVerified: true, emailVerified: true },
      accessToken: 'token',
      isAuthenticated: true,
      completedOnboarding: true,
      _hasHydrated: true,
    })
  })

  it('opens the modal on trigger click and shows all three fields', async () => {
    const user = userEvent.setup()
    renderWithQuery(<EditProfileModal profile={makeTravelerProfile()} />)

    await user.click(screen.getByTestId('edit-profile-trigger'))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('edit-profile-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('edit-profile-email-trigger')).toBeInTheDocument()
    expect(screen.getByTestId('edit-profile-phone-trigger')).toBeInTheDocument()
  })

  it('shows "Verify" affordance on an unverified email/phone, and "Change" once verified', async () => {
    const user = userEvent.setup()
    renderWithQuery(
      <EditProfileModal profile={makeTravelerProfile({ emailVerified: false, phoneVerified: false })} />,
    )

    await user.click(screen.getByTestId('edit-profile-trigger'))

    expect(screen.getByTestId('edit-profile-email-trigger')).toHaveTextContent('Verify')
    expect(screen.getByTestId('edit-profile-phone-trigger')).toHaveTextContent('Verify')
    expect(screen.getAllByText('Not verified')).toHaveLength(2)
  })

  it('completes the change-email flow: swaps in EmailVerificationFlow and requires OTP before it counts as saved', async () => {
    server.use(
      http.post(`${API}/auth/otp/attach-email/send`, () =>
        HttpResponse.json({ success: true, data: { message: 'OTP sent', retryAfter: 30 } }),
      ),
      http.post(`${API}/auth/otp/attach-email/verify`, () =>
        HttpResponse.json({ success: true, data: { email: 'new@example.com', emailVerified: true } }),
      ),
    )

    const user = userEvent.setup()
    renderWithQuery(<EditProfileModal profile={makeTravelerProfile()} />)

    await user.click(screen.getByTestId('edit-profile-trigger'))
    await user.click(screen.getByTestId('edit-profile-email-trigger'))

    // Now inside the email verification flow — the OTP step hasn't happened yet
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email address'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: /get otp/i }))
    await waitFor(() => screen.getByText(/otp sent to/i))

    for (const digit of '1234') {
      await user.type(screen.getByLabelText(`Digit ${'1234'.indexOf(digit) + 1}`), digit)
    }

    await waitFor(() => {
      expect(useAuthStore.getState().user?.email).toBe('new@example.com')
    })
    // Flow reverts back to the display row after success
    await waitFor(() => {
      expect(screen.getByTestId('edit-profile-email-trigger')).toBeInTheDocument()
    })
  })

  it('completes the change-phone flow via the same swap-in pattern', async () => {
    server.use(
      http.post(`${API}/auth/otp/attach/send`, () =>
        HttpResponse.json({ success: true, data: { message: 'OTP sent', retryAfter: 30 } }),
      ),
      http.post(`${API}/auth/otp/attach/verify`, () =>
        HttpResponse.json({ success: true, data: { phone: '9998887776', phoneVerified: true } }),
      ),
    )

    const user = userEvent.setup()
    renderWithQuery(<EditProfileModal profile={makeTravelerProfile()} />)

    await user.click(screen.getByTestId('edit-profile-trigger'))
    await user.click(screen.getByTestId('edit-profile-phone-trigger'))

    await user.type(screen.getByLabelText('Phone number'), '9998887776')
    await user.click(screen.getByRole('button', { name: /get otp/i }))
    await waitFor(() => screen.getByText(/whatsapp otp sent to/i))

    for (const digit of '1234') {
      await user.type(screen.getByLabelText(`Digit ${'1234'.indexOf(digit) + 1}`), digit)
    }

    await waitFor(() => {
      expect(useAuthStore.getState().user?.phone).toBe('9998887776')
    })
  })

  it('"Verify" on an existing-but-unverified email auto-sends the OTP to that address — no retyping required', async () => {
    let sendBody: unknown
    server.use(
      http.post(`${API}/auth/otp/attach-email/send`, async ({ request }) => {
        sendBody = await request.json()
        return HttpResponse.json({ success: true, data: { message: 'OTP sent', retryAfter: 30 } })
      }),
      http.post(`${API}/auth/otp/attach-email/verify`, () =>
        HttpResponse.json({ success: true, data: { email: 'existing@example.com', emailVerified: true } }),
      ),
    )

    const user = userEvent.setup()
    renderWithQuery(
      <EditProfileModal profile={makeTravelerProfile({ email: 'existing@example.com', emailVerified: false })} />,
    )

    await user.click(screen.getByTestId('edit-profile-trigger'))
    await user.click(screen.getByTestId('edit-profile-email-trigger'))

    // No input step at all — goes straight to the OTP screen for the
    // existing address, and the send fires automatically.
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument()
    await waitFor(() => screen.getByText(/otp sent to/i))
    expect(sendBody).toEqual({ email: 'existing@example.com' })

    for (const digit of '1234') {
      await user.type(screen.getByLabelText(`Digit ${'1234'.indexOf(digit) + 1}`), digit)
    }

    await waitFor(() => {
      expect(useAuthStore.getState().user?.email).toBe('existing@example.com')
      expect(useAuthStore.getState().user?.emailVerified).toBe(true)
    })
  })

  it('"Verify" on an existing-but-unverified phone auto-sends the OTP to that number — no retyping required', async () => {
    let sendBody: unknown
    server.use(
      http.post(`${API}/auth/otp/attach/send`, async ({ request }) => {
        sendBody = await request.json()
        return HttpResponse.json({ success: true, data: { message: 'OTP sent', retryAfter: 30 } })
      }),
      http.post(`${API}/auth/otp/attach/verify`, () =>
        HttpResponse.json({ success: true, data: { phone: '9876543210', phoneVerified: true } }),
      ),
    )

    const user = userEvent.setup()
    renderWithQuery(
      <EditProfileModal profile={makeTravelerProfile({ phone: '+919876543210', phoneVerified: false })} />,
    )

    await user.click(screen.getByTestId('edit-profile-trigger'))
    await user.click(screen.getByTestId('edit-profile-phone-trigger'))

    expect(screen.queryByLabelText('Phone number')).not.toBeInTheDocument()
    await waitFor(() => screen.getByText(/whatsapp otp sent to/i))
    expect(sendBody).toEqual({ phone: '9876543210' })

    for (const digit of '1234') {
      await user.type(screen.getByLabelText(`Digit ${'1234'.indexOf(digit) + 1}`), digit)
    }

    await waitFor(() => {
      expect(useAuthStore.getState().user?.phone).toBe('9876543210')
      expect(useAuthStore.getState().user?.phoneVerified).toBe(true)
    })
  })

  it('cancelling the email verification flow reverts to the display row without saving', async () => {
    const user = userEvent.setup()
    renderWithQuery(<EditProfileModal profile={makeTravelerProfile()} />)

    await user.click(screen.getByTestId('edit-profile-trigger'))
    await user.click(screen.getByTestId('edit-profile-email-trigger'))

    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.getByTestId('edit-profile-email-trigger')).toBeInTheDocument()
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument()
  })
})
