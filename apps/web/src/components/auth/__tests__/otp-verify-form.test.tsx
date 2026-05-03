import { screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { renderWithQuery } from '@/test/test-utils'
import { OtpVerifyForm } from '../otp-verify-form'

const defaultProps = {
  phone: '9876543210',
  onVerified: vi.fn(),
  onEdit: vi.fn(),
  onResend: vi.fn().mockResolvedValue(undefined),
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
      expect(defaultProps.onVerified).toHaveBeenCalledWith({ isNewUser: true })
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

  it('should call onVerified(data) callback on success', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    await user.click(screen.getByLabelText('Digit 1'))
    await user.paste('0000')

    await waitFor(() => {
      expect(defaultProps.onVerified).toHaveBeenCalledWith({ isNewUser: true })
    })
  })

  it('should display phone number with Edit link', () => {
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    expect(screen.getByText(/\+91 98765 43210/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('should show error message on wrong code', async () => {
    server.use(
      http.post('*/auth/otp/verify', () => {
        return HttpResponse.json(
          { success: false, error: { message: 'Invalid OTP', code: 'AUTH_ERROR' } },
          { status: 401 },
        )
      }),
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    await user.click(screen.getByLabelText('Digit 1'))
    await user.paste('1234')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(defaultProps.onVerified).not.toHaveBeenCalled()
  })

  it('should disable verify button during pending state', async () => {
    server.use(
      http.post('*/auth/otp/verify', async () => {
        await new Promise((r) => setTimeout(r, 500))
        return HttpResponse.json({
          success: true,
          data: {
            user: { id: 'u1', name: 'User', role: 'TRAVELER' },
            tokens: { accessToken: 'tok', expiresIn: 900 },
            isNewUser: true,
          },
        })
      }),
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithQuery(<OtpVerifyForm {...defaultProps} />)

    // Manually type digits to enter them without triggering immediate auto-submit race
    await user.type(screen.getByLabelText('Digit 1'), '0')
    await user.type(screen.getByLabelText('Digit 2'), '0')
    await user.type(screen.getByLabelText('Digit 3'), '0')
    // After the 4th digit, auto-submit fires
    await user.type(screen.getByLabelText('Digit 4'), '0')

    await waitFor(() => {
      expect(screen.getByText(/verifying/i)).toBeInTheDocument()
    })
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
})
