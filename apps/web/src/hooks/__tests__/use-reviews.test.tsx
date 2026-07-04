import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useOrganizerReviews, useMyReviews } from '../use-reviews'
import { useAuthStore } from '@/store/auth.store'
import { createTestQueryClient } from '@/test/test-utils'
import { makeReview, resetReviewFactory, PAGINATION_DEFAULT } from '@/test/factories/review.factory'
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
// useOrganizerReviews
// ═════════════════════════════════════════════════════
describe('useOrganizerReviews', () => {
  it('should return paginated reviews on success', async () => {
    const reviews = [makeReview(), makeReview({ overallRating: 5 })]
    server.use(
      http.get(`${API}/reviews/organizer/mine`, () =>
        HttpResponse.json({
          success: true,
          data: reviews,
          pagination: { ...PAGINATION_DEFAULT, total: 2, totalPages: 1 },
        }),
      ),
    )

    const { result } = renderHook(() => useOrganizerReviews(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data?.data).toHaveLength(2)
    expect(result.current.data?.pagination.total).toBe(2)
    expect(result.current.error).toBeNull()
  })

  it('should pass tripId and rating filters as query params', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API}/reviews/organizer/mine`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          success: true,
          data: [makeReview()],
          pagination: { ...PAGINATION_DEFAULT, total: 1, totalPages: 1 },
        })
      }),
    )

    const { result } = renderHook(
      () => useOrganizerReviews({ tripId: 'trip_abc', rating: 4 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(capturedUrl).toContain('tripId=trip_abc')
    expect(capturedUrl).toContain('rating=4')
  })

  it('should return error when API fails', async () => {
    server.use(
      http.get(`${API}/reviews/organizer/mine`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'No organizer profile' } },
          { status: 403 },
        ),
      ),
    )

    const { result } = renderHook(() => useOrganizerReviews(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).not.toBeNull()
    expect(result.current.data).toBeUndefined()
  })

  it('should return empty list with zero total', async () => {
    server.use(
      http.get(`${API}/reviews/organizer/mine`, () =>
        HttpResponse.json({
          success: true,
          data: [],
          pagination: { ...PAGINATION_DEFAULT, total: 0, totalPages: 0 },
        }),
      ),
    )

    const { result } = renderHook(() => useOrganizerReviews(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data?.data).toHaveLength(0)
    expect(result.current.data?.pagination.total).toBe(0)
  })
})

// ═════════════════════════════════════════════════════
// useMyReviews
// ═════════════════════════════════════════════════════
describe('useMyReviews', () => {
  it('should return paginated reviews written by the user', async () => {
    const reviews = [makeReview(), makeReview({ comment: 'Second review' })]
    server.use(
      http.get(`${API}/reviews/my`, () =>
        HttpResponse.json({
          success: true,
          data: reviews,
          pagination: { ...PAGINATION_DEFAULT, total: 2, totalPages: 1 },
        }),
      ),
    )

    const { result } = renderHook(() => useMyReviews(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data?.data).toHaveLength(2)
    expect(result.current.data?.data[1].comment).toBe('Second review')
    expect(result.current.error).toBeNull()
  })

  it('should pass sort filter as query param', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API}/reviews/my`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { ...PAGINATION_DEFAULT },
        })
      }),
    )

    const { result } = renderHook(
      () => useMyReviews({ sort: 'rating_high' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(capturedUrl).toContain('sort=rating_high')
  })

  it('should return error when API fails', async () => {
    server.use(
      http.get(`${API}/reviews/my`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
          { status: 401 },
        ),
      ),
    )

    const { result } = renderHook(() => useMyReviews(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).not.toBeNull()
  })
})
