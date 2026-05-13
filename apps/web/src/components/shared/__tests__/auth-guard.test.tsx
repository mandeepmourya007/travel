import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthGuard } from '../auth-guard'

const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

// We mock the entire auth store module.
// Each test overrides the selector return via mockReturnValue.
const mockUseAuthStore = vi.fn()
vi.mock('@/store/auth.store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => mockUseAuthStore(selector),
}))

function setAuthState(state: { isAuthenticated: boolean; _hasHydrated: boolean }) {
  mockUseAuthStore.mockImplementation((selector: (s: typeof state) => unknown) => selector(state))
}

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows spinner while hydrating', () => {
    setAuthState({ isAuthenticated: false, _hasHydrated: false })

    render(
      <AuthGuard>
        <p>Protected</p>
      </AuthGuard>,
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Protected')).not.toBeInTheDocument()
  })

  it('renders children when authenticated and hydrated', () => {
    setAuthState({ isAuthenticated: true, _hasHydrated: true })

    render(
      <AuthGuard>
        <p>Protected</p>
      </AuthGuard>,
    )

    expect(screen.getByText('Protected')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('redirects to /login/email when hydrated but not authenticated', () => {
    setAuthState({ isAuthenticated: false, _hasHydrated: true })

    render(
      <AuthGuard>
        <p>Protected</p>
      </AuthGuard>,
    )

    expect(mockReplace).toHaveBeenCalledWith('/login/email')
    expect(screen.queryByText('Protected')).not.toBeInTheDocument()
  })

  it('does not redirect while still hydrating', () => {
    setAuthState({ isAuthenticated: false, _hasHydrated: false })

    render(
      <AuthGuard>
        <p>Protected</p>
      </AuthGuard>,
    )

    expect(mockReplace).not.toHaveBeenCalled()
  })
})
