import { screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import type { BookingRow } from '@/hooks/use-reseller'
import { ResellerBookingList } from '../reseller-booking-list'

function makeBookingRow(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'booking-1',
    bookingRef: 'BK-1',
    numTravelers: 2,
    totalAmount: 5000,
    markupAmount: 500,
    bookingStatus: 'CONFIRMED',
    createdAt: '2026-01-01T00:00:00.000Z',
    user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
    refundStatus: null,
    ...overrides,
  }
}

const noop = () => {}

describe('ResellerBookingList', () => {
  it('renders a "Refunded" badge alongside the status badge when refundStatus is REFUNDED', async () => {
    const row = makeBookingRow({ bookingStatus: 'REFUNDED', refundStatus: 'REFUNDED' })
    renderWithQuery(
      <ResellerBookingList data={[row]} isLoading={false} error={null} page={1} onPageChange={noop} />,
    )

    expect((await screen.findAllByText('REFUNDED')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Refunded')).length).toBeGreaterThan(0)
  })

  it('renders a "Refund Pending" badge alongside the status badge when refundStatus is PENDING', async () => {
    const row = makeBookingRow({ bookingStatus: 'CANCELLED', refundStatus: 'PENDING' })
    renderWithQuery(
      <ResellerBookingList data={[row]} isLoading={false} error={null} page={1} onPageChange={noop} />,
    )

    expect((await screen.findAllByText('CANCELLED')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Refund Pending')).length).toBeGreaterThan(0)
  })

  it('renders no second badge when a CANCELLED booking has no refund owed (refundStatus null)', async () => {
    const row = makeBookingRow({ bookingStatus: 'CANCELLED', refundStatus: null })
    renderWithQuery(
      <ResellerBookingList data={[row]} isLoading={false} error={null} page={1} onPageChange={noop} />,
    )

    expect((await screen.findAllByText('CANCELLED')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Refunded')).not.toBeInTheDocument()
    expect(screen.queryByText('Refund Pending')).not.toBeInTheDocument()
  })

  it('renders no refund badge for unrelated statuses like CONFIRMED', async () => {
    const row = makeBookingRow({ bookingStatus: 'CONFIRMED', refundStatus: null })
    renderWithQuery(
      <ResellerBookingList data={[row]} isLoading={false} error={null} page={1} onPageChange={noop} />,
    )

    expect((await screen.findAllByText('CONFIRMED')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Refunded')).not.toBeInTheDocument()
    expect(screen.queryByText('Refund Pending')).not.toBeInTheDocument()
  })
})
