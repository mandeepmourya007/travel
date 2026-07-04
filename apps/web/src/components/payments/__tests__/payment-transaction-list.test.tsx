import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PaymentTransactionList } from '../payment-transaction-list'
import { makePaymentItem, resetPaymentFactory } from '@/test/factories/payment.factory'

import { beforeEach } from 'vitest'

beforeEach(() => {
  resetPaymentFactory()
})

const baseProps = {
  isLoading: false,
  error: null,
  page: 1,
  onPageChange: vi.fn(),
}

describe('PaymentTransactionList', () => {
  describe('4-state rendering', () => {
    it('should render loading skeletons when isLoading is true', () => {
      const { container } = render(
        <PaymentTransactionList {...baseProps} isLoading={true} data={undefined} />,
      )

      const skeletons = container.querySelectorAll('.skeleton')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('should render error state with retry button when error is present', () => {
      const onRetry = vi.fn()
      render(
        <PaymentTransactionList
          {...baseProps}
          error={new Error('API failed')}
          data={undefined}
          onRetry={onRetry}
        />,
      )

      expect(screen.getByText('Failed to load payments')).toBeInTheDocument()
    })

    it('should render empty state when data is empty array', () => {
      render(<PaymentTransactionList {...baseProps} data={[]} />)

      expect(screen.getByText('No payment transactions found.')).toBeInTheDocument()
    })

    it('should render empty state when data is undefined', () => {
      render(<PaymentTransactionList {...baseProps} data={undefined} />)

      expect(screen.getByText('No payment transactions found.')).toBeInTheDocument()
    })

    it('should render table with data rows', () => {
      const items = [makePaymentItem(), makePaymentItem({ status: 'FAILED' })]
      render(<PaymentTransactionList {...baseProps} data={items} />)

      // Each item renders in both the mobile card and the desktop row
      expect(screen.getAllByText('Goa Beach Getaway')).toHaveLength(4)
      expect(screen.getAllByText('TRP-2025-0001')).toHaveLength(2)
      expect(screen.getAllByText('TRP-2025-0002')).toHaveLength(2)
    })
  })

  describe('table columns', () => {
    it('should show booking ref, trip, type, amount, status, date', () => {
      render(<PaymentTransactionList {...baseProps} data={[makePaymentItem()]} />)

      expect(screen.getByText('Booking')).toBeInTheDocument()
      expect(screen.getByText('Trip')).toBeInTheDocument()
      expect(screen.getByText('Type')).toBeInTheDocument()
      expect(screen.getByText('Amount')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Date')).toBeInTheDocument()
    })

    it('should show Traveler column when showUser is true', () => {
      const item = makePaymentItem()
      render(<PaymentTransactionList {...baseProps} data={[item]} showUser />)

      expect(screen.getByText('Traveler')).toBeInTheDocument()
      // Name appears in both mobile card and desktop row
      expect(screen.getAllByText('Priya S')).toHaveLength(2)
    })

    it('should hide Traveler column when showUser is false', () => {
      render(<PaymentTransactionList {...baseProps} data={[makePaymentItem()]} />)

      expect(screen.queryByText('Traveler')).not.toBeInTheDocument()
    })

    it('should prefix refund amounts with +', () => {
      const refund = makePaymentItem({ type: 'REFUND', amount: 2000 })
      render(<PaymentTransactionList {...baseProps} data={[refund]} />)

      // Amount appears in both mobile card and desktop row
      expect(screen.getAllByText(/\+₹2,000/)).toHaveLength(2)
    })
  })

  describe('pagination', () => {
    it('should not show pagination when totalPages is 1', () => {
      render(
        <PaymentTransactionList
          {...baseProps}
          data={[makePaymentItem()]}
          pagination={{ page: 1, limit: 20, total: 1, totalPages: 1 }}
        />,
      )

      expect(screen.queryByLabelText('Previous page')).not.toBeInTheDocument()
    })

    it('should show pagination when totalPages > 1', () => {
      render(
        <PaymentTransactionList
          {...baseProps}
          data={[makePaymentItem()]}
          pagination={{ page: 1, limit: 20, total: 25, totalPages: 2 }}
        />,
      )

      expect(screen.getByLabelText('Previous page')).toBeInTheDocument()
      expect(screen.getByLabelText('Next page')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument()
      expect(screen.getByText('25 total')).toBeInTheDocument()
    })

    it('should disable previous button on first page', () => {
      render(
        <PaymentTransactionList
          {...baseProps}
          data={[makePaymentItem()]}
          pagination={{ page: 1, limit: 20, total: 25, totalPages: 2 }}
        />,
      )

      expect(screen.getByLabelText('Previous page')).toBeDisabled()
    })

    it('should disable next button on last page', () => {
      render(
        <PaymentTransactionList
          {...baseProps}
          page={2}
          data={[makePaymentItem()]}
          pagination={{ page: 2, limit: 20, total: 25, totalPages: 2 }}
        />,
      )

      expect(screen.getByLabelText('Next page')).toBeDisabled()
    })

    it('should call onPageChange when next is clicked', async () => {
      const onPageChange = vi.fn()
      render(
        <PaymentTransactionList
          {...baseProps}
          onPageChange={onPageChange}
          data={[makePaymentItem()]}
          pagination={{ page: 1, limit: 20, total: 25, totalPages: 2 }}
        />,
      )

      await userEvent.click(screen.getByLabelText('Next page'))
      expect(onPageChange).toHaveBeenCalledWith(2)
    })
  })
})
