import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { WalletFilters } from '../wallet-filters'

describe('WalletFilters', () => {
  it('should render All button and type filter buttons', () => {
    render(<WalletFilters onTypeChange={vi.fn()} />)

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Refunds')).toBeInTheDocument()
    expect(screen.getByText('Cashback')).toBeInTheDocument()
    expect(screen.getByText('Bookings')).toBeInTheDocument()
    expect(screen.getByText('Admin Credit')).toBeInTheDocument()
    expect(screen.getByText('Admin Debit')).toBeInTheDocument()
    expect(screen.getByText('Promo')).toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('should highlight All button when no type is active', () => {
    render(<WalletFilters onTypeChange={vi.fn()} />)

    const allButton = screen.getByText('All')
    expect(allButton.className).toContain('bg-primary-600')
  })

  it('should highlight active type button', () => {
    render(<WalletFilters activeType="REFUND" onTypeChange={vi.fn()} />)

    const refundButton = screen.getByText('Refunds')
    expect(refundButton.className).toContain('bg-primary-600')

    const allButton = screen.getByText('All')
    expect(allButton.className).not.toContain('bg-primary-600')
  })

  it('should call onTypeChange with type when a filter is clicked', async () => {
    const onTypeChange = vi.fn()
    render(<WalletFilters onTypeChange={onTypeChange} />)

    await userEvent.click(screen.getByText('Cashback'))

    expect(onTypeChange).toHaveBeenCalledWith('CASHBACK')
  })

  it('should call onTypeChange with undefined when All is clicked', async () => {
    const onTypeChange = vi.fn()
    render(<WalletFilters activeType="REFUND" onTypeChange={onTypeChange} />)

    await userEvent.click(screen.getByText('All'))

    expect(onTypeChange).toHaveBeenCalledWith(undefined)
  })

  it('should toggle off active type when same button is clicked', async () => {
    const onTypeChange = vi.fn()
    render(<WalletFilters activeType="REFUND" onTypeChange={onTypeChange} />)

    await userEvent.click(screen.getByText('Refunds'))

    expect(onTypeChange).toHaveBeenCalledWith(undefined)
  })
})
