import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WalletTransactionList } from '../wallet-transaction-list'
import { makeWalletTxItem, resetWalletFactory } from '@/test/factories/wallet.factory'

beforeEach(() => {
  resetWalletFactory()
})

const baseProps = {
  isLoading: false,
  error: null,
  page: 1,
  onPageChange: vi.fn(),
}

describe('WalletTransactionList', () => {
  describe('4-state rendering', () => {
    it('should render loading skeletons when isLoading is true', () => {
      const { container } = render(
        <WalletTransactionList {...baseProps} isLoading={true} data={undefined} />,
      )

      const skeletons = container.querySelectorAll('.skeleton')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('should render error state with message when error is present', () => {
      const onRetry = vi.fn()
      render(
        <WalletTransactionList
          {...baseProps}
          error={new Error('API failed')}
          data={undefined}
          onRetry={onRetry}
        />,
      )

      expect(screen.getByText('Failed to load wallet transactions')).toBeInTheDocument()
    })

    it('should render empty state when data is empty array', () => {
      render(<WalletTransactionList {...baseProps} data={[]} />)

      expect(
        screen.getByText('No wallet transactions yet. Your refunds, cashback, and credits will appear here.'),
      ).toBeInTheDocument()
    })

    it('should render empty state when data is undefined and not loading', () => {
      render(<WalletTransactionList {...baseProps} data={undefined} />)

      expect(
        screen.getByText('No wallet transactions yet. Your refunds, cashback, and credits will appear here.'),
      ).toBeInTheDocument()
    })

    it('should render transaction rows when data is present', () => {
      const items = [
        makeWalletTxItem(),
        makeWalletTxItem({ type: 'BOOKING_DEDUCTION', description: 'Booking deduction' }),
      ]
      render(<WalletTransactionList {...baseProps} data={items} />)

      // Desktop table + mobile card both render the text (2 each)
      expect(screen.getAllByText('Refund for booking #TRP-2025-0001')).toHaveLength(2)
      expect(screen.getAllByText('Booking deduction')).toHaveLength(2)
    })
  })

  describe('amount display', () => {
    it('should prefix credit amounts with +', () => {
      render(
        <WalletTransactionList
          {...baseProps}
          data={[makeWalletTxItem({ type: 'REFUND', amount: 500 })]}
        />,
      )

      expect(screen.getAllByText(/\+₹500/).length).toBeGreaterThan(0)
    })

    it('should prefix debit amounts with -', () => {
      render(
        <WalletTransactionList
          {...baseProps}
          data={[makeWalletTxItem({ type: 'BOOKING_DEDUCTION', amount: 700 })]}
        />,
      )

      expect(screen.getAllByText(/-₹700/).length).toBeGreaterThan(0)
    })
  })

  describe('transaction type badges', () => {
    it('should show type badge for each transaction', () => {
      render(
        <WalletTransactionList
          {...baseProps}
          data={[makeWalletTxItem({ type: 'CASHBACK' })]}
        />,
      )

      expect(screen.getAllByText('Cashback').length).toBeGreaterThan(0)
    })
  })

  describe('pagination', () => {
    it('should not show pagination when totalPages is 1', () => {
      render(
        <WalletTransactionList
          {...baseProps}
          data={[makeWalletTxItem()]}
          pagination={{ page: 1, limit: 20, total: 1, totalPages: 1 }}
        />,
      )

      expect(screen.queryByLabelText('Previous page')).not.toBeInTheDocument()
    })

    it('should show pagination when totalPages > 1', () => {
      render(
        <WalletTransactionList
          {...baseProps}
          data={[makeWalletTxItem()]}
          pagination={{ page: 1, limit: 20, total: 25, totalPages: 2 }}
        />,
      )

      expect(screen.getByLabelText('Previous page')).toBeInTheDocument()
      expect(screen.getByLabelText('Next page')).toBeInTheDocument()
      expect(screen.getByText('1 / 2')).toBeInTheDocument()
      expect(screen.getByText('25 total')).toBeInTheDocument()
    })

    it('should disable previous button on first page', () => {
      render(
        <WalletTransactionList
          {...baseProps}
          data={[makeWalletTxItem()]}
          pagination={{ page: 1, limit: 20, total: 25, totalPages: 2 }}
        />,
      )

      expect(screen.getByLabelText('Previous page')).toBeDisabled()
    })

    it('should disable next button on last page', () => {
      render(
        <WalletTransactionList
          {...baseProps}
          page={2}
          data={[makeWalletTxItem()]}
          pagination={{ page: 2, limit: 20, total: 25, totalPages: 2 }}
        />,
      )

      expect(screen.getByLabelText('Next page')).toBeDisabled()
    })

    it('should call onPageChange when next is clicked', async () => {
      const onPageChange = vi.fn()
      render(
        <WalletTransactionList
          {...baseProps}
          onPageChange={onPageChange}
          data={[makeWalletTxItem()]}
          pagination={{ page: 1, limit: 20, total: 25, totalPages: 2 }}
        />,
      )

      await userEvent.click(screen.getByLabelText('Next page'))
      expect(onPageChange).toHaveBeenCalledWith(2)
    })
  })
})
