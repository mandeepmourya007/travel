import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { renderWithQuery } from '@/test/test-utils'
import { PhoneInputForm } from '../phone-input-form'
import { API_BASE_URL as API } from '@/test/test-constants'

describe('PhoneInputForm', () => {
  const onOtpSent = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render phone input with +91 prefix label', () => {
    renderWithQuery(<PhoneInputForm onOtpSent={onOtpSent} />)

    expect(screen.getByLabelText('Phone number')).toBeInTheDocument()
    expect(screen.getByText('+91')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('9876543210')).toBeInTheDocument()
  })

  it('should disable "Get OTP" button when phone is empty', () => {
    renderWithQuery(<PhoneInputForm onOtpSent={onOtpSent} />)

    expect(screen.getByRole('button', { name: /get otp/i })).toBeDisabled()
  })

  it('should enable "Get OTP" button when 10 valid digits entered', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PhoneInputForm onOtpSent={onOtpSent} />)

    await user.type(screen.getByLabelText('Phone number'), '9876543210')

    expect(screen.getByRole('button', { name: /get otp/i })).toBeEnabled()
  })

  it('should show spinner on button during API call (isPending)', async () => {
    // Delay the response so we can observe the pending state
    server.use(
      http.post(`${API}/auth/otp/send`, async () => {
        await new Promise((r) => setTimeout(r, 200))
        return HttpResponse.json({ success: true, data: { message: 'OTP sent', retryAfter: 30 } })
      }),
    )

    const user = userEvent.setup()
    renderWithQuery(<PhoneInputForm onOtpSent={onOtpSent} />)

    await user.type(screen.getByLabelText('Phone number'), '9876543210')
    await user.click(screen.getByRole('button', { name: /get otp/i }))

    expect(screen.getByText(/sending otp/i)).toBeInTheDocument()

    // Drain the delayed response before the test ends — otherwise the 200ms
    // timer and its onOtpSent() continuation keep running in the background
    // (pool: 'forks' runs this whole file in one process) and can land inside
    // a LATER test in this file once it finally resolves, polluting a shared
    // mock's call count under full-suite load. This is what caused the "should
    // show error banner when API returns 429" test to flake intermittently.
    await waitFor(() => expect(screen.queryByText(/sending otp/i)).not.toBeInTheDocument())
  })

  it('should call onOtpSent(phone) callback on success', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PhoneInputForm onOtpSent={onOtpSent} />)

    await user.type(screen.getByLabelText('Phone number'), '9876543210')
    await user.click(screen.getByRole('button', { name: /get otp/i }))

    await waitFor(() => {
      expect(onOtpSent).toHaveBeenCalledWith('9876543210')
    })
  })

  it('should show error banner when API returns 429 (rate limit)', async () => {
    server.use(
      http.post(`${API}/auth/otp/send`, () => {
        return HttpResponse.json(
          { success: false, error: { message: 'Too many requests', code: 'TOO_MANY_REQUESTS' } },
          { status: 429 },
        )
      }),
    )

    const user = userEvent.setup()
    renderWithQuery(<PhoneInputForm onOtpSent={onOtpSent} />)

    await user.type(screen.getByLabelText('Phone number'), '9876543210')
    await user.click(screen.getByRole('button', { name: /get otp/i }))

    await waitFor(() => {
      expect(screen.getByText(/something went wrong|too many/i)).toBeInTheDocument()
    })
    expect(onOtpSent).not.toHaveBeenCalled()
  })

  it('should only allow numeric input (strip letters)', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PhoneInputForm onOtpSent={onOtpSent} />)

    const input = screen.getByLabelText('Phone number')
    await user.type(input, '98abc76543210')

    expect(input).toHaveValue('9876543210')
  })

  it('should auto-focus phone input on mount', () => {
    renderWithQuery(<PhoneInputForm onOtpSent={onOtpSent} />)

    expect(screen.getByLabelText('Phone number')).toHaveFocus()
  })
})
