import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { renderWithQuery } from '@/test/test-utils'
import { OnboardingForm } from '../onboarding-form'

const mockUpdateUser = vi.fn()
vi.mock('@/store/auth.store', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: { id: 'u1', name: 'User', role: 'TRAVELER' },
      accessToken: 'test-jwt',
      isAuthenticated: true,
      _hasHydrated: true,
      setAuth: vi.fn(),
      updateUser: mockUpdateUser,
      markOnboardingComplete: vi.fn(),
      completedOnboarding: false,
      clearAuth: vi.fn(),
      setHasHydrated: vi.fn(),
    }),
}))

describe('OnboardingForm', () => {
  const onComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render name input and role selector', () => {
    renderWithQuery(<OnboardingForm onComplete={onComplete} />)

    expect(screen.getByTestId('onboarding-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('role-traveler')).toBeInTheDocument()
    expect(screen.getByTestId('role-organizer')).toBeInTheDocument()
  })

  it('should disable submit when name is empty', () => {
    renderWithQuery(<OnboardingForm onComplete={onComplete} />)

    expect(screen.getByTestId('onboarding-submit')).toBeDisabled()
  })

  it('should enable submit when name has 2+ chars', async () => {
    const user = userEvent.setup()
    renderWithQuery(<OnboardingForm onComplete={onComplete} />)

    await user.type(screen.getByTestId('onboarding-name-input'), 'AB')

    expect(screen.getByTestId('onboarding-submit')).toBeEnabled()
  })

  it('should show validation message for 1-char name', async () => {
    const user = userEvent.setup()
    renderWithQuery(<OnboardingForm onComplete={onComplete} />)

    await user.type(screen.getByTestId('onboarding-name-input'), 'A')

    expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument()
  })

  it('should select TRAVELER role by default', () => {
    renderWithQuery(<OnboardingForm onComplete={onComplete} />)

    const travelerBtn = screen.getByTestId('role-traveler')
    expect(travelerBtn.className).toContain('border-primary-500')
  })

  it('should toggle to ORGANIZER role on click', async () => {
    const user = userEvent.setup()
    renderWithQuery(<OnboardingForm onComplete={onComplete} />)

    await user.click(screen.getByTestId('role-organizer'))

    const organizerBtn = screen.getByTestId('role-organizer')
    expect(organizerBtn.className).toContain('border-primary-500')
  })

  it('should call onComplete and updateUser on successful submit', async () => {
    const user = userEvent.setup()
    renderWithQuery(<OnboardingForm onComplete={onComplete} />)

    await user.type(screen.getByTestId('onboarding-name-input'), 'Mandeep')
    await user.click(screen.getByTestId('onboarding-submit'))

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled()
    })
    expect(mockUpdateUser).toHaveBeenCalledWith({
      name: 'Mandeep',
      role: 'TRAVELER',
    })
  })

  it('should show error on API failure', async () => {
    server.use(
      http.patch('*/auth/profile', () => {
        return HttpResponse.json(
          { success: false, error: { message: 'Server error' } },
          { status: 500 },
        )
      }),
    )

    const user = userEvent.setup()
    renderWithQuery(<OnboardingForm onComplete={onComplete} />)

    await user.type(screen.getByTestId('onboarding-name-input'), 'Mandeep')
    await user.click(screen.getByTestId('onboarding-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-error')).toBeInTheDocument()
    })
    expect(onComplete).not.toHaveBeenCalled()
  })
})
