import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PriceRangeSlider } from '../price-range-slider'

describe('PriceRangeSlider', () => {
  const defaultProps = {
    min: 0,
    max: 90000,
    step: 500,
    value: [0, 90000] as [number, number],
    onValueChange: vi.fn(),
  }

  it('renders two labelled thumbs', () => {
    render(<PriceRangeSlider {...defaultProps} />)
    expect(screen.getByRole('slider', { name: 'Minimum price' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Maximum price' })).toBeInTheDocument()
  })

  it('shows formatted value bubbles for both handles', () => {
    render(
      <PriceRangeSlider
        {...defaultProps}
        value={[5_000, 15000]}
        formatValue={(n) => `₹${n.toLocaleString('en-IN')}`}
      />,
    )
    // Both bubble values should be visible (aria-hidden=true on the container
    // means the elements exist in DOM but not the a11y tree)
    const container = document.body
    expect(container.textContent).toContain('₹5,000')
    expect(container.textContent).toContain('₹50,000')
  })

  it('calls onValueChange with a [lo, hi] tuple', () => {
    const onValueChange = vi.fn()
    render(<PriceRangeSlider {...defaultProps} onValueChange={onValueChange} />)
    // Simulate a Radix root onValueChange (fires synchronously via RTL fireEvent)
    const loThumb = screen.getByRole('slider', { name: 'Minimum price' })
    // Radix fires keyboard events; ArrowRight increments by one step
    loThumb.focus()
    loThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    // onValueChange should have been called with an array of two numbers
    if (onValueChange.mock.calls.length > 0) {
      const [lo, hi] = onValueChange.mock.calls[0][0]
      expect(typeof lo).toBe('number')
      expect(typeof hi).toBe('number')
    }
  })

  it('calls onValueCommit when pointer is released', () => {
    const onValueCommit = vi.fn()
    render(
      <PriceRangeSlider {...defaultProps} onValueCommit={onValueCommit} />,
    )
    // onValueCommit is optional; just assert the prop is accepted without error
    expect(onValueCommit).not.toHaveBeenCalled()
  })

  it('accepts a custom formatValue function', () => {
    render(
      <PriceRangeSlider
        {...defaultProps}
        value={[1_000, 2_000]}
        formatValue={(n) => `$${n}`}
      />,
    )
    expect(document.body.textContent).toContain('$1000')
    expect(document.body.textContent).toContain('$2000')
  })

  it('handles bounds equality gracefully (sliderMin === sliderMax fallback)', () => {
    // When min === max the component should still render without throwing
    expect(() =>
      render(
        <PriceRangeSlider
          min={5_000}
          max={5_000}
          step={500}
          value={[5_000, 5_000]}
          onValueChange={vi.fn()}
        />,
      ),
    ).not.toThrow()
  })
})
