import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HoldCountdownBanner } from '../hold-countdown-banner'

function isoFromNow(ms: number) {
  return new Date(Date.now() + ms).toISOString()
}

describe('HoldCountdownBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the remaining time in m:ss format', () => {
    render(<HoldCountdownBanner expiresAt={isoFromNow(10 * 60 * 1000)} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/your seats are reserved/i)).toBeInTheDocument()
    expect(screen.getByText('10:00')).toBeInTheDocument()
  })

  it('counts down each second', () => {
    render(<HoldCountdownBanner expiresAt={isoFromNow(10 * 60 * 1000)} />)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByText('9:57')).toBeInTheDocument()
  })

  it('switches to an expired alert when the hold runs out', () => {
    render(<HoldCountdownBanner expiresAt={isoFromNow(2000)} />)

    act(() => {
      vi.advanceTimersByTime(2500)
    })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/seat hold has expired/i)).toBeInTheDocument()
  })

  it('renders the expired alert immediately for past timestamps', () => {
    render(<HoldCountdownBanner expiresAt={isoFromNow(-1000)} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/seat hold has expired/i)).toBeInTheDocument()
  })
})
