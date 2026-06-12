import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ToastProvider, useToast } from '../toast'

function TestTrigger({ variant = 'success' as const, duration }: { variant?: 'success' | 'warning' | 'error' | 'info'; duration?: number }) {
  const { toast } = useToast()
  return (
    <button
      onClick={() => toast({ variant, title: 'Test Toast', description: 'A description', duration })}
    >
      Trigger
    </button>
  )
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

describe('ToastProvider + useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws when useToast is called outside provider', () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestTrigger />)).toThrow('useToast must be used within <ToastProvider>')
    spy.mockRestore()
  })

  it('renders a toast when triggered', () => {
    renderWithProvider(<TestTrigger />)

    fireEvent.click(screen.getByText('Trigger'))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Test Toast')).toBeInTheDocument()
    expect(screen.getByText('A description')).toBeInTheDocument()
  })

  it('auto-dismisses after default duration (4000ms)', () => {
    renderWithProvider(<TestTrigger />)

    fireEvent.click(screen.getByText('Trigger'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Advance past duration to trigger dismissWithAnimation
    act(() => {
      vi.advanceTimersByTime(4100)
    })
    // Advance past the 200ms exit animation setTimeout
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('auto-dismisses after custom duration', () => {
    renderWithProvider(<TestTrigger duration={1000} />)

    fireEvent.click(screen.getByText('Trigger'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1100)
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('dismisses toast on close button click', () => {
    renderWithProvider(<TestTrigger />)

    fireEvent.click(screen.getByText('Trigger'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Dismiss'))
    // Advance past the 200ms exit animation setTimeout
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders multiple toasts', () => {
    renderWithProvider(<TestTrigger />)

    fireEvent.click(screen.getByText('Trigger'))
    fireEvent.click(screen.getByText('Trigger'))

    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })

  it('applies correct variant styles', () => {
    renderWithProvider(<TestTrigger variant="error" />)

    fireEvent.click(screen.getByText('Trigger'))
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('error')
  })

  it('renders an action button that fires the callback and dismisses the toast', () => {
    const onAction = vi.fn()

    function ActionTrigger() {
      const { toast } = useToast()
      return (
        <button
          onClick={() =>
            toast({
              variant: 'info',
              title: 'New message',
              action: { label: 'View', onClick: onAction },
            })
          }
        >
          Trigger
        </button>
      )
    }

    renderWithProvider(<ActionTrigger />)

    fireEvent.click(screen.getByText('Trigger'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByText('View'))
    expect(onAction).toHaveBeenCalledTimes(1)

    // Acting on the toast also dismisses it (after the exit animation)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not render an action button when no action is provided', () => {
    renderWithProvider(<TestTrigger />)

    fireEvent.click(screen.getByText('Trigger'))
    expect(screen.queryByText('View')).not.toBeInTheDocument()
  })
})
