import { renderHook, waitFor, screen } from '@testing-library/react'
import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, beforeEach } from 'vitest'
import { server } from '@/test/mocks/server'
import { createTestQueryClient } from '@/test/test-utils'
import { ToastProvider } from '@/components/shared/toast'
import { API_BASE_URL as API } from '@/test/test-constants'
import {
  useAdminPendingPayouts,
  useAdminPayoutHistory,
  useAdminReleasePayout,
} from '../use-admin-payouts'
import { makePendingPayoutItem, makeReleasePayoutResult, resetPayoutFactory } from '@/test/factories/payout.factory'

function createWrapper() {
  const queryClient = createTestQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    )
  }
}

beforeEach(() => {
  resetPayoutFactory()
})

describe('useAdminPendingPayouts', () => {
  it('sends page/limit query params and returns the {data, pagination} shape', async () => {
    let capturedUrl: string | undefined
    const item = makePendingPayoutItem({ organizerId: 'org_1' })
    server.use(
      http.get(`${API}/admin/payouts/pending`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          success: true,
          data: [item],
          pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
        })
      }),
    )

    const { result } = renderHook(() => useAdminPendingPayouts({ page: 2, limit: 10 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(capturedUrl).toContain('page=2')
    expect(capturedUrl).toContain('limit=10')
    expect(result.current.data?.data).toEqual([item])
    expect(result.current.data?.pagination).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 })
  })
})

describe('useAdminPayoutHistory', () => {
  it('returns the paginated {data, pagination} shape from GET /admin/payouts', async () => {
    server.use(
      http.get(`${API}/admin/payouts`, () => {
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        })
      }),
    )

    const { result } = renderHook(() => useAdminPayoutHistory({ page: 1, limit: 20 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data?.data).toEqual([])
    expect(result.current.data?.pagination.total).toBe(0)
  })
})

describe('useAdminReleasePayout', () => {
  it('shows a "warning" variant toast (not error/success) for the ledger_mismatch status', async () => {
    server.use(
      http.post(`${API}/admin/payouts/:organizerId/release`, () =>
        HttpResponse.json({
          success: true,
          data: makeReleasePayoutResult({ status: 'ledger_mismatch', releasedAmount: 5000, payoutId: 'payout_9' }),
        }),
      ),
    )

    const { result } = renderHook(() => useAdminReleasePayout(), { wrapper: createWrapper() })

    result.current.mutate({ organizerId: 'org_1', amount: 5000 })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.status).toBe('ledger_mismatch')

    // ToastProvider renders the live toast into the DOM — assert the warning
    // styling class is applied (per toast.tsx's VARIANT_STYLES), not the error
    // or success one, confirming the hook picked the 'warning' branch.
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Payout sent, balance may be out of sync')
    expect(alert.className).toContain('bg-warning-50')
    expect(alert.className).not.toContain('bg-error-50')
    expect(alert.className).not.toContain('bg-success-50')
  })

  it('shows an "error" variant toast for the failed status', async () => {
    server.use(
      http.post(`${API}/admin/payouts/:organizerId/release`, () =>
        HttpResponse.json({
          success: true,
          data: makeReleasePayoutResult({ status: 'failed', releasedAmount: 0 }),
        }),
      ),
    )

    const { result } = renderHook(() => useAdminReleasePayout(), { wrapper: createWrapper() })

    result.current.mutate({ organizerId: 'org_1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Payout failed')
    expect(alert.className).toContain('bg-error-50')
  })
})
