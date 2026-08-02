import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

// Mutable auth state — tests below flip role/isAuthenticated per-case since the
// mock factory only runs once (see header.test.tsx for the same pattern).
const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    isAuthenticated: false,
    user: undefined as { id: string; name: string; role: string } | undefined,
    _hasHydrated: false,
  },
}))

vi.mock('@/store/auth.store', () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}))

const { mockProfile } = vi.hoisted(() => ({
  mockProfile: { data: undefined as { isReseller?: boolean } | undefined },
}))

vi.mock('@/hooks/use-profile', () => ({
  useProfile: () => mockProfile,
}))

describe('MobileBottomNav — My Account dropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockAuthState.isAuthenticated = false
    mockAuthState.user = undefined
    mockAuthState._hasHydrated = false
    mockProfile.data = undefined
  })

  it('shows the guest nav (no My Account entry) when not authenticated', async () => {
    const { MobileBottomNav } = await import('../mobile-bottom-nav')

    render(<MobileBottomNav />)

    expect(screen.queryByRole('button', { name: /my account/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows a single "My Account" dropdown trigger for a traveler instead of separate Bookings/Messages tabs', async () => {
    mockAuthState.isAuthenticated = true
    mockAuthState._hasHydrated = true
    mockAuthState.user = { id: 'u1', name: 'Test Traveler', role: 'TRAVELER' }
    const { MobileBottomNav } = await import('../mobile-bottom-nav')

    render(<MobileBottomNav />)

    expect(screen.getByRole('button', { name: /my account/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^bookings$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^messages$/i })).not.toBeInTheDocument()
  })

  it('opens the dropdown and lists links to bookings, reviews, and messages', async () => {
    mockAuthState.isAuthenticated = true
    mockAuthState._hasHydrated = true
    mockAuthState.user = { id: 'u1', name: 'Test Traveler', role: 'TRAVELER' }
    const user = userEvent.setup()
    const { MobileBottomNav } = await import('../mobile-bottom-nav')

    render(<MobileBottomNav />)
    await user.click(screen.getByRole('button', { name: /my account/i }))

    expect(screen.getByRole('menuitem', { name: 'My Bookings' })).toHaveAttribute('href', '/my-bookings')
    expect(screen.getByRole('menuitem', { name: 'My Reviews' })).toHaveAttribute('href', '/my-reviews')
    expect(screen.getByRole('menuitem', { name: 'My Messages' })).toHaveAttribute('href', '/messages')
  })

  it('shows the organizer nav with a direct Messages link (no My Account dropdown)', async () => {
    mockAuthState.isAuthenticated = true
    mockAuthState._hasHydrated = true
    mockAuthState.user = { id: 'o1', name: 'Test Organizer', role: 'ORGANIZER' }
    const { MobileBottomNav } = await import('../mobile-bottom-nav')

    render(<MobileBottomNav />)

    expect(screen.queryByRole('button', { name: /my account/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^messages$/i })).toHaveAttribute('href', '/messages')
  })
})
