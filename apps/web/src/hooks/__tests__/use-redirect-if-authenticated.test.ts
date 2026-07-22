import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRedirectIfAuthenticated } from '../use-redirect-if-authenticated'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

interface MockAuthState {
  isAuthenticated: boolean
  _hasHydrated: boolean
  completedOnboarding: boolean
  user?: { role?: string; phoneVerified?: boolean } | null
}

const { mockUseAuthStore, setAuthState } = vi.hoisted(() => {
  const mockUseAuthStore = vi.fn() as ReturnType<typeof vi.fn> & { getState: () => MockAuthState }
  let state: MockAuthState = { isAuthenticated: false, _hasHydrated: false, completedOnboarding: false }
  mockUseAuthStore.getState = () => state
  const setAuthState = (next: MockAuthState) => {
    state = next
    mockUseAuthStore.mockImplementation((selector: (s: MockAuthState) => unknown) => selector(state))
  }
  return { mockUseAuthStore, setAuthState }
})

vi.mock('@/store/auth.store', () => ({
  useAuthStore: mockUseAuthStore,
}))

describe('useRedirectIfAuthenticated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing while not hydrated', () => {
    setAuthState({ isAuthenticated: true, _hasHydrated: false, completedOnboarding: true, user: { phoneVerified: true } })

    renderHook(() => useRedirectIfAuthenticated())

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does nothing when not authenticated', () => {
    setAuthState({ isAuthenticated: false, _hasHydrated: true, completedOnboarding: false })

    renderHook(() => useRedirectIfAuthenticated())

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does not redirect while onboarding is incomplete (default requireOnboarded: true)', () => {
    setAuthState({ isAuthenticated: true, _hasHydrated: true, completedOnboarding: false, user: { phoneVerified: true } })

    renderHook(() => useRedirectIfAuthenticated())

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects via getPostAuthRoute once authenticated, hydrated, and onboarded', () => {
    setAuthState({ isAuthenticated: true, _hasHydrated: true, completedOnboarding: true, user: { role: 'TRAVELER', phoneVerified: true } })

    renderHook(() => useRedirectIfAuthenticated())

    expect(mockReplace).toHaveBeenCalledWith('/trips')
  })

  it('redirects to /verify-phone when authenticated but not phone-verified', () => {
    setAuthState({ isAuthenticated: true, _hasHydrated: true, completedOnboarding: true, user: { role: 'TRAVELER', phoneVerified: false } })

    renderHook(() => useRedirectIfAuthenticated())

    expect(mockReplace).toHaveBeenCalledWith('/verify-phone')
  })

  it('requireOnboarded: false redirects even when onboarding is incomplete', () => {
    setAuthState({ isAuthenticated: true, _hasHydrated: true, completedOnboarding: false, user: { role: 'ORGANIZER', phoneVerified: true } })

    renderHook(() => useRedirectIfAuthenticated({ requireOnboarded: false }))

    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('passes returnTo through to getPostAuthRoute for a verified, onboarded user', () => {
    setAuthState({ isAuthenticated: true, _hasHydrated: true, completedOnboarding: true, user: { role: 'TRAVELER', phoneVerified: true } })

    renderHook(() => useRedirectIfAuthenticated({ returnTo: '/wallet' }))

    expect(mockReplace).toHaveBeenCalledWith('/wallet')
  })
})
