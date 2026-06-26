import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { renderWithQuery } from '@/test/test-utils'
import { API_BASE_URL as API } from '@/test/test-constants'
import EmailLoginPage from '../page'

const mockRouterReplace = vi.fn()
const mockRouterPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush }),
  useSearchParams: () => new URLSearchParams(),
}))

const { mockSetAuth, mockMarkOnboardingComplete, mockState } = vi.hoisted(() => {
  const mockSetAuth = vi.fn()
  const mockMarkOnboardingComplete = vi.fn()
  const mockState = () => ({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    completedOnboarding: false,
    _hasHydrated: true,
    setAuth: mockSetAuth,
    markOnboardingComplete: mockMarkOnboardingComplete,
    clearAuth: vi.fn(),
    setHasHydrated: vi.fn(),
    updateUser: vi.fn(),
  })
  return { mockSetAuth, mockMarkOnboardingComplete, mockState }
})

vi.mock('@/store/auth.store', () => {
  const store = (selector: (s: ReturnType<typeof mockState>) => unknown) =>
    selector(mockState())
  store.getState = mockState
  return { useAuthStore: store }
})

vi.mock('@/store/loading.store', () => ({
  useLoadingStore: { getState: () => ({ show: vi.fn(), hide: vi.fn() }) },
}))

vi.mock('@/components/auth/google-auth-section', () => ({
  GoogleAuthSection: ({ onInitiate, onSuccess, onError }: {
    onInitiate?: () => void
    onSuccess: (isNewUser: boolean) => void
    onError?: () => void
  }) => (
    <div>
      <button data-testid="google-initiate" onClick={onInitiate}>Google</button>
      <button data-testid="google-success" onClick={() => onSuccess(false)}>Google Success</button>
      <button data-testid="google-error" onClick={onError}>Google Error</button>
    </div>
  ),
}))

function render() {
  return renderWithQuery(<EmailLoginPage />)
}

describe('EmailLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  // ─── Rendering ───────────────────────────────────────────

  it('renders the form when not authenticated', () => {
    render()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders signup and OTP links', () => {
    render()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /login with email otp/i })).toBeInTheDocument()
  })

  // ─── Suspense / no loader stuck ──────────────────────────

  it('does not show infinite spinner — form is visible immediately', () => {
    render()
    // The form must render; if Suspense were stuck, these would not be found
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  // ─── Validation ──────────────────────────────────────────

  it('shows field errors on empty submit', async () => {
    const user = userEvent.setup()
    render()
    // Provide a valid password so HTML5 `required` passes, then bypass
    // type="email" native validation with fireEvent.submit to reach handleSubmit.
    await user.type(screen.getByLabelText(/password/i), 'password123')
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument()
    })
  })

  it('shows error for invalid email format', async () => {
    const user = userEvent.setup()
    render()
    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    // fireEvent.submit bypasses browser email-format constraint validation so
    // handleSubmit runs and zod surfaces the error.
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument()
    })
  })

  // ─── Successful login ─────────────────────────────────────

  it('calls setAuth and navigates on successful login', async () => {
    const user = userEvent.setup()
    render()

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' }),
        'test-jwt',
      )
    })
    expect(mockMarkOnboardingComplete).toHaveBeenCalled()
    expect(mockRouterPush).toHaveBeenCalled()
  })

  // ─── Failed login ─────────────────────────────────────────

  it('shows error message on login failure', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { success: false, error: { message: 'Invalid credentials' } },
          { status: 401 },
        ),
      ),
    )

    const user = userEvent.setup()
    render()

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
    expect(mockSetAuth).not.toHaveBeenCalled()
  })

  it('shows generic error message on server error', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    )

    const user = userEvent.setup()
    render()

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // api-client surfaces 5xx as 'Something went wrong. Please try again.'
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  // ─── Google pending state ─────────────────────────────────

  it('does not show spinner when google_auth_pending is stale (>30s old)', () => {
    // Simulate a stale pending key from a previous failed Google attempt
    sessionStorage.setItem('google_auth_pending', String(Date.now() - 31_000))
    render()
    // Form should render — stale key is cleared on mount
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('shows spinner when google_auth_pending is fresh', () => {
    sessionStorage.setItem('google_auth_pending', String(Date.now()))
    render()
    expect(screen.queryByLabelText(/email/i)).toBeNull()
    expect(document.querySelector('.spinner')).toBeInTheDocument()
  })

  it('sets google_auth_pending in sessionStorage on Google initiate', async () => {
    const user = userEvent.setup()
    render()
    await user.click(screen.getByTestId('google-initiate'))
    expect(sessionStorage.getItem('google_auth_pending')).not.toBeNull()
  })

  it('clears google_auth_pending on Google error', async () => {
    const user = userEvent.setup()
    render()
    // Form is visible (no pending state). Set the key manually to simulate a
    // previous initiate, then trigger onError — clearGooglePending() must remove it.
    sessionStorage.setItem('google_auth_pending', String(Date.now()))
    await user.click(screen.getByTestId('google-error'))
    expect(sessionStorage.getItem('google_auth_pending')).toBeNull()
  })
})
