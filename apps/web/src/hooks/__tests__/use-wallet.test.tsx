import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, beforeEach } from 'vitest'
import { useWalletBalance, useWalletTransactions } from '../use-wallet'
import { createTestQueryClient } from '@/test/test-utils'
import { makeWalletSummary, makeWalletTxItem, resetWalletFactory } from '@/test/factories/wallet.factory'
import { server } from '@/test/mocks/server'

const API = 'http://localhost:4000/api/v1'

function createWrapper() {
  const queryClient = createTestQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

beforeEach(() => resetWalletFactory())

// ═════════════════════════════════════════════════════
// useWalletBalance
// ═════════════════════════════════════════════════════
describe('useWalletBalance', () => {
  it('should return wallet summary on success', async () => {
    const summary = makeWalletSummary({ balance: 2500 })
    server.use(
      http.get(`${API}/wallet`, () =>
        HttpResponse.json({ success: true, data: summary }),
      ),
    )

    const { result } = renderHook(() => useWalletBalance(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data?.balance).toBe(2500)
    expect(result.current.data?.currency).toBe('INR')
    expect(result.current.data?.totalCredits).toBe(3500)
    expect(result.current.data?.totalDebits).toBe(1000)
    expect(result.current.error).toBeNull()
  })

  it('should return error when API fails', async () => {
    server.use(
      http.get(`${API}/wallet`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } },
          { status: 401 },
        ),
      ),
    )

    const { result } = renderHook(() => useWalletBalance(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).not.toBeNull()
    expect(result.current.data).toBeUndefined()
  })

  it('should return zero balance for new wallet', async () => {
    const summary = makeWalletSummary({ balance: 0, totalCredits: 0, totalDebits: 0, totalCashback: 0 })
    server.use(
      http.get(`${API}/wallet`, () =>
        HttpResponse.json({ success: true, data: summary }),
      ),
    )

    const { result } = renderHook(() => useWalletBalance(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data?.balance).toBe(0)
  })
})

// ═════════════════════════════════════════════════════
// useWalletTransactions
// ═════════════════════════════════════════════════════
describe('useWalletTransactions', () => {
  it('should return paginated transactions on success', async () => {
    const items = [makeWalletTxItem(), makeWalletTxItem({ type: 'CASHBACK' })]
    server.use(
      http.get(`${API}/wallet/transactions`, () =>
        HttpResponse.json({
          success: true,
          data: items,
          pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    )

    const { result } = renderHook(() => useWalletTransactions({ page: 1, limit: 20 }), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data?.data).toHaveLength(2)
    expect(result.current.data?.pagination.total).toBe(2)
    expect(result.current.error).toBeNull()
  })

  it('should return empty data when no transactions exist', async () => {
    server.use(
      http.get(`${API}/wallet/transactions`, () =>
        HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }),
      ),
    )

    const { result } = renderHook(() => useWalletTransactions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data?.data).toEqual([])
    expect(result.current.data?.pagination.total).toBe(0)
  })

  it('should return error when API fails', async () => {
    server.use(
      http.get(`${API}/wallet/transactions`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'SERVER_ERROR', message: 'Internal error' } },
          { status: 500 },
        ),
      ),
    )

    const { result } = renderHook(() => useWalletTransactions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).not.toBeNull()
  })

  it('should pass type filter to API', async () => {
    let capturedUrl: string | undefined
    server.use(
      http.get(`${API}/wallet/transactions`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          success: true,
          data: [makeWalletTxItem({ type: 'REFUND' })],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        })
      }),
    )

    const { result } = renderHook(
      () => useWalletTransactions({ type: 'REFUND', page: 1, limit: 20 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(capturedUrl).toContain('type=REFUND')
    expect(result.current.data?.data).toHaveLength(1)
  })
})
