import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SeatsLeftBadge } from '../seats-left-badge'

describe('SeatsLeftBadge', () => {
  it('shows "Sold out" with error styling when no seats remain', () => {
    render(<SeatsLeftBadge maxGroupSize={10} currentBookings={10} />)
    const badge = screen.getByText('Sold out')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-error-50')
    expect(badge.className).toContain('text-error-500')
  })

  it('shows "Only N seats left!" with accent styling when seats are urgent (≤5)', () => {
    render(<SeatsLeftBadge maxGroupSize={10} currentBookings={7} />)
    const badge = screen.getByText('Only 3 seats left!')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-accent-50')
    expect(badge.className).toContain('text-accent-700')
  })

  it('shows "1 seat left" as urgent with accent styling', () => {
    render(<SeatsLeftBadge maxGroupSize={10} currentBookings={9} />)
    const badge = screen.getByText('Only 1 seat left!')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-accent-50')
  })

  it('shows seat count with warning styling when seats are plentiful (>5)', () => {
    render(<SeatsLeftBadge maxGroupSize={20} currentBookings={8} />)
    const badge = screen.getByText('12 seats left')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-warning-50')
    expect(badge.className).toContain('text-warning-500')
  })

  it('treats exactly 5 seats left as urgent', () => {
    render(<SeatsLeftBadge maxGroupSize={10} currentBookings={5} />)
    const badge = screen.getByText('Only 5 seats left!')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-accent-50')
  })

  it('treats exactly 6 seats left as non-urgent', () => {
    render(<SeatsLeftBadge maxGroupSize={10} currentBookings={4} />)
    const badge = screen.getByText('6 seats left')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-warning-50')
  })

  it('clamps overbooking to "Sold out" without negative seat counts', () => {
    render(<SeatsLeftBadge maxGroupSize={10} currentBookings={15} />)
    const badge = screen.getByText('Sold out')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-error-50')
  })

  it('accepts and forwards className prop', () => {
    render(<SeatsLeftBadge maxGroupSize={20} currentBookings={7} className="mt-1 absolute" />)
    const badge = screen.getByText('13 seats left')
    expect(badge.className).toContain('mt-1')
    expect(badge.className).toContain('absolute')
  })
})
