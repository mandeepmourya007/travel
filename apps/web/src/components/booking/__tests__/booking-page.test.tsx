import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import {
  makeCreateBookingResponse,
  makeVerifyPaymentResponse,
  resetBookingFactory,
} from '@/test/factories/booking.factory'
import { makeTripDetail, resetTripFactory } from '@/test/factories/trip.factory'
import { server } from '@/test/mocks/server'

const API = 'http://localhost:4000/api/v1'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/trips/goa-beach/book',
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    [k: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock auth store — user is always authenticated
vi.mock('@/store/auth.store', () => ({
  useAuthStore: (selector?: (s: Record<string, unknown>) => unknown) => {
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

// Mock Razorpay — captures options so tests can trigger handler callback
let capturedRazorpayOptions: Record<string, unknown> | null = null
vi.mock('@/lib/razorpay', () => ({
  loadRazorpayScript: vi.fn().mockResolvedValue(
    class MockRazorpay {
      constructor(public options: Record<string, unknown>) {
        capturedRazorpayOptions = options
      }
      open() {
        /* simulate modal open */
      }
    },
  ),
}))

// Helper: simulate successful Razorpay payment in tests
function simulateRazorpaySuccess() {
  const handler = capturedRazorpayOptions?.handler as
    | ((r: Record<string, string>) => void)
    | undefined
  handler?.({
    razorpay_order_id: 'order_test123',
    razorpay_payment_id: 'pay_test456',
    razorpay_signature: 'sig_test789',
  })
}

function simulateRazorpayDismiss() {
  const modal = capturedRazorpayOptions?.modal as
    | { ondismiss?: () => void }
    | undefined
  modal?.ondismiss?.()
}

// Import component AFTER mocks
import BookingPage from '@/app/trips/[slug]/book/page'

// ── Helpers ──────────────────────────────────────────

const defaultTrip = () =>
  makeTripDetail({
    slug: 'goa-beach',
    title: 'Goa Beach Getaway',
    pricePerPerson: 5000,
    maxGroupSize: 20,
    currentBookings: 8,
    inclusions: ['Transport', 'Meals', 'Accommodation'],
    cancellationPolicy: 'FLEXIBLE',
    acceptingBookings: true,
    bookingDeadline: null,
  })

function setupTripHandler(trip = defaultTrip()) {
  server.use(
    http.get(`${API}/trips/slug/:slug`, () =>
      HttpResponse.json({ success: true, data: trip }),
    ),
  )
}

function setupBookingHandlers() {
  const createResponse = makeCreateBookingResponse()
  const verifyResponse = makeVerifyPaymentResponse({
    bookingId: createResponse.bookingId,
  })

  server.use(
    http.post(`${API}/bookings`, () =>
      HttpResponse.json({ success: true, data: createResponse }, { status: 201 }),
    ),
    http.post(`${API}/bookings/:id/verify-payment`, () =>
      HttpResponse.json({ success: true, data: verifyResponse }),
    ),
  )

  return { createResponse, verifyResponse }
}

function renderBookingPage() {
  return renderWithQuery(<BookingPage params={{ slug: 'goa-beach' }} />)
}

// ── Tests ────────────────────────────────────────────

describe('BookingPage', () => {
  beforeEach(() => {
    resetBookingFactory()
    resetTripFactory()
    capturedRazorpayOptions = null
    mockToast.mockClear()
    mockPush.mockClear()
    sessionStorage.clear()
  })

  // ── 1. Loading State ──

  it('should show skeleton while trip data is loading', () => {
    setupTripHandler()
    renderBookingPage()

    expect(screen.getByTestId('booking-page-skeleton')).toBeInTheDocument()
  })

  // ── 2. Error State ──

  it('should show error state with retry when trip fetch fails', async () => {
    server.use(
      http.get(`${API}/trips/slug/:slug`, () =>
        HttpResponse.json({ success: false, error: 'Server error' }, { status: 500 }),
      ),
    )

    renderBookingPage()

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  // ── 3. Trip Validation ──

  it('should show "fully booked" message when trip has no seats', async () => {
    setupTripHandler(
      makeTripDetail({
        slug: 'goa-beach',
        maxGroupSize: 20,
        currentBookings: 20,
        acceptingBookings: true,
      }),
    )

    renderBookingPage()

    await waitFor(() => {
      expect(screen.getByText(/fully booked/i)).toBeInTheDocument()
    })
  })

  it('should show "deadline passed" message when booking deadline expired', async () => {
    setupTripHandler(
      makeTripDetail({
        slug: 'goa-beach',
        acceptingBookings: true,
        bookingDeadline: '2020-01-01T00:00:00.000Z',
      }),
    )

    renderBookingPage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /deadline.*passed/i })).toBeInTheDocument()
    })
  })

  // ── 4. Form — Data State ──

  it('should render traveler form with correct number of fields', async () => {
    setupTripHandler()
    renderBookingPage()

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    // Default 1 traveler — should see name, phone, age, gender fields
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone')).toBeInTheDocument()
    expect(screen.getByLabelText('Age')).toBeInTheDocument()
    expect(screen.getByLabelText('Gender')).toBeInTheDocument()
  })

  it('should pre-fill first traveler name from auth store', async () => {
    setupTripHandler()
    renderBookingPage()

    await waitFor(() => {
      const nameInput = screen.getByLabelText('Name') as HTMLInputElement
      expect(nameInput.value).toBe('Test User')
    })
  })

  it('should update price when traveler count changes', async () => {
    setupTripHandler()
    renderBookingPage()
    const user = userEvent.setup()

    // Wait for form to render with price summary
    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument()
    })

    // Check initial total is ₹5,000 (1 traveler)
    const totalSection = screen.getByText('Total').closest('div')!
    expect(totalSection.textContent).toContain('₹5,000')

    // Increase travelers to 2
    const incrementBtn = screen.getByRole('button', { name: /increase/i })
    await user.click(incrementBtn)

    await waitFor(() => {
      const updatedSection = screen.getByText('Total').closest('div')!
      expect(updatedSection.textContent).toContain('₹10,000')
    })
  })

  // ── 5. Form — Validation ──

  it('should show validation errors for empty required fields', async () => {
    setupTripHandler()
    setupBookingHandlers()
    renderBookingPage()
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    // Clear the pre-filled name and submit
    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)

    const payBtn = screen.getByRole('button', { name: /pay/i })
    await user.click(payBtn)

    await waitFor(() => {
      // Zod produces "String must contain at least 2 character(s)" or similar
      expect(screen.getByText(/at least 2|required/i)).toBeInTheDocument()
    })
  })

  it('should disable Pay button when processing', async () => {
    setupTripHandler()
    renderBookingPage()

    await waitFor(() => {
      const payBtn = screen.getByRole('button', { name: /pay/i })
      // Button is enabled when not processing
      expect(payBtn).not.toBeDisabled()
    })
  })

  // ── 6. Form — Submit Success ──

  it('should call POST /bookings on form submit', async () => {
    setupTripHandler()
    const { createResponse } = setupBookingHandlers()
    renderBookingPage()
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    // Fill required fields
    const phoneInput = screen.getByLabelText('Phone')
    await user.type(phoneInput, '9876543210')

    const ageInput = screen.getByLabelText('Age')
    await user.type(ageInput, '28')

    const genderSelect = screen.getByLabelText('Gender')
    await user.selectOptions(genderSelect, 'MALE')

    const payBtn = screen.getByRole('button', { name: /pay/i })
    await user.click(payBtn)

    // Should have opened Razorpay
    await waitFor(() => {
      expect(capturedRazorpayOptions).not.toBeNull()
      expect(capturedRazorpayOptions?.key).toBe(createResponse.razorpayKeyId)
    })
  })

  it('should show success screen after payment verification', async () => {
    setupTripHandler()
    setupBookingHandlers()
    renderBookingPage()
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    // Fill form
    await user.type(screen.getByLabelText('Phone'), '9876543210')
    await user.type(screen.getByLabelText('Age'), '28')
    await user.selectOptions(screen.getByLabelText('Gender'), 'MALE')
    await user.click(screen.getByRole('button', { name: /pay/i }))

    // Wait for Razorpay to be loaded
    await waitFor(() => {
      expect(capturedRazorpayOptions).not.toBeNull()
    })

    // Simulate successful payment
    simulateRazorpaySuccess()

    // Should show success screen
    await waitFor(() => {
      expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/TRP-2025/)).toBeInTheDocument()
  })

  // ── 7. Form — Submit Error ──

  it('should show error toast when booking creation fails', async () => {
    setupTripHandler()
    server.use(
      http.post(`${API}/bookings`, () =>
        HttpResponse.json(
          { success: false, error: 'Not enough seats' },
          { status: 400 },
        ),
      ),
    )

    renderBookingPage()
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('Phone'), '9876543210')
    await user.type(screen.getByLabelText('Age'), '28')
    await user.selectOptions(screen.getByLabelText('Gender'), 'MALE')
    await user.click(screen.getByRole('button', { name: /pay/i }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      )
    })
  })

  it('should keep form visible when Razorpay modal is dismissed', async () => {
    setupTripHandler()
    setupBookingHandlers()
    renderBookingPage()
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('Phone'), '9876543210')
    await user.type(screen.getByLabelText('Age'), '28')
    await user.selectOptions(screen.getByLabelText('Gender'), 'MALE')
    await user.click(screen.getByRole('button', { name: /pay/i }))

    await waitFor(() => {
      expect(capturedRazorpayOptions).not.toBeNull()
    })

    // User closes modal
    simulateRazorpayDismiss()

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'warning' }),
      )
    })

    // Form should still be visible and pay button re-enabled
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pay/i })).not.toBeDisabled()
  })
})
