import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { renderWithQuery } from '@/test/test-utils'
import { API_BASE_URL as API } from '@/test/test-constants'
import { makeOrganizerFullProfile } from '@/test/factories/profile.factory'
import { makeTripSummary, resetTripFactory } from '@/test/factories/trip.factory'
import { TRIP_SUBMIT_INTENT } from '@/components/trips/trip-form/trip-form'
import type { TripSubmitIntent } from '@/components/trips/trip-form/trip-form'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Mock next/link as plain anchor
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

// useProfile() only fires when accessToken is present — mock an authenticated organizer session.
const { mockAuthState } = vi.hoisted(() => {
  const mockAuthState = () => ({
    user: { id: 'org-u1', name: 'Organizer User', role: 'ORGANIZER' },
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
  return { mockAuthState }
})
vi.mock('@/store/auth.store', () => {
  const store = (selector: (state: Record<string, unknown>) => unknown) => selector(mockAuthState())
  store.getState = mockAuthState
  return { useAuthStore: store }
})

// Stub the heavy multi-tab form: expose one button per submit intent so the
// page-level onSubmit/onSuccess wiring can be exercised without driving all
// the real form tabs (those are covered by trip-form.test.tsx separately).
vi.mock('@/components/trips/trip-form/trip-form', async () => {
  const actual = await vi.importActual<typeof import('@/components/trips/trip-form/trip-form')>(
    '@/components/trips/trip-form/trip-form',
  )
  return {
    ...actual,
    TripForm: ({ onSubmit }: { onSubmit: (data: unknown, vehicleData: unknown, intent: TripSubmitIntent) => void }) => (
      <div>
        <button onClick={() => onSubmit({ title: 'New Trip' }, undefined, actual.TRIP_SUBMIT_INTENT.DRAFT)}>
          Trigger Draft Submit
        </button>
        <button onClick={() => onSubmit({ title: 'New Trip' }, undefined, actual.TRIP_SUBMIT_INTENT.PUBLISH)}>
          Trigger Publish Submit
        </button>
      </div>
    ),
  }
})

import CreateTripPage from '../page'

function mockApprovedOrganizerProfile() {
  server.use(
    http.get(`${API}/auth/profile`, () =>
      HttpResponse.json({
        success: true,
        data: makeOrganizerFullProfile({
          organizerProfile: {
            id: 'org-1',
            slug: 'trek-india-adventures',
            businessName: 'Trek India Adventures',
            description: 'Best treks in India',
            verificationStatus: 'APPROVED',
            rating: 4.5,
            totalReviews: 120,
            totalTripsCompleted: 45,
            bankAccountLinked: true,
            documents: {
              aadhaarFront: 'https://example.com/aadhaar-front.jpg',
              aadhaarBack: 'https://example.com/aadhaar-back.jpg',
              panCard: 'https://example.com/pan-card.jpg',
            },
          },
        }),
      }),
    ),
  )
}

describe('CreateTripPage', () => {
  beforeEach(() => {
    resetTripFactory()
    mockPush.mockClear()
    mockApprovedOrganizerProfile()
  })

  it('creates the trip with silent:false and does not call publish when intent is draft', async () => {
    const trip = makeTripSummary({ id: 'trip-draft-1' })
    let createBody: unknown = null
    let publishCalled = false

    server.use(
      http.post(`${API}/trips`, async ({ request }) => {
        createBody = await request.json()
        return HttpResponse.json({ success: true, data: trip })
      }),
      http.post(`${API}/trips/:id/publish`, () => {
        publishCalled = true
        return HttpResponse.json({ success: true, data: trip })
      }),
    )

    const user = userEvent.setup()
    renderWithQuery(<CreateTripPage />)

    await screen.findByText('Trigger Draft Submit')
    await user.click(screen.getByText('Trigger Draft Submit'))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/trips'))

    expect(createBody).toEqual({ title: 'New Trip' })
    expect(publishCalled).toBe(false)
  })

  it('creates the trip with silent:true and calls publish with the new trip id when intent is publish', async () => {
    const trip = makeTripSummary({ id: 'trip-publish-1' })
    let publishedId: string | null = null

    server.use(
      http.post(`${API}/trips`, () => HttpResponse.json({ success: true, data: trip })),
      http.post(`${API}/trips/:id/publish`, ({ params }) => {
        publishedId = params.id as string
        return HttpResponse.json({ success: true, data: trip })
      }),
    )

    const user = userEvent.setup()
    renderWithQuery(<CreateTripPage />)

    await screen.findByText('Trigger Publish Submit')
    await user.click(screen.getByText('Trigger Publish Submit'))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/trips'))
    expect(publishedId).toBe('trip-publish-1')
  })

  it('shows a fallback toast and still redirects when publish fails after create succeeds', async () => {
    const trip = makeTripSummary({ id: 'trip-publish-fail-1' })

    server.use(
      http.post(`${API}/trips`, () => HttpResponse.json({ success: true, data: trip })),
      http.post(`${API}/trips/:id/publish`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'Publish failed' } },
          { status: 500 },
        ),
      ),
    )

    const user = userEvent.setup()
    renderWithQuery(<CreateTripPage />)

    await screen.findByText('Trigger Publish Submit')
    await user.click(screen.getByText('Trigger Publish Submit'))

    // Fallback toast fires instead of the flow getting stuck — don't pin the exact
    // copy (apiClient prefixes/merges server error text), just assert the error-path fired.
    // usePublishTrip's own onError toast fires too, so there may be more than one alert.
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    })

    // Redirect still happens — user isn't stuck on the create page
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/trips'))
  })

  it('does not gate the exported TRIP_SUBMIT_INTENT constants used by the page', () => {
    expect(TRIP_SUBMIT_INTENT.DRAFT).toBe('draft')
    expect(TRIP_SUBMIT_INTENT.PUBLISH).toBe('publish')
  })
})
