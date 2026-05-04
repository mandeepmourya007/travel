import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import { EmailInput } from './email-input'

describe('EmailInput', () => {
  it('should render with label and placeholder', () => {
    renderWithQuery(<EmailInput value="" onChange={vi.fn()} />)

    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
  })

  it('should convert input to lowercase on change', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithQuery(<EmailInput value="" onChange={onChange} />)

    await user.type(screen.getByLabelText('Email address'), 'A')

    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('should trim value on blur', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithQuery(<EmailInput value=" test@example.com " onChange={onChange} />)

    await user.click(screen.getByLabelText('Email address'))
    await user.tab()

    expect(onChange).toHaveBeenCalledWith('test@example.com')
  })

  it('should show format error after blur with invalid email', async () => {
    const user = userEvent.setup()
    renderWithQuery(<EmailInput value="notanemail" onChange={vi.fn()} />)

    await user.click(screen.getByLabelText('Email address'))
    await user.tab()

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address')
  })

  it('should not show format error before blur', () => {
    renderWithQuery(<EmailInput value="notanemail" onChange={vi.fn()} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('should not show format error for valid email after blur', async () => {
    const user = userEvent.setup()
    renderWithQuery(<EmailInput value="test@example.com" onChange={vi.fn()} />)

    await user.click(screen.getByLabelText('Email address'))
    await user.tab()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('should display external error over format error', () => {
    renderWithQuery(<EmailInput value="bad" onChange={vi.fn()} error="Server error" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Server error')
  })

  it('should support custom label and id', () => {
    renderWithQuery(<EmailInput value="" onChange={vi.fn()} label="Work email" id="work-email" />)

    expect(screen.getByLabelText('Work email')).toBeInTheDocument()
  })
})
