import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PaymentFilters } from '../payment-filters'

const defaultProps = {
  onTypeChange: vi.fn(),
  onStatusChange: vi.fn(),
  onFromDateChange: vi.fn(),
  onToDateChange: vi.fn(),
}

describe('PaymentFilters', () => {
  it('should render all four filter controls', () => {
    render(<PaymentFilters {...defaultProps} />)

    expect(screen.getByLabelText('Type')).toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toBeInTheDocument()
    expect(screen.getByLabelText('From')).toBeInTheDocument()
    expect(screen.getByLabelText('To')).toBeInTheDocument()
  })

  it('should show all payment types from shared schema', () => {
    render(<PaymentFilters {...defaultProps} />)

    const typeSelect = screen.getByLabelText('Type')
    expect(typeSelect).toHaveTextContent('All Types')
    expect(typeSelect).toHaveTextContent('Payment')
    expect(typeSelect).toHaveTextContent('Refund')
    expect(typeSelect).toHaveTextContent('Escrow Release')
  })

  it('should show all statuses with human-readable labels', () => {
    render(<PaymentFilters {...defaultProps} />)

    const statusSelect = screen.getByLabelText('Status')
    expect(statusSelect).toHaveTextContent('All Statuses')
    expect(statusSelect).toHaveTextContent('Pending')
    expect(statusSelect).toHaveTextContent('Authorized')
    expect(statusSelect).toHaveTextContent('Captured')
    expect(statusSelect).toHaveTextContent('Refunded')
    expect(statusSelect).toHaveTextContent('Failed')
  })

  it('should call onTypeChange when type is selected', async () => {
    const onTypeChange = vi.fn()
    render(<PaymentFilters {...defaultProps} onTypeChange={onTypeChange} />)

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'REFUND')

    expect(onTypeChange).toHaveBeenCalledWith('REFUND')
  })

  it('should call onStatusChange when status is selected', async () => {
    const onStatusChange = vi.fn()
    render(<PaymentFilters {...defaultProps} onStatusChange={onStatusChange} />)

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'FAILED')

    expect(onStatusChange).toHaveBeenCalledWith('FAILED')
  })

  it('should call onTypeChange with undefined when "All Types" is selected', async () => {
    const onTypeChange = vi.fn()
    render(<PaymentFilters {...defaultProps} activeType="PAYMENT" onTypeChange={onTypeChange} />)

    await userEvent.selectOptions(screen.getByLabelText('Type'), '')

    expect(onTypeChange).toHaveBeenCalledWith(undefined)
  })

  it('should not show clear button when no filters are active', () => {
    render(<PaymentFilters {...defaultProps} />)

    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument()
  })

  it('should show clear button when at least one filter is active', () => {
    render(<PaymentFilters {...defaultProps} activeType="PAYMENT" />)

    expect(screen.getByText('Clear filters')).toBeInTheDocument()
  })

  it('should call all reset callbacks when clear button is clicked', async () => {
    const onTypeChange = vi.fn()
    const onStatusChange = vi.fn()
    const onFromDateChange = vi.fn()
    const onToDateChange = vi.fn()
    render(
      <PaymentFilters
        activeType="PAYMENT"
        activeStatus="CAPTURED"
        fromDate="2025-01-01"
        toDate="2025-01-31"
        onTypeChange={onTypeChange}
        onStatusChange={onStatusChange}
        onFromDateChange={onFromDateChange}
        onToDateChange={onToDateChange}
      />,
    )

    await userEvent.click(screen.getByText('Clear filters'))

    expect(onTypeChange).toHaveBeenCalledWith(undefined)
    expect(onStatusChange).toHaveBeenCalledWith(undefined)
    expect(onFromDateChange).toHaveBeenCalledWith(undefined)
    expect(onToDateChange).toHaveBeenCalledWith(undefined)
  })

  it('should reflect active filter values in the controls', () => {
    render(
      <PaymentFilters
        {...defaultProps}
        activeType="REFUND"
        activeStatus="FAILED"
        fromDate="2025-01-01"
        toDate="2025-01-31"
      />,
    )

    expect(screen.getByLabelText('Type')).toHaveValue('REFUND')
    expect(screen.getByLabelText('Status')).toHaveValue('FAILED')
    expect(screen.getByLabelText('From')).toHaveValue('2025-01-01')
    expect(screen.getByLabelText('To')).toHaveValue('2025-01-31')
  })
})
