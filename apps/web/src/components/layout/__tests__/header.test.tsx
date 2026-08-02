import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}))

// Mutable auth state — tests below flip role/isAuthenticated per-case, mirroring
// the mockIsProduction pattern further down (module-level mocks can't be swapped
// per-test with vi.stubEnv/plain values since the mock factory runs once).
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

vi.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: undefined }),
}))

vi.mock('@/hooks/use-logout', () => ({
  useLogout: () => ({ logout: vi.fn(), loggingOut: false }),
}))

vi.mock('@/components/notifications/notification-bell', () => ({
  NotificationBell: () => null,
}))

// isProduction is a module-load-time constant computed from
// process.env.NODE_ENV, so it can't be flipped with vi.stubEnv after import —
// the binding is already resolved. Mocking the module directly lets each test
// control the branch without reaching for vi.resetModules()/dynamic import.
const { mockIsProduction } = vi.hoisted(() => ({ mockIsProduction: { value: false } }))

vi.mock('@/lib/constants', () => ({
  APP_NAME: 'Safarnama',
  get isProduction() {
    return mockIsProduction.value
  },
}))

describe('Header logo branding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockIsProduction.value = false
  })

  it('renders the prod wordmark and hides the app-name text in production', async () => {
    mockIsProduction.value = true
    const { Header } = await import('../header')

    const { container } = render(<Header />)

    // alt="" + aria-hidden gives the <img> ARIA role "presentation", not "img" —
    // query the DOM node directly rather than by role.
    const logo = container.querySelector('img')
    expect(logo).toHaveAttribute('src', '/logo-prod.svg')
    expect(screen.queryByText('Safarnama')).not.toBeInTheDocument()
  })

  it('renders the dev logo and the app-name text outside production', async () => {
    mockIsProduction.value = false
    const { Header } = await import('../header')

    const { container } = render(<Header />)

    const logo = container.querySelector('img')
    expect(logo).toHaveAttribute('src', '/logo.svg')
    expect(screen.getByText('Safarnama')).toBeInTheDocument()
  })
})

describe('My Account nav dropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockAuthState.isAuthenticated = false
    mockAuthState.user = undefined
    mockAuthState._hasHydrated = false
  })

  it('shows a single "My Account" dropdown trigger for a traveler, and hides the standalone Messages link', async () => {
    mockAuthState.isAuthenticated = true
    mockAuthState._hasHydrated = true
    mockAuthState.user = { id: 'u1', name: 'Test Traveler', role: 'TRAVELER' }
    const { Header } = await import('../header')

    render(<Header />)

    expect(screen.getByRole('button', { name: /my account/i })).toBeInTheDocument()
    // No direct Bookings/Reviews/Messages links — only reachable via the dropdown.
    expect(screen.queryByRole('link', { name: 'My Bookings' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My Reviews' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^messages$/i })).not.toBeInTheDocument()
  })

  it('opens the dropdown and lists links to bookings, reviews, and messages', async () => {
    mockAuthState.isAuthenticated = true
    mockAuthState._hasHydrated = true
    mockAuthState.user = { id: 'u1', name: 'Test Traveler', role: 'TRAVELER' }
    const user = userEvent.setup()
    const { Header } = await import('../header')

    render(<Header />)
    await user.click(screen.getByRole('button', { name: /my account/i }))

    expect(screen.getByRole('menuitem', { name: 'My Bookings' })).toHaveAttribute('href', '/my-bookings')
    expect(screen.getByRole('menuitem', { name: 'My Reviews' })).toHaveAttribute('href', '/my-reviews')
    expect(screen.getByRole('menuitem', { name: 'My Messages' })).toHaveAttribute('href', '/messages')
  })

  it('hides the My Account dropdown for an organizer and shows a direct Messages link instead', async () => {
    mockAuthState.isAuthenticated = true
    mockAuthState._hasHydrated = true
    mockAuthState.user = { id: 'o1', name: 'Test Organizer', role: 'ORGANIZER' }
    const { Header } = await import('../header')

    render(<Header />)

    expect(screen.queryByRole('button', { name: /my account/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^messages$/i })).toHaveAttribute('href', '/messages')
  })
})
