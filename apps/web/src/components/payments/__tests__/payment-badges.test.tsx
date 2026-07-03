import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PaymentStatusBadge } from '../payment-status-badge'
import { PaymentTypeBadge } from '../payment-type-badge'

describe('PaymentStatusBadge', () => {
  it('should show "Pending" label for INITIATED status', () => {
    render(<PaymentStatusBadge status="INITIATED" />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('should show "Captured" label for CAPTURED status', () => {
    render(<PaymentStatusBadge status="CAPTURED" />)
    expect(screen.getByText('Captured')).toBeInTheDocument()
  })

  it('should show "Failed" label for FAILED status', () => {
    render(<PaymentStatusBadge status="FAILED" />)
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('should show "Refunded" label for REFUNDED status', () => {
    render(<PaymentStatusBadge status="REFUNDED" />)
    expect(screen.getByText('Refunded')).toBeInTheDocument()
  })

  it('should show "Authorized" label for AUTHORIZED status', () => {
    render(<PaymentStatusBadge status="AUTHORIZED" />)
    expect(screen.getByText('Authorized')).toBeInTheDocument()
  })

  it('should fallback to raw status for unknown values', () => {
    render(<PaymentStatusBadge status="UNKNOWN_STATUS" />)
    expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument()
  })
})

describe('PaymentTypeBadge', () => {
  it('should show "Payment" for PAYMENT type', () => {
    render(<PaymentTypeBadge type="PAYMENT" />)
    expect(screen.getByText('Payment')).toBeInTheDocument()
  })

  it('should show "Refund" for full REFUND type', () => {
    render(<PaymentTypeBadge type="REFUND" />)
    expect(screen.getByText('Refund')).toBeInTheDocument()
  })

  it('should show "Partial Refund" for REFUND type when isPartialRefund is true', () => {
    render(<PaymentTypeBadge type="REFUND" isPartialRefund />)
    expect(screen.getByText('Partial Refund')).toBeInTheDocument()
  })

  it('should show "SafePay" for ESCROW_RELEASE type', () => {
    render(<PaymentTypeBadge type="ESCROW_RELEASE" />)
    expect(screen.getByText('SafePay')).toBeInTheDocument()
  })

  it('should fallback to raw type for unknown values', () => {
    render(<PaymentTypeBadge type="SOME_TYPE" />)
    expect(screen.getByText('SOME_TYPE')).toBeInTheDocument()
  })
})
