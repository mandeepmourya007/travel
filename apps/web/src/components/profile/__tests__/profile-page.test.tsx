import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { renderWithQuery } from '@/test/test-utils'
import { makeTravelerProfile, makeOrganizerFullProfile } from '@/test/factories/profile.factory'
import ProfilePage from '@/app/profile/page'
import { API_BASE_URL as API } from '@/test/test-constants'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const { mockUpdateUser, mockState } = vi.hoisted(() => {
  const mockUpdateUser = vi.fn()
  const mockState = () => ({
    user: { id: 'u1', name: 'John Doe', role: 'TRAVELER' },
    accessToken: 'test-jwt',
    isAuthenticated: true,
    _hasHydrated: true,
    setAuth: vi.fn(),
    updateUser: mockUpdateUser,
    markOnboardingComplete: vi.fn(),
    completedOnboarding: true,
    clearAuth: vi.fn(),
    setHasHydrated: vi.fn(),
  })
  return { mockUpdateUser, mockState }
})
vi.mock('@/store/auth.store', () => {
  const store = (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockState())
  store.getState = mockState
  return { useAuthStore: store }
})

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Loading state ───────────────────────────────────

  it('should show skeleton while loading', () => {
    // Delay the response so skeleton stays visible
    server.use(
      http.get(`${API}/auth/profile`, async () => {
        await new Promise((r) => setTimeout(r, 200))
        return HttpResponse.json({ success: true, data: makeTravelerProfile() })
      }),
    )

    renderWithQuery(<ProfilePage />)

    expect(document.querySelector('.skeleton')).toBeInTheDocument()
  })

  // ── Error state ─────────────────────────────────────

  it('should show error state when API fails', async () => {
    server.use(
      http.get(`${API}/auth/profile`, () => {
        return HttpResponse.json(
          { success: false, error: { message: 'Server error' } },
          { status: 500 },
        )
      }),
    )

    renderWithQuery(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load profile')).toBeInTheDocument()
    })
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  // ── Traveler profile data state ─────────────────────

  it('should render traveler profile without organizer card', async () => {
    server.use(
      http.get(`${API}/auth/profile`, () => {
        return HttpResponse.json({ success: true, data: makeTravelerProfile() })
      }),
    )

    renderWithQuery(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByTestId('profile-header')).toBeInTheDocument()
    })
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('TRAVELER')).toBeInTheDocument()
    expect(screen.queryByTestId('organizer-profile-card')).not.toBeInTheDocument()
  })

  // ── Organizer profile data state ────────────────────

  it('should render organizer profile with organizer card', async () => {
    server.use(
      http.get(`${API}/auth/profile`, () => {
        return HttpResponse.json({ success: true, data: makeOrganizerFullProfile() })
      }),
    )

    renderWithQuery(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByTestId('organizer-profile-card')).toBeInTheDocument()
    })
    expect(screen.getByText('Trek India Adventures')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
  })

  // ── Edit user profile form ──────────────────────────

  it('should disable save button when no changes made', async () => {
    server.use(
      http.get(`${API}/auth/profile`, () => {
        return HttpResponse.json({ success: true, data: makeTravelerProfile() })
      }),
    )

    renderWithQuery(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByTestId('profile-save-btn')).toBeDisabled()
    })
  })

  it('should enable save button when name changes', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API}/auth/profile`, () => {
        return HttpResponse.json({ success: true, data: makeTravelerProfile() })
      }),
    )

    renderWithQuery(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByTestId('profile-name-input')).toBeInTheDocument()
    })

    await user.clear(screen.getByTestId('profile-name-input'))
    await user.type(screen.getByTestId('profile-name-input'), 'Updated Name')

    expect(screen.getByTestId('profile-save-btn')).toBeEnabled()
  })

  it('should call API and update store on successful save', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API}/auth/profile`, () => {
        return HttpResponse.json({ success: true, data: makeTravelerProfile() })
      }),
    )

    renderWithQuery(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByTestId('profile-name-input')).toBeInTheDocument()
    })

    await user.clear(screen.getByTestId('profile-name-input'))
    await user.type(screen.getByTestId('profile-name-input'), 'Updated Name')
    await user.click(screen.getByTestId('profile-save-btn'))

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalled()
    })
  })

  it('should show error message when save fails', async () => {
    server.use(
      http.get(`${API}/auth/profile`, () => {
        return HttpResponse.json({ success: true, data: makeTravelerProfile() })
      }),
      http.patch(`${API}/auth/profile`, () => {
        return HttpResponse.json(
          { success: false, error: { message: 'Update failed' } },
          { status: 500 },
        )
      }),
    )

    const user = userEvent.setup()
    renderWithQuery(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByTestId('profile-name-input')).toBeInTheDocument()
    })

    await user.clear(screen.getByTestId('profile-name-input'))
    await user.type(screen.getByTestId('profile-name-input'), 'Updated Name')
    await user.click(screen.getByTestId('profile-save-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('profile-save-error')).toBeInTheDocument()
    })
  })

  // ── Read-only fields ────────────────────────────────

  it('should display email and phone as read-only', async () => {
    server.use(
      http.get(`${API}/auth/profile`, () => {
        return HttpResponse.json({ success: true, data: makeTravelerProfile() })
      }),
    )

    renderWithQuery(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
    })
    expect(screen.getByText('9876543210')).toBeInTheDocument()
  })
})
