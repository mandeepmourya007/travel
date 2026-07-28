import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { renderWithQuery } from '@/test/test-utils'
import { API_BASE_URL as API } from '@/test/test-constants'
import { SendPayoutModal } from '../send-payout-modal'
import { makePendingPayoutItem, makeReleasePayoutResult, resetPayoutFactory } from '@/test/factories/payout.factory'
import type { ReleasePayoutResult } from '@shared/types/admin.types'

// This codebase has no existing pattern of mocking a mutation hook directly with
// vi.mock() in a component test (checked profile/reviews/home modal tests) — the
// established convention is to drive TanStack Query hooks through real MSW responses
// (see edit-profile-modal.test.tsx). We follow that here rather than mocking
// useAdminReleasePayout.
function mockRelease(result: ReleasePayoutResult) {
  server.use(
    http.post(`${API}/admin/payouts/:organizerId/release`, () =>
      HttpResponse.json({ success: true, data: result }),
    ),
  )
}

describe('SendPayoutModal', () => {
  beforeEach(() => {
    resetPayoutFactory()
    vi.clearAllMocks()
  })

  it('closes the modal when the release result status is "released"', async () => {
    mockRelease(makeReleasePayoutResult({ status: 'released', releasedAmount: 5000 }))
    const organizer = makePendingPayoutItem({ balance: 5000 })
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderWithQuery(<SendPayoutModal open onClose={onClose} organizer={organizer} />)

    await user.click(screen.getByRole('button', { name: /^send payout$/i }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('keeps the modal open when the release result status is "insufficient_balance"', async () => {
    mockRelease(makeReleasePayoutResult({ status: 'insufficient_balance', releasedAmount: 0 }))
    const organizer = makePendingPayoutItem({ balance: 5000 })
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderWithQuery(<SendPayoutModal open onClose={onClose} organizer={organizer} />)

    await user.click(screen.getByRole('button', { name: /^send payout$/i }))

    await waitFor(() => {
      expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument()
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps the modal open when the release result status is "failed"', async () => {
    mockRelease(makeReleasePayoutResult({ status: 'failed', releasedAmount: 0 }))
    const organizer = makePendingPayoutItem({ balance: 5000 })
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderWithQuery(<SendPayoutModal open onClose={onClose} organizer={organizer} />)

    await user.click(screen.getByRole('button', { name: /^send payout$/i }))

    await waitFor(() => {
      expect(screen.getByText(/payout failed/i)).toBeInTheDocument()
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps the modal open when the release result status is "ledger_mismatch"', async () => {
    mockRelease(makeReleasePayoutResult({ status: 'ledger_mismatch', releasedAmount: 5000, payoutId: 'payout_9' }))
    const organizer = makePendingPayoutItem({ balance: 5000 })
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderWithQuery(<SendPayoutModal open onClose={onClose} organizer={organizer} />)

    await user.click(screen.getByRole('button', { name: /^send payout$/i }))

    await waitFor(() => {
      expect(screen.getByText(/balance may be out of sync/i)).toBeInTheDocument()
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})
