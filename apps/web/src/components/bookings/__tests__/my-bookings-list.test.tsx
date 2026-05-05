import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import { makeMyBooking, makeMyBookingSummary, resetBookingFactory } from '@/test/factories/booking.factory'
import { server } from '@/test/mocks/server'

const API = 'http://localhost:4000/api/v1'

// Mock next/navigation (required for Link components inside cards)
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/my-bookings',
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

// Mock auth store — user is always authenticated for these tests
vi.mock('@/store/auth.store', () => ({
  useAuthStore: (selector?: (s: any) => any) => {
    const state = {
      isAuthenticated: true,
      _hasHydrated: true,
      user: { id: 'user-1', name: 'Test User', email: 'test@test.com', role: 'TRAVELER' },
    }
    return selector ? selector(state) : state
  },
}))

// Mock toast
const mockToast = vi.fn()
vi.mock('@/components/shared/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Import AFTER mocks
import { MyBookingsList } from '../my-bookings-list'

// ── Helpers ──────────────────────────────────────────

function setupHandlers({
  bookings = [makeMyBooking()],
  summary = makeMyBookingSummary(),
  total = bookings.length,
}: {
  bookings?: ReturnType<typeof makeMyBooking>[]
  summary?: ReturnType<typeof makeMyBookingSummary>
  total?: number
} = {}) {
  server.use(
    http.get(`${API}/bookings/my`, () =>
      HttpResponse.json({
        success: true,
        data: bookings,
        pagination: { page: 1, limit: 10, total, totalPages: Math.ceil(total / 10) },
      }),
    ),
    http.get(`${API}/bookings/my/summary`, () =>
      HttpResponse.json({ success: true, data: summary }),
    ),
  )
}

// ── Tests ────────────────────────────────────────────

describe('MyBookingsList', () => {
  beforeEach(() => {
    resetBookingFactory()
    mockToast.mockClear()
    mockPush.mockClear()
  })

  // ── 1. Loading State ──

  it('should show skeleton placeholders while data is being fetched', () => {
    // Don't set up handlers — request will hang, showing loading state
    server.use(
      http.get(`${API}/bookings/my`, () => new Promise(() => {})),
      http.get(`${API}/bookings/my/summary`, () => new Promise(() => {})),
    )

    const { container } = renderWithQuery(<MyBookingsList />)

    const skeletons = container.querySelectorAll('.skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })

  // ── 2. Error State ──

  it('should show error state with retry button when API fails', async () => {
    server.use(
      http.get(`${API}/bookings/my`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } },
          { status: 500 },
        ),
      ),
      http.get(`${API}/bookings/my/summary`, () =>
        HttpResponse.json({ success: true, data: makeMyBookingSummary() }),
      ),
    )

    renderWithQuery(<MyBookingsList />)

    await waitFor(() => {
      expect(screen.getByText(/couldn't load bookings/i)).toBeInTheDocument()
    }, { timeout: 5000 })

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  // ── 3. Empty State ──

  it('should show empty state with CTA when user has no bookings', async () => {
    setupHandlers({
      bookings: [],
      summary: makeMyBookingSummary({ all: 0, upcoming: 0, completed: 0, cancelled: 0 }),
      total: 0,
    })

    renderWithQuery(<MyBookingsList />)

    await waitFor(() => {
      expect(screen.getByText(/haven't booked any trips/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: /browse trips/i })).toHaveAttribute('href', '/trips')
  })

  it('should show per-tab empty state for upcoming tab', async () => {
    server.use(
      http.get(`${API}/bookings/my`, ({ request }) => {
        const url = new URL(request.url)
        const tab = url.searchParams.get('tab')
        if (tab === 'upcoming') {
          return HttpResponse.json({
            success: true,
            data: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
          })
        }
        return HttpResponse.json({
          success: true,
          data: [makeMyBooking()],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        })
      }),
      http.get(`${API}/bookings/my/summary`, () =>
        HttpResponse.json({
          success: true,
          data: makeMyBookingSummary({ upcoming: 0 }),
        }),
      ),
    )

    const user = userEvent.setup()
    renderWithQuery(<MyBookingsList />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/beach getaway/i)).toBeInTheDocument()
    })

    // Click "Upcoming" tab
    const upcomingTab = screen.getByRole('tab', { name: /upcoming/i })
    await user.click(upcomingTab)

    await waitFor(() => {
      expect(screen.getByText(/no upcoming trips/i)).toBeInTheDocument()
    })
  })

  // ── 4. Data State ──

  it('should render booking cards with key information', async () => {
    const booking = makeMyBooking({
      bookingRef: 'TRP-2025-0042',
      totalAmount: 12000,
      numTravelers: 3,
      trip: {
        id: 'trip-1',
        title: 'Goa Beach Getaway',
        slug: 'goa-beach-getaway',
        startDate: '2025-12-06T00:00:00.000Z',
        endDate: '2025-12-08T00:00:00.000Z',
        photos: ['/goa.jpg'],
        tripType: 'BEACH',
        cancellationPolicy: 'FLEXIBLE',
        destination: { id: 'dest-1', name: 'Goa', slug: 'goa' },
        organizer: { id: 'org-1', businessName: 'TripVibes', rating: 4.5, verified: true },
      },
    })
    setupHandlers({ bookings: [booking] })

    renderWithQuery(<MyBookingsList />)

    await waitFor(() => {
      expect(screen.getByText('Goa Beach Getaway')).toBeInTheDocument()
    })

    // Key info visible
    expect(screen.getByText('Goa')).toBeInTheDocument()
    expect(screen.getByText(/3 travelers/i)).toBeInTheDocument()
    expect(screen.getByText('₹12,000')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText(/TripVibes/)).toBeInTheDocument()
  })

  // ── 5. Tab Counts ──

  it('should display tab counts from summary endpoint', async () => {
    setupHandlers({
      summary: makeMyBookingSummary({ all: 10, upcoming: 3, completed: 5, cancelled: 2 }),
    })

    renderWithQuery(<MyBookingsList />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /all \(10\)/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('tab', { name: /upcoming \(3\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /completed \(5\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /cancelled \(2\)/i })).toBeInTheDocument()
  })

  // ── 6. Tab Switching ──

  it('should fetch filtered data when switching tabs', async () => {
    let lastRequestedTab: string | null = null

    server.use(
      http.get(`${API}/bookings/my`, ({ request }) => {
        const url = new URL(request.url)
        lastRequestedTab = url.searchParams.get('tab')
        return HttpResponse.json({
          success: true,
          data: [makeMyBooking({ bookingStatus: lastRequestedTab === 'completed' ? 'COMPLETED' : 'CONFIRMED' })],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        })
      }),
      http.get(`${API}/bookings/my/summary`, () =>
        HttpResponse.json({ success: true, data: makeMyBookingSummary() }),
      ),
    )

    const user = userEvent.setup()
    renderWithQuery(<MyBookingsList />)

    // Wait for initial load (all tab)
    await waitFor(() => {
      expect(screen.getByText('Confirmed')).toBeInTheDocument()
    })

    // Switch to completed tab
    const completedTab = screen.getByRole('tab', { name: /completed/i })
    await user.click(completedTab)

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })
  })

  // ── 7. Cancel Button Visibility ──

  it('should show cancel button only for confirmed upcoming bookings', async () => {
    const upcoming = makeMyBooking({
      bookingStatus: 'CONFIRMED',
      trip: {
        ...makeMyBooking().trip,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    })
    const completed = makeMyBooking({ bookingStatus: 'COMPLETED' })
    setupHandlers({ bookings: [upcoming, completed] })

    renderWithQuery(<MyBookingsList />)

    await waitFor(() => {
      expect(screen.getByText(/cancel booking/i)).toBeInTheDocument()
    })

    // Only 1 cancel button (for the upcoming booking)
    const cancelButtons = screen.getAllByText(/cancel booking/i)
    expect(cancelButtons).toHaveLength(1)
  })

  // ── 8. Cancel Modal Opens ──

  it('should open cancel modal when cancel button is clicked', async () => {
    const booking = makeMyBooking({
      bookingRef: 'TRP-2025-0099',
      trip: {
        ...makeMyBooking().trip,
        title: 'Goa Beach Getaway',
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        cancellationPolicy: 'FLEXIBLE',
      },
    })
    setupHandlers({ bookings: [booking] })

    const user = userEvent.setup()
    renderWithQuery(<MyBookingsList />)

    await waitFor(() => {
      expect(screen.getByText(/cancel booking/i)).toBeInTheDocument()
    })

    await user.click(screen.getByText(/cancel booking/i))

    // Modal should be visible — use heading role to disambiguate from card button
    expect(screen.getByRole('heading', { name: 'Cancel Booking' })).toBeInTheDocument()
    expect(screen.getByText(/TRP-2025-0099/)).toBeInTheDocument()
    expect(screen.getByText('FLEXIBLE')).toBeInTheDocument()
    expect(screen.getByText(/keep booking/i)).toBeInTheDocument()
  })

  // ── 9. Cancel Confirm Success ──

  it('should cancel booking and show success toast when confirm is clicked', async () => {
    const booking = makeMyBooking({
      bookingRef: 'TRP-2025-0099',
      trip: {
        ...makeMyBooking().trip,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        cancellationPolicy: 'FLEXIBLE',
      },
    })
    setupHandlers({ bookings: [booking] })

    server.use(
      http.post(`${API}/bookings/:id/cancel`, () =>
        HttpResponse.json({
          success: true,
          data: {
            bookingId: booking.id,
            bookingStatus: 'CANCELLED',
            refundAmount: 9000,
            refundPercent: 100,
            cancellationPolicy: 'FLEXIBLE',
          },
        }),
      ),
    )

    const user = userEvent.setup()
    renderWithQuery(<MyBookingsList />)

    // Wait for data + click cancel
    await waitFor(() => {
      expect(screen.getByText(/cancel booking/i)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/cancel booking/i))

    // Type reason (min 5 chars)
    const textarea = screen.getByPlaceholderText(/please tell us/i)
    await user.type(textarea, 'Changed my plans')

    // Click confirm cancel
    await user.click(screen.getByText(/cancel & refund/i))

    // Toast should fire
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      )
    })
  })

  // ── 10. Cancel Reason Validation ──

  it('should disable cancel button when reason is too short', async () => {
    const booking = makeMyBooking({
      trip: {
        ...makeMyBooking().trip,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    })
    setupHandlers({ bookings: [booking] })

    const user = userEvent.setup()
    renderWithQuery(<MyBookingsList />)

    await waitFor(() => {
      expect(screen.getByText(/cancel booking/i)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/cancel booking/i))

    // Cancel & Refund button should be disabled (no reason yet)
    const confirmBtn = screen.getByText(/cancel & refund/i)
    expect(confirmBtn).toBeDisabled()

    // Type 3 chars (too short, min is 5)
    const textarea = screen.getByPlaceholderText(/please tell us/i)
    await user.type(textarea, 'abc')

    // Should still be disabled
    expect(confirmBtn).toBeDisabled()

    // Validation message visible
    expect(screen.getByText(/at least 5 characters/i)).toBeInTheDocument()
  })

  // ── 11. Review Link ──

  it('should show "Leave Review" link for completed bookings without review', async () => {
    const booking = makeMyBooking({
      bookingStatus: 'COMPLETED',
      hasReview: false,
      trip: {
        ...makeMyBooking().trip,
        slug: 'goa-beach-getaway',
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-01-03T00:00:00.000Z',
      },
    })
    setupHandlers({ bookings: [booking] })

    renderWithQuery(<MyBookingsList />)

    await waitFor(() => {
      expect(screen.getByText(/leave review/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: /leave review/i })).toHaveAttribute(
      'href',
      '/trips/goa-beach-getaway#reviews',
    )
  })

  it('should NOT show "Leave Review" link for completed bookings with existing review', async () => {
    const booking = makeMyBooking({
      bookingStatus: 'COMPLETED',
      hasReview: true,
    })
    setupHandlers({ bookings: [booking] })

    renderWithQuery(<MyBookingsList />)

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    expect(screen.queryByText(/leave review/i)).not.toBeInTheDocument()
  })

  // ── 12. Pagination ──

  it('should show pagination controls when there are multiple pages', async () => {
    setupHandlers({
      bookings: [makeMyBooking()],
      total: 25, // 3 pages of 10
      summary: makeMyBookingSummary({ all: 25 }),
    })

    renderWithQuery(<MyBookingsList />)

    await waitFor(() => {
      expect(screen.getByLabelText('Previous page')).toBeInTheDocument()
    })

    expect(screen.getByLabelText('Previous page')).toBeDisabled()
    expect(screen.getByLabelText('Next page')).not.toBeDisabled()
  })

  // ── 13. Status Badge Colors ──

  it('should render different status badges for different booking statuses', async () => {
    const bookings = [
      makeMyBooking({ bookingStatus: 'CONFIRMED' }),
      makeMyBooking({ bookingStatus: 'COMPLETED' }),
      makeMyBooking({ bookingStatus: 'CANCELLED' }),
      makeMyBooking({ bookingStatus: 'EXPIRED' }),
    ]
    setupHandlers({
      bookings,
      summary: makeMyBookingSummary({ all: 4 }),
      total: 4,
    })

    renderWithQuery(<MyBookingsList />)

    await waitFor(() => {
      expect(screen.getByText('Confirmed')).toBeInTheDocument()
    })

    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  // ── 14. Traveler Details Accordion ──

  it('should show traveler details accordion when numTravelers > 1', async () => {
    const booking = makeMyBooking({ numTravelers: 2 })
    setupHandlers({ bookings: [booking] })

    renderWithQuery(<MyBookingsList />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /travelers/i })).toBeInTheDocument()
    })
  })

  it('should show inline traveler name when numTravelers is 1', async () => {
    const booking = makeMyBooking({
      numTravelers: 1,
      travelerDetails: [
        { id: 'td-1', name: 'Alice', phone: '9999999999', age: 25, gender: 'FEMALE', isPrimary: true, emergencyContactName: null, emergencyContactPhone: null },
      ],
    })
    setupHandlers({ bookings: [booking] })

    renderWithQuery(<MyBookingsList />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
  })
})
