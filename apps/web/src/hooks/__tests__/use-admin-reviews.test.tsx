import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useAdminReviews } from '../use-admin-reviews'
import { useAuthStore } from '@/store/auth.store'
import { createTestQueryClient } from '@/test/test-utils'
import { makeAdminReviewItem, resetReviewFactory, PAGINATION_DEFAULT } from '@/test/factories/review.factory'
import { server } from '@/test/mocks/server'
import { API_BASE_URL as API } from '@/test/test-constants'

function createWrapper() {
  const queryClient = createTestQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  resetReviewFactory()
  useAuthStore.setState({ accessToken: 'test-token' })
})

afterEach(() => {
  useAuthStore.setState({ accessToken: null })
})

// ═════════════════════════════════════════════════════
// useAdminReviews
// ═════════════════════════════════════════════════════
describe('useAdminReviews', () => {
  it('should return paginated admin reviews on success', async () => {
    const reviews = [
      makeAdminReviewItem(),
      makeAdminReviewItem({ overallRating: 2, organizerReply: 'Thank you!' }),
    ]
    server.use(
      http.get(`${API}/admin/reviews`, () =>
        HttpResponse.json({
          success: true,
          data: reviews,
          pagination: { ...PAGINATION_DEFAULT, total: 2, totalPages: 1 },
        }),
      ),
    )

    const { result } = renderHook(
      () => useAdminReviews({ page: 1 }),
      { wrapper: createWrapper() },
    )

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data?.data).toHaveLength(2)
    expect(result.current.data?.data[1].organizerReply).toBe('Thank you!')
    expect(result.current.data?.pagination.total).toBe(2)
    expect(result.current.error).toBeNull()
  })

  it('should pass organizerSearch and tripSearch as query params', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API}/admin/reviews`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          success: true,
          data: [makeAdminReviewItem()],
          pagination: { ...PAGINATION_DEFAULT, total: 1, totalPages: 1 },
        })
      }),
    )

    const { result } = renderHook(
      () => useAdminReviews({ organizerSearch: 'Desi', tripSearch: 'Goa', rating: 4 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(capturedUrl).toContain('organizerSearch=Desi')
    expect(capturedUrl).toContain('tripSearch=Goa')
    expect(capturedUrl).toContain('rating=4')
  })

  it('should pass sortBy and sortOrder as query params', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API}/admin/reviews`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { ...PAGINATION_DEFAULT },
        })
      }),
    )

    const { result } = renderHook(
      () => useAdminReviews({ sortBy: 'overallRating', sortOrder: 'asc' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(capturedUrl).toContain('sortBy=overallRating')
    expect(capturedUrl).toContain('sortOrder=asc')
  })

  it('should return empty list when no reviews match filters', async () => {
    server.use(
      http.get(`${API}/admin/reviews`, () =>
        HttpResponse.json({
          success: true,
          data: [],
          pagination: { ...PAGINATION_DEFAULT },
        }),
      ),
    )

    const { result } = renderHook(
      () => useAdminReviews({ organizerSearch: 'NonExistentOrganizer' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data?.data).toHaveLength(0)
    expect(result.current.data?.pagination.total).toBe(0)
  })

  it('should return error on API failure', async () => {
    server.use(
      http.get(`${API}/admin/reviews`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } },
          { status: 403 },
        ),
      ),
    )

    const { result } = renderHook(
      () => useAdminReviews({}),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).not.toBeNull()
    expect(result.current.data).toBeUndefined()
  })
})
