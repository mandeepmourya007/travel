import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import { PhoneInput } from './phone-input'

describe('PhoneInput', () => {
  it('should render with label, prefix, and placeholder', () => {
    renderWithQuery(<PhoneInput value="" onChange={vi.fn()} />)

    expect(screen.getByLabelText('Phone number')).toBeInTheDocument()
    expect(screen.getByText('+91')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('9876543210')).toBeInTheDocument()
  })

  it('should strip non-digits from input', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithQuery(<PhoneInput value="" onChange={onChange} />)

    await user.type(screen.getByLabelText('Phone number'), 'abc9')

    // Only '9' should pass through
    expect(onChange).toHaveBeenLastCalledWith('9')
  })

  it('should cap at 10 digits', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithQuery(<PhoneInput value="9876543210" onChange={onChange} />)

    await user.type(screen.getByLabelText('Phone number'), '5')

    // Should still be 10 digits (capped)
    expect(onChange).toHaveBeenLastCalledWith('9876543210')
  })

  it('should show format error for invalid 10-digit number', () => {
    renderWithQuery(<PhoneInput value="1234567890" onChange={vi.fn()} />)

    // Starts with 1, not 6-9 — should show error
    expect(screen.getByRole('alert')).toHaveTextContent('Must be a valid 10-digit Indian mobile number')
  })

  it('should not show format error for incomplete input', () => {
    renderWithQuery(<PhoneInput value="98765" onChange={vi.fn()} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('should not show format error for valid phone', () => {
    renderWithQuery(<PhoneInput value="9876543210" onChange={vi.fn()} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('should display external error over format error', () => {
    renderWithQuery(<PhoneInput value="1234567890" onChange={vi.fn()} error="Phone already registered" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Phone already registered')
  })

  it('should set aria-invalid when error is present', () => {
    renderWithQuery(<PhoneInput value="1234567890" onChange={vi.fn()} />)

    expect(screen.getByLabelText('Phone number')).toHaveAttribute('aria-invalid', 'true')
  })
})
