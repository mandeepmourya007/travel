import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryClientProvider } from '@tanstack/react-query'
import { server } from '@/test/mocks/server'
import { createTestQueryClient } from '@/test/test-utils'
import { API_BASE_URL as API } from '@/test/test-constants'
import { EditUserProfileForm } from '@/components/profile/edit-user-profile-form'
import { makeTravelerProfile } from '@/test/factories/profile.factory'
import { useAuthStore } from '@/store/auth.store'

function renderForm(profile = makeTravelerProfile({ phoneVerified: false })) {
  const queryClient = createTestQueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <EditUserProfileForm profile={profile} />
    </QueryClientProvider>,
  )
  return { queryClient }
}

describe('VerifyPhoneCta (via EditUserProfileForm)', () => {
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

  it('renders the CTA only when phone is not verified', () => {
    renderForm(makeTravelerProfile({ phoneVerified: false }))
    expect(screen.getByTestId('verify-phone-cta')).toBeInTheDocument()
  })

  it('does not render the CTA when phone is already verified', () => {
    renderForm(makeTravelerProfile({ phoneVerified: true }))
    expect(screen.queryByTestId('verify-phone-cta')).not.toBeInTheDocument()
  })

  it('opens the modal and completes the verify flow', async () => {
    server.use(
      http.post(`${API}/auth/otp/attach/send`, () =>
        HttpResponse.json({ success: true, data: { message: 'OTP sent', retryAfter: 30 } }),
      ),
      http.post(`${API}/auth/otp/attach/verify`, () =>
        HttpResponse.json({ success: true, data: { phone: '9876543210', phoneVerified: true } }),
      ),
    )

    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByTestId('verify-phone-cta'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Phone number'), '9876543210')
    await user.click(screen.getByRole('button', { name: /get otp/i }))
    await waitFor(() => screen.getByText(/whatsapp otp sent to/i))

    for (let i = 0; i < 4; i++) {
      await user.type(screen.getByLabelText(`Digit ${i + 1}`), String(i + 1))
    }

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(useAuthStore.getState().user?.phoneVerified).toBe(true)
  })
})
