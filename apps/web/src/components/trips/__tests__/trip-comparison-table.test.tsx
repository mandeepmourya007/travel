import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TripComparisonTable } from '../trip-comparison-table'
import { makeTripDetail, resetTripFactory } from '@/test/factories/trip.factory'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('TripComparisonTable', () => {
  beforeEach(() => resetTripFactory())

  it('renders nothing when trips array is empty', () => {
    const { container } = render(<TripComparisonTable trips={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders trip titles in header', () => {
    const trips = [
      makeTripDetail({ title: 'Goa Beach Trip', slug: 'goa-beach' }),
      makeTripDetail({ title: 'Manali Trek', slug: 'manali-trek' }),
    ]

    render(<TripComparisonTable trips={trips} />)

    // Both mobile card and desktop table render titles
    expect(screen.getAllByText('Goa Beach Trip').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Manali Trek').length).toBeGreaterThanOrEqual(1)
  })

  it('renders prices for each trip', () => {
    const trips = [
      makeTripDetail({ pricePerPerson: 5000, slug: 'trip-a' }),
      makeTripDetail({ pricePerPerson: 8000, slug: 'trip-b' }),
    ]

    render(<TripComparisonTable trips={trips} />)

    expect(screen.getAllByText('₹5,000').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('₹8,000').length).toBeGreaterThanOrEqual(1)
  })

  it('renders destination names', () => {
    const trips = [
      makeTripDetail({
        slug: 'trip-a',
        destination: { id: 'd1', name: 'Goa', slug: 'goa' },
      }),
      makeTripDetail({
        slug: 'trip-b',
        destination: { id: 'd2', name: 'Manali', slug: 'manali' },
      }),
    ]

    render(<TripComparisonTable trips={trips} />)

    expect(screen.getAllByText('Goa').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Manali').length).toBeGreaterThanOrEqual(1)
  })

  it('renders inclusions list', () => {
    const trips = [
      makeTripDetail({ slug: 'trip-a', inclusions: ['Transport', 'Meals'] }),
      makeTripDetail({ slug: 'trip-b', inclusions: ['Accommodation'] }),
    ]

    render(<TripComparisonTable trips={trips} />)

    expect(screen.getAllByText('Transport').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Meals').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Accommodation').length).toBeGreaterThanOrEqual(1)
  })

  it('renders cancellation policy badges', () => {
    const trips = [
      makeTripDetail({ slug: 'trip-a', cancellationPolicy: 'FLEXIBLE' }),
      makeTripDetail({ slug: 'trip-b', cancellationPolicy: 'STRICT' }),
    ]

    render(<TripComparisonTable trips={trips} />)

    expect(screen.getAllByText('Free cancel 48h').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('No refunds').length).toBeGreaterThanOrEqual(1)
  })

  it('renders booking mode badges', () => {
    const trips = [
      makeTripDetail({ slug: 'trip-a', bookingMode: 'INSTANT' }),
      makeTripDetail({ slug: 'trip-b', bookingMode: 'REQUEST_BASED' }),
    ]

    render(<TripComparisonTable trips={trips} />)

    expect(screen.getAllByText('Instant Book').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Request Based').length).toBeGreaterThanOrEqual(1)
  })

  it('shows "Fully Booked" when no seats left', () => {
    const trips = [
      makeTripDetail({
        slug: 'trip-a',
        maxGroupSize: 10,
        currentBookings: 10,
      }),
      makeTripDetail({ slug: 'trip-b' }),
    ]

    render(<TripComparisonTable trips={trips} />)

    expect(screen.getAllByText('Fully Booked').length).toBeGreaterThanOrEqual(1)
  })

  it('renders CTA links to trip booking pages', () => {
    const trips = [
      makeTripDetail({ slug: 'trip-a', bookingMode: 'INSTANT' }),
      makeTripDetail({ slug: 'trip-b', bookingMode: 'REQUEST_BASED' }),
    ]

    render(<TripComparisonTable trips={trips} />)

    const bookNowLinks = screen.getAllByRole('link', { name: 'Book Now' })
    expect(bookNowLinks[0]).toHaveAttribute('href', '/trips/trip-a/book')

    const requestToJoinLinks = screen.getAllByRole('link', { name: 'Request to Join' })
    expect(requestToJoinLinks[0]).toHaveAttribute('href', '/trips/trip-b/book')
  })

  it('calls onRemove when remove button is clicked', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()

    const trips = [
      makeTripDetail({ slug: 'trip-a', title: 'Trip A' }),
      makeTripDetail({ slug: 'trip-b', title: 'Trip B' }),
    ]

    render(<TripComparisonTable trips={trips} onRemove={onRemove} />)

    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    await user.click(removeButtons[0])

    expect(onRemove).toHaveBeenCalledWith('trip-a')
  })

  it('renders 3 trips side by side', () => {
    const trips = [
      makeTripDetail({ slug: 'trip-a', title: 'Trip A' }),
      makeTripDetail({ slug: 'trip-b', title: 'Trip B' }),
      makeTripDetail({ slug: 'trip-c', title: 'Trip C' }),
    ]

    render(<TripComparisonTable trips={trips} />)

    expect(screen.getAllByText('Trip A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Trip B').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Trip C').length).toBeGreaterThanOrEqual(1)
  })
})
