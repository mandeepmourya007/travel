import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import { NumberInput } from './number-input'

describe('NumberInput', () => {
  it('should render with label and placeholder', () => {
    renderWithQuery(<NumberInput value="" onChange={vi.fn()} label="Age" id="age" placeholder="28" />)

    expect(screen.getByLabelText('Age')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('28')).toBeInTheDocument()
  })

  it('should only allow numeric input', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithQuery(<NumberInput value="" onChange={onChange} id="num" />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'abc5')

    // Only '5' should pass
    expect(onChange).toHaveBeenLastCalledWith('5')
  })

  it('should allow empty value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithQuery(<NumberInput value="5" onChange={onChange} id="num" />)

    const input = screen.getByRole('textbox')
    await user.clear(input)

    expect(onChange).toHaveBeenCalledWith('')
  })

  it('should show min validation error on blur', async () => {
    const user = userEvent.setup()
    renderWithQuery(<NumberInput value="0" onChange={vi.fn()} id="age" min={1} />)

    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.tab()

    expect(screen.getByRole('alert')).toHaveTextContent('Must be at least 1')
  })

  it('should show max validation error on blur', async () => {
    const user = userEvent.setup()
    renderWithQuery(<NumberInput value="200" onChange={vi.fn()} id="age" max={120} />)

    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.tab()

    expect(screen.getByRole('alert')).toHaveTextContent('Must be at most 120')
  })

  it('should clear validation error when value is corrected', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { rerender } = renderWithQuery(
      <NumberInput value="0" onChange={onChange} id="age" min={1} />,
    )

    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.tab()
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Simulate value correction
    rerender(<NumberInput value="5" onChange={onChange} id="age" min={1} />)
    await user.click(input)
    await user.type(input, '5')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('should allow decimal when allowDecimal is true', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithQuery(<NumberInput value="" onChange={onChange} id="price" allowDecimal />)

    const input = screen.getByRole('textbox')
    await user.type(input, '4')
    expect(onChange).toHaveBeenLastCalledWith('4')

    await user.type(input, '.')
    expect(onChange).toHaveBeenLastCalledWith('.')

    await user.type(input, '5')
    expect(onChange).toHaveBeenLastCalledWith('5')
  })

  it('should reject decimal when allowDecimal is false', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithQuery(<NumberInput value="4" onChange={onChange} id="qty" />)

    const input = screen.getByRole('textbox')
    await user.type(input, '.')

    // '.' should be rejected — last valid call should still be a digit
    const calls = onChange.mock.calls.map(c => c[0])
    expect(calls).not.toContain('4.')
  })

  it('should display external error over internal', () => {
    renderWithQuery(<NumberInput value="0" onChange={vi.fn()} id="x" min={1} error="Required" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Required')
  })

  it('should render prefix and suffix', () => {
    renderWithQuery(<NumberInput value="500" onChange={vi.fn()} id="price" prefix="₹" suffix="per person" />)

    expect(screen.getByText('₹')).toBeInTheDocument()
    expect(screen.getByText('per person')).toBeInTheDocument()
  })

  it('should set inputMode to numeric by default', () => {
    renderWithQuery(<NumberInput value="" onChange={vi.fn()} id="num" />)

    expect(screen.getByRole('textbox')).toHaveAttribute('inputMode', 'numeric')
  })

  it('should set inputMode to decimal when allowDecimal', () => {
    renderWithQuery(<NumberInput value="" onChange={vi.fn()} id="num" allowDecimal />)

    expect(screen.getByRole('textbox')).toHaveAttribute('inputMode', 'decimal')
  })
})
