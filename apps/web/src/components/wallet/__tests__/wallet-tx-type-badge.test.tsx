import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { WalletTxTypeBadge } from '../wallet-tx-type-badge'
import type { WalletTransactionType } from '@shared/types/wallet.types'

describe('WalletTxTypeBadge', () => {
  const cases: Array<{ type: WalletTransactionType; label: string; colorClass: string }> = [
    { type: 'REFUND', label: 'Refund', colorClass: 'bg-success-50' },
    { type: 'CASHBACK', label: 'Cashback', colorClass: 'bg-highlight-50' },
    { type: 'BOOKING_DEDUCTION', label: 'Booking', colorClass: 'bg-accent-50' },
    { type: 'ADMIN_CREDIT', label: 'Admin Credit', colorClass: 'bg-primary-50' },
    { type: 'ADMIN_DEBIT', label: 'Admin Debit', colorClass: 'bg-error-50' },
    { type: 'PROMOTIONAL_CREDIT', label: 'Promo', colorClass: 'bg-highlight-50' },
    { type: 'EXPIRY', label: 'Expired', colorClass: 'bg-neutral-100' },
  ]

  it.each(cases)(
    'should render "$label" with $colorClass for type $type',
    ({ type, label, colorClass }) => {
      render(<WalletTxTypeBadge type={type} />)

      const badge = screen.getByText(label)
      expect(badge).toBeInTheDocument()
      expect(badge.className).toContain(colorClass)
    },
  )
})
