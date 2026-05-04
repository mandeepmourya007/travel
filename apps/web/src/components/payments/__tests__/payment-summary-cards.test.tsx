import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  TravelerPaymentSummaryCards,
  TripPaymentSummaryCards,
  AdminPaymentSummaryCards,
  StatItemSkeleton,
} from '../payment-summary-cards'
import {
  makeTravelerSummary,
  makeTripSummary,
  makeAdminSummary,
} from '@/test/factories/payment.factory'

describe('TravelerPaymentSummaryCards', () => {
  it('should render all four stat items', () => {
    render(<TravelerPaymentSummaryCards {...makeTravelerSummary()} />)

    expect(screen.getByText('Total Paid')).toBeInTheDocument()
    expect(screen.getByText('Total Refunded')).toBeInTheDocument()
    expect(screen.getByText('Pending Refunds')).toBeInTheDocument()
    expect(screen.getByText('Transactions')).toBeInTheDocument()
  })

  it('should format currency values with ₹ and locale', () => {
    render(<TravelerPaymentSummaryCards {...makeTravelerSummary({ totalPaid: 9000 })} />)

    expect(screen.getByText('₹9,000')).toBeInTheDocument()
  })

  it('should show zero values correctly', () => {
    render(
      <TravelerPaymentSummaryCards
        {...makeTravelerSummary({ totalPaid: 0, totalRefunded: 0, pendingRefunds: 0, transactionCount: 0 })}
      />,
    )

    expect(screen.getAllByText('₹0')).toHaveLength(3)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})

describe('TripPaymentSummaryCards', () => {
  it('should render organizer-specific stats', () => {
    render(<TripPaymentSummaryCards {...makeTripSummary()} />)

    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('Refunds')).toBeInTheDocument()
    expect(screen.getByText('Your Earnings')).toBeInTheDocument()
    expect(screen.getByText('Platform Fee')).toBeInTheDocument()
  })

  it('should format large currency values', () => {
    render(<TripPaymentSummaryCards {...makeTripSummary({ totalRevenue: 45000 })} />)

    expect(screen.getByText('₹45,000')).toBeInTheDocument()
  })
})

describe('AdminPaymentSummaryCards', () => {
  it('should render admin-specific stats', () => {
    render(<AdminPaymentSummaryCards {...makeAdminSummary()} />)

    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    expect(screen.getByText('Total Refunded')).toBeInTheDocument()
    expect(screen.getByText('Net Revenue')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('should show failed count as a number, not currency', () => {
    render(<AdminPaymentSummaryCards {...makeAdminSummary({ failedCount: 3 })} />)

    expect(screen.getByText('3')).toBeInTheDocument()
  })
})

describe('StatItemSkeleton', () => {
  it('should render skeleton placeholders', () => {
    const { container } = render(<StatItemSkeleton />)

    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
  })
})
