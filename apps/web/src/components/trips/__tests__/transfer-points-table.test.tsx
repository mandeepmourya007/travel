import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransferPointsTable } from '../transfer-points-table'
import type { TransferPoint } from '@shared/types/trip.types'

const pickupPoints: TransferPoint[] = [
  { id: 'pp-1', type: 'PICKUP', label: 'Delhi Airport T3', time: '06:00 AM', extraCharge: 500, sortOrder: 0, address: null },
  { id: 'pp-2', type: 'PICKUP', label: 'Kashmere Gate ISBT', time: null, extraCharge: 0, sortOrder: 1, address: null },
]

const dropPoints: TransferPoint[] = [
  { id: 'dp-1', type: 'DROP', label: 'Delhi Airport T3', time: '08:00 PM', extraCharge: 300, sortOrder: 0, address: null },
]

describe('TransferPointsTable', () => {
  it('should return null when both arrays are empty', () => {
    const { container } = render(<TransferPointsTable pickupPoints={[]} dropPoints={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('should render pickup and drop point tables', () => {
    render(<TransferPointsTable pickupPoints={pickupPoints} dropPoints={dropPoints} />)

    expect(screen.getByText('Pickup Points')).toBeInTheDocument()
    expect(screen.getByText('Drop Points')).toBeInTheDocument()
    expect(screen.getAllByText('Delhi Airport T3')).toHaveLength(2)
    expect(screen.getByText('Kashmere Gate ISBT')).toBeInTheDocument()
  })

  it('should display time or dash when time is null', () => {
    render(<TransferPointsTable pickupPoints={pickupPoints} dropPoints={dropPoints} />)

    expect(screen.getByText('06:00 AM')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('should show extra charge or Included label', () => {
    render(<TransferPointsTable pickupPoints={pickupPoints} dropPoints={dropPoints} />)

    expect(screen.getByText('Included')).toBeInTheDocument()
    // +₹500 and +₹300 rendered via formatCurrency
    expect(screen.getByText(/500/)).toBeInTheDocument()
    expect(screen.getByText(/300/)).toBeInTheDocument()
  })

  it('should render only pickup section when drop points are empty', () => {
    render(<TransferPointsTable pickupPoints={pickupPoints} dropPoints={[]} />)

    expect(screen.getByText('Pickup Points')).toBeInTheDocument()
    expect(screen.getByText('No drop points specified')).toBeInTheDocument()
  })

  it('should render only drop section when pickup points are empty', () => {
    render(<TransferPointsTable pickupPoints={[]} dropPoints={dropPoints} />)

    expect(screen.getByText('No pickup points specified')).toBeInTheDocument()
    expect(screen.getByText('Drop Points')).toBeInTheDocument()
  })
})
