import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}))

vi.mock('@/store/auth.store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ isAuthenticated: false, user: undefined, _hasHydrated: false }),
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
