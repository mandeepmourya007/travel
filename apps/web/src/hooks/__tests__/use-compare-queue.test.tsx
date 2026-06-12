import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { ToastProvider } from '@/components/shared/toast'
import { CompareQueueProvider, useCompareQueue } from '../use-compare-queue'
import { makeTripSummary, resetTripFactory } from '@/test/factories/trip.factory'

function Harness() {
  const { items, toggle } = useCompareQueue()
  return (
    <div>
      <span data-testid="count">{items.length}</span>
      <ul>
        {items.map((i) => (
          <li key={i.id}>{i.title}</li>
        ))}
      </ul>
      <button onClick={() => toggle(makeTripSummary({ title: 'Added Trip' }))}>Add</button>
    </div>
  )
}

function renderHarness() {
  return render(
    <ToastProvider>
      <CompareQueueProvider>
        <Harness />
      </CompareQueueProvider>
    </ToastProvider>,
  )
}

describe('useCompareQueue', () => {
  beforeEach(() => {
    resetTripFactory()
    localStorage.clear()
  })

  it('adds trips up to the maximum of 3', async () => {
    renderHarness()
    const addBtn = screen.getByText('Add')

    for (let i = 0; i < 3; i++) {
      act(() => {
        addBtn.click()
      })
    }

    expect(screen.getByTestId('count')).toHaveTextContent('3')
  })

  it('toggling an already-queued trip removes it', () => {
    renderHarness()
    resetTripFactory()
    const addBtn = screen.getByText('Add')
    act(() => addBtn.click())
    expect(screen.getByTestId('count')).toHaveTextContent('1')

    // Same factory counter → same trip id → toggle removes
    resetTripFactory()
    act(() => addBtn.click())
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('shows a toast instead of silently ignoring the 4th add', () => {
    renderHarness()
    const addBtn = screen.getByText('Add')

    for (let i = 0; i < 4; i++) {
      act(() => addBtn.click())
    }

    // Queue stays at 3 and the user is told why
    expect(screen.getByTestId('count')).toHaveTextContent('3')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/compare up to 3 trips/i)).toBeInTheDocument()
  })
})
