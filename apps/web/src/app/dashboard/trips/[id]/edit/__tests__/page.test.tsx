import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import { server } from '@/test/mocks/server'
import { API_BASE_URL as API } from '@/test/test-constants'
import { makeTripDetail } from '@/test/factories/trip.factory'
import { makeOrganizerFullProfile } from '@/test/factories/profile.factory'
import { useAuthStore } from '@/store/auth.store'

// Mock next/navigation — the edit page reads the dynamic :id segment via useParams
// and calls useRouter() on submit (not exercised here).
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'trip-1' }),
  useRouter: () => ({ push: vi.fn() }),
}))

// next/image renders next/image inside TripForm's Media tab — mocked the same way
// trip-form.test.tsx does, since jsdom rejects remote hostnames at render time.
vi.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => <img {...props} alt={props.alt ?? ''} />,
}))

// Import AFTER mocks
import EditTripPage from '../page'

afterEach(() => {
  useAuthStore.setState({ accessToken: null })
})

describe('EditTripPage — commissionRate pre-fill regression (P0 snapshot bug)', () => {
  it('uses the TRIP\'s own frozen commissionRate for the earning pre-fill, not the organizer\'s current (different) profile rate', async () => {
    const user = userEvent.setup()

    // Organizer's CURRENT live rate is 25% — this must NOT be used for the preview,
    // since it may have been changed by an admin after the trip was created.
    useAuthStore.setState({ accessToken: 'test-token' })
    server.use(
      http.get(`${API}/auth/profile`, () =>
        HttpResponse.json({
          success: true,
          data: makeOrganizerFullProfile({ organizerProfile: { ...makeOrganizerFullProfile().organizerProfile!, commissionRate: 25 } }),
        }),
      ),
      http.get(`${API}/trips/trip-1`, () =>
        HttpResponse.json({
          success: true,
          // Trip's own locked rate, frozen at trip-creation time, is 10% — this is
          // what the earning pre-fill/preview must reflect.
          data: { ...makeTripDetail({ pricePerPerson: 5000 }), commissionRate: 10 },
        }),
      ),
      http.get(`${API}/trips/trip-1/vehicles`, () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    )

    renderWithQuery(<EditTripPage />)

    // Wait for the trip to load and the form to render, then jump to Dates & Pricing.
    await screen.findByText(/Edit Trip/i)
    await user.click(await screen.findByRole('button', { name: /next/i }))

    // pricePerPerson (gross) = 5000. At the trip's own 10% rate: earning = round(5000 * 0.9) = 4500.
    // If the bug regressed (using the organizer's current 25% rate instead), this would show 3750.
    const earningInput = await screen.findByPlaceholderText('e.g. 4050')
    expect(earningInput).toHaveValue('4500')

    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /Traveller pays/.test(el.textContent ?? '')),
    ).toHaveTextContent('Traveller pays ₹5,000 (includes platform fee ₹500 at 10%)')
  })
})
