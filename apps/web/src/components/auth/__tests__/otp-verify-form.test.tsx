import { screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import { OtpVerifyForm } from '../otp-verify-form'

const defaultProps = {
  identifier: '+91 98765 43210',
  onEdit: vi.fn(),
  onVerify: vi.fn().mockResolvedValue({ isNewUser: false }),
  onResend: vi.fn().mockResolvedValue(undefined),
  isPending: false,
  error: null as Error | null,
}

describe('OtpVerifyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should render 4 individual input boxes', () => {
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(4)
    expect(screen.getByLabelText('Digit 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Digit 4')).toBeInTheDocument()
  })

  it('should auto-focus first box on mount', () => {
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    expect(screen.getByLabelText('Digit 1')).toHaveFocus()
  })

  it('should move focus to next box when digit entered', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    await user.type(screen.getByLabelText('Digit 1'), '1')

    expect(screen.getByLabelText('Digit 2')).toHaveFocus()
  })

  it('should move focus to previous box on backspace', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    await user.type(screen.getByLabelText('Digit 1'), '1')
    // Now on Digit 2 — press backspace on empty Digit 2
    await user.keyboard('{Backspace}')

    expect(screen.getByLabelText('Digit 1')).toHaveFocus()
  })

  it('should support pasting full 4-digit OTP', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    const digit1 = screen.getByLabelText('Digit 1')
    await user.click(digit1)
    await user.paste('1234')

    expect(screen.getByLabelText('Digit 1')).toHaveValue('1')
    expect(screen.getByLabelText('Digit 2')).toHaveValue('2')
    expect(screen.getByLabelText('Digit 3')).toHaveValue('3')
    expect(screen.getByLabelText('Digit 4')).toHaveValue('4')
  })

  it('should auto-submit when all 4 digits entered', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    await user.click(screen.getByLabelText('Digit 1'))
    await user.paste('0000')

    await waitFor(() => {
      expect(defaultProps.onVerify).toHaveBeenCalledWith('0000')
    })
  })

  it('should show countdown timer starting at 30s', () => {
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    expect(screen.getByText(/resend otp in 0:30/i)).toBeInTheDocument()
  })

  it('should show "Resend OTP" button after countdown reaches 0', async () => {
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    act(() => {
      vi.advanceTimersByTime(31_000)
    })

    expect(screen.getByRole('button', { name: /resend otp/i })).toBeInTheDocument()
  })

  it('should call onVerify with OTP string on success', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    await user.click(screen.getByLabelText('Digit 1'))
    await user.paste('0000')

    await waitFor(() => {
      expect(defaultProps.onVerify).toHaveBeenCalledWith('0000')
    })
  })

  it('should display identifier with Edit link', () => {
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    expect(screen.getByText(/\+91 98765 43210/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('should show error message when error prop is set', () => {
    const error = Object.assign(new Error('Invalid OTP'), { status: 401 })
    renderWithQuery(<OtpVerifyForm {...defaultProps} error={error} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('should clear digits and shake on verify failure', async () => {
    const failingVerify = vi.fn().mockRejectedValue(new Error('Invalid OTP'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQuery(<OtpVerifyForm {...defaultProps} onVerify={failingVerify} />)

    await user.click(screen.getByLabelText('Digit 1'))
    await user.paste('1234')

    await waitFor(() => {
      expect(failingVerify).toHaveBeenCalledWith('1234')
    })

    // Digits should be cleared after error
    await waitFor(() => {
      expect(screen.getByLabelText('Digit 1')).toHaveValue('')
    })
  })

  it('should show Verifying text when isPending is true', () => {
    renderWithQuery(<OtpVerifyForm {...defaultProps} isPending={true} />)

    expect(screen.getByText(/verifying/i)).toBeInTheDocument()
  })

  it('should call onEdit when Edit button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /edit/i }))

    expect(defaultProps.onEdit).toHaveBeenCalled()
  })

  it('should call onResend and reset countdown when Resend clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    act(() => {
      vi.advanceTimersByTime(31_000)
    })

    await user.click(screen.getByRole('button', { name: /resend otp/i }))

    expect(defaultProps.onResend).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText(/resend otp in 0:30/i)).toBeInTheDocument()
    })
  })

  it('should display custom identifierLabel', () => {
    renderWithQuery(<OtpVerifyForm {...defaultProps} identifier="test@example.com" identifierLabel="Code sent to" />)

    expect(screen.getByText(/code sent to/i)).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('should render 6 input boxes when otpLength is 6', () => {
    renderWithQuery(<OtpVerifyForm {...defaultProps} otpLength={6} />)

    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(6)
    expect(screen.getByLabelText('Digit 6')).toBeInTheDocument()
  })

  it('should auto-submit 6-digit OTP when otpLength is 6', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQuery(<OtpVerifyForm {...defaultProps} otpLength={6} />)

    await user.click(screen.getByLabelText('Digit 1'))
    await user.paste('123456')

    await waitFor(() => {
      expect(defaultProps.onVerify).toHaveBeenCalledWith('123456')
    })
  })
})
