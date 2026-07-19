import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WelcomeModal } from '../welcome-modal'

const WELCOME_SEEN_KEY = 'home_welcome_seen'

describe('WelcomeModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens on first render when the session flag is not set', () => {
    render(<WelcomeModal />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('sets the session flag immediately on open', () => {
    render(<WelcomeModal />)
    expect(sessionStorage.getItem(WELCOME_SEEN_KEY)).toBe('1')
  })

  it('does not open on a later render within the same session', () => {
    sessionStorage.setItem(WELCOME_SEEN_KEY, '1')
    render(<WelcomeModal />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('auto-hides after 3 seconds', () => {
    render(<WelcomeModal />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes early via the close button and does not fire the auto-hide timer afterward', () => {
    render(<WelcomeModal />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // The auto-hide timer must be cleared on early close — advancing time
    // must not throw or attempt to re-close an unmounted/closed modal.
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clears the auto-hide timer on unmount', () => {
    const { unmount } = render(<WelcomeModal />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    unmount()

    // Should not throw when the timer would have fired post-unmount.
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(3000)
      })
    }).not.toThrow()
  })
})
