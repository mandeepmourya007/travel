import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, vi } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import { makeTripDetail, resetTripFactory } from '@/test/factories/trip.factory'
import { server } from '@/test/mocks/server'

// Mock next/navigation
const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockRefresh = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
  }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

// Import after mocks are defined
import ComparePage from '../page'

describe('Compare Page', () => {
  beforeEach(() => {
    resetTripFactory()
    mockPush.mockClear()
    mockReplace.mockClear()
    mockRefresh.mockClear()
  })

  it('shows empty state when less than 2 slugs provided', () => {
    mockSearchParams = new URLSearchParams('trips=single-trip')

    renderWithQuery(<ComparePage />)

    expect(screen.getByText(/select at least 2 trips/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /browse trips/i })).toBeInTheDocument()
  })

  it('shows empty state when no trips param', () => {
    mockSearchParams = new URLSearchParams('')

    renderWithQuery(<ComparePage />)

    expect(screen.getByText(/select at least 2 trips/i)).toBeInTheDocument()
  })

  it('fetches and displays comparison for 2 trips', async () => {
    const trip1 = makeTripDetail({
      slug: 'goa-beach',
      title: 'Goa Beach Trip',
      pricePerPerson: 5000,
    })
    const trip2 = makeTripDetail({
      slug: 'manali-trek',
      title: 'Manali Trek',
      pricePerPerson: 8000,
    })

    server.use(
      http.get('*/trips/slug/goa-beach', () =>
        HttpResponse.json({ success: true, data: trip1 }),
      ),
      http.get('*/trips/slug/manali-trek', () =>
        HttpResponse.json({ success: true, data: trip2 }),
      ),
    )

    mockSearchParams = new URLSearchParams('trips=goa-beach,manali-trek')

    renderWithQuery(<ComparePage />)

    await waitFor(() => {
      expect(screen.getAllByText('Goa Beach Trip').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getAllByText('Manali Trek').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Comparing 2 Trips')).toBeInTheDocument()
  })

  it('shows insight badges (best value, best rated)', async () => {
    const trip1 = makeTripDetail({
      slug: 'cheap-trip',
      title: 'Budget Goa',
      pricePerPerson: 3000,
      organizer: {
        id: 'o1',
        businessName: 'Budget Co',
        rating: 3.5,
        totalReviews: 10,
        verified: true,
        totalTrips: 5,
        memberSince: '2023-01-01',
      },
    })
    const trip2 = makeTripDetail({
      slug: 'premium-trip',
      title: 'Premium Goa',
      pricePerPerson: 10000,
      organizer: {
        id: 'o2',
        businessName: 'Premium Co',
        rating: 4.8,
        totalReviews: 50,
        verified: true,
        totalTrips: 20,
        memberSince: '2022-01-01',
      },
    })

    server.use(
      http.get('*/trips/slug/cheap-trip', () =>
        HttpResponse.json({ success: true, data: trip1 }),
      ),
      http.get('*/trips/slug/premium-trip', () =>
        HttpResponse.json({ success: true, data: trip2 }),
      ),
    )

    mockSearchParams = new URLSearchParams('trips=cheap-trip,premium-trip')

    renderWithQuery(<ComparePage />)

    await waitFor(() => {
      expect(screen.getByText('Best Value:')).toBeInTheDocument()
    })

    // Trip titles appear in both insight badges and table — use getAllByText
    expect(screen.getAllByText('Budget Goa').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Best Rated:')).toBeInTheDocument()
    expect(screen.getAllByText('Premium Goa').length).toBeGreaterThanOrEqual(1)
  })

  it('shows error state when API fails', async () => {
    server.use(
      http.get('*/trips/slug/fail-1', () =>
        HttpResponse.json(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } },
          { status: 500 },
        ),
      ),
      http.get('*/trips/slug/fail-2', () =>
        HttpResponse.json(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } },
          { status: 500 },
        ),
      ),
    )

    mockSearchParams = new URLSearchParams('trips=fail-1,fail-2')

    renderWithQuery(<ComparePage />)

    await waitFor(
      () => {
        expect(
          screen.queryByText(/failed to load trip details/i) ||
            screen.queryByText(/could not load enough trips/i),
        ).toBeTruthy()
      },
      { timeout: 5000 },
    )
  })

  it('renders full comparison data (all rows) for 2 trips', async () => {
    const trip1 = makeTripDetail({
      slug: 'goa-beach',
      title: 'Goa Beach Trip',
      pricePerPerson: 5000,
      destination: { id: 'd1', name: 'Goa', slug: 'goa' },
      tripType: 'BEACH',
      startDate: '2025-03-01',
      endDate: '2025-03-04',
      maxGroupSize: 20,
      currentBookings: 8,
      bookingMode: 'INSTANT',
      inclusions: ['Transport', 'Meals'],
      cancellationPolicy: 'FLEXIBLE',
      organizer: {
        id: 'o1',
        businessName: 'Beach Co',
        rating: 4.5,
        totalReviews: 30,
        verified: true,
        totalTrips: 10,
        memberSince: '2023-01-01',
      },
    })
    const trip2 = makeTripDetail({
      slug: 'manali-trek',
      title: 'Manali Trek',
      pricePerPerson: 8000,
      destination: { id: 'd2', name: 'Manali', slug: 'manali' },
      tripType: 'TREKKING',
      startDate: '2025-04-10',
      endDate: '2025-04-14',
      maxGroupSize: 15,
      currentBookings: 12,
      bookingMode: 'REQUEST_BASED',
      inclusions: ['Accommodation', 'Guide'],
      cancellationPolicy: 'STRICT',
      organizer: {
        id: 'o2',
        businessName: 'Trek Co',
        rating: 4.8,
        totalReviews: 50,
        verified: true,
        totalTrips: 20,
        memberSince: '2022-06-01',
      },
    })

    server.use(
      http.get('*/trips/slug/goa-beach', () =>
        HttpResponse.json({ success: true, data: trip1 }),
      ),
      http.get('*/trips/slug/manali-trek', () =>
        HttpResponse.json({ success: true, data: trip2 }),
      ),
    )

    mockSearchParams = new URLSearchParams('trips=goa-beach,manali-trek')
    renderWithQuery(<ComparePage />)

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getAllByText('Goa Beach Trip').length).toBeGreaterThanOrEqual(1)
    })

    // ── Row labels (appear in both mobile cards + desktop table) ──
    expect(screen.getAllByText('Rating').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Price').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Destination').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Dates').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Group Size').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Booking').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Includes').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Cancellation').length).toBeGreaterThanOrEqual(2)

    // ── Price data ──
    expect(screen.getAllByText('₹5,000').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('₹8,000').length).toBeGreaterThanOrEqual(1)

    // ── Destination data ──
    expect(screen.getAllByText('Goa').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Manali').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Beach').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Trekking').length).toBeGreaterThanOrEqual(1)

    // ── Group size data ──
    expect(screen.getAllByText('20 people').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('15 people').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('12 left').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('3 left').length).toBeGreaterThanOrEqual(1)

    // ── Booking mode ──
    expect(screen.getAllByText('Instant Book').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Request Based').length).toBeGreaterThanOrEqual(1)

    // ── Inclusions ──
    expect(screen.getAllByText('Transport').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Meals').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Accommodation').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Guide').length).toBeGreaterThanOrEqual(1)

    // ── Cancellation policy ──
    expect(screen.getAllByText('Free cancel 48h').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('No refunds').length).toBeGreaterThanOrEqual(1)

    // ── Organizer info ──
    expect(screen.getAllByText(/Beach Co/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Trek Co/).length).toBeGreaterThanOrEqual(1)

    // ── CTA buttons (mobile + desktop = 2 each) ──
    const bookNowLinks = screen.getAllByRole('link', { name: 'Book Now' })
    expect(bookNowLinks[0]).toHaveAttribute('href', '/trips/goa-beach/book')
    const requestLinks = screen.getAllByRole('link', { name: 'Request to Join' })
    expect(requestLinks[0]).toHaveAttribute('href', '/trips/manali-trek/book')

    // ── Insight badges ──
    expect(screen.getByText('Best Value:')).toBeInTheDocument()
    expect(screen.getByText('Best Rated:')).toBeInTheDocument()
  })

  it('limits to 3 slugs even if more are passed', async () => {
    const slugs = ['a', 'b', 'c', 'd']
    slugs.forEach((slug) => {
      server.use(
        http.get(`*/trips/slug/${slug}`, () =>
          HttpResponse.json({
            success: true,
            data: makeTripDetail({ slug, title: `Trip ${slug.toUpperCase()}` }),
          }),
        ),
      )
    })

    mockSearchParams = new URLSearchParams('trips=a,b,c,d')

    renderWithQuery(<ComparePage />)

    await waitFor(() => {
      expect(screen.getByText('Comparing 3 Trips')).toBeInTheDocument()
    })

    // 4th slug should not be fetched
    expect(screen.queryByText('Trip D')).not.toBeInTheDocument()
  })
})
