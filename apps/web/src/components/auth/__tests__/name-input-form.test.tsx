import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { renderWithQuery } from '@/test/test-utils'
import { NameInputForm } from '../name-input-form'
import { API_BASE_URL as API } from '@/test/test-constants'

// Mock zustand store so useUpdateProfile's store selectors work
const { mockState } = vi.hoisted(() => {
  const mockState = () => ({
    user: { id: 'u1', name: 'User', role: 'TRAVELER' },
    accessToken: 'test-jwt',
    isAuthenticated: true,
    _hasHydrated: true,
    setAuth: vi.fn(),
    updateUser: vi.fn(),
    markOnboardingComplete: vi.fn(),
    completedOnboarding: true,
    clearAuth: vi.fn(),
    setHasHydrated: vi.fn(),
  })
  return { mockState }
})
vi.mock('@/store/auth.store', () => {
  const store = (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockState())
  store.getState = mockState
  return { useAuthStore: store }
})

describe('NameInputForm', () => {
  const onComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render name input with auto-focus', () => {
    renderWithQuery(<NameInputForm onComplete={onComplete} />)

    const input = screen.getByLabelText('Full name')
    expect(input).toBeInTheDocument()
    expect(input).toHaveFocus()
  })

  it('should disable "Continue" button when name is empty', () => {
    renderWithQuery(<NameInputForm onComplete={onComplete} />)

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('should enable "Continue" button when name has 2+ chars', async () => {
    const user = userEvent.setup()
    renderWithQuery(<NameInputForm onComplete={onComplete} />)

    await user.type(screen.getByLabelText('Full name'), 'AB')

    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
  })

  it('should show spinner on button during API call (isPending)', async () => {
    server.use(
      http.patch(`${API}/auth/profile`, async () => {
        await new Promise((r) => setTimeout(r, 200))
        return HttpResponse.json({ success: true, data: { id: 'u1', name: 'Mandeep' } })
      }),
    )

    const user = userEvent.setup()
    renderWithQuery(<NameInputForm onComplete={onComplete} />)

    await user.type(screen.getByLabelText('Full name'), 'Mandeep')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(screen.getByText(/saving/i)).toBeInTheDocument()

    // Drain the delayed response before the test ends — otherwise the 200ms
    // timer and its onComplete() continuation keep running in the background
    // (pool: 'forks' runs this whole file in one process) and can land inside
    // a LATER test in this file once it finally resolves, polluting the shared
    // `onComplete` mock's call count under full-suite load. This is what caused
    // "should show error when API fails" to flake intermittently.
    await waitFor(() => expect(screen.queryByText(/saving/i)).not.toBeInTheDocument())
  })

  it('should call onComplete() callback on success', async () => {
    const user = userEvent.setup()
    renderWithQuery(<NameInputForm onComplete={onComplete} />)

    await user.type(screen.getByLabelText('Full name'), 'Mandeep Mourya')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled()
    })
  })

  it('should keep button disabled when name is only 1 char', async () => {
    const user = userEvent.setup()
    renderWithQuery(<NameInputForm onComplete={onComplete} />)

    await user.type(screen.getByLabelText('Full name'), 'A')

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('should show error when API fails', async () => {
    server.use(
      http.patch(`${API}/auth/profile`, () => {
        return HttpResponse.json(
          { success: false, error: { message: 'Server error' } },
          { status: 500 },
        )
      }),
    )

    const user = userEvent.setup()
    renderWithQuery(<NameInputForm onComplete={onComplete} />)

    await user.type(screen.getByLabelText('Full name'), 'Mandeep')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    })
    expect(onComplete).not.toHaveBeenCalled()
  })
})
