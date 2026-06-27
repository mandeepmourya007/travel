import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, beforeEach } from 'vitest'
import { useTrips, useTrendingTrips } from '../use-trips'
import { createTestQueryClient } from '@/test/test-utils'
import { makeTripSummary, resetTripFactory } from '@/test/factories/trip.factory'
import { server } from '@/test/mocks/server'
import { API_BASE_URL as API } from '@/test/test-constants'

const DEFAULT_PAGINATION = { page: 1, limit: 12, total: 0, totalPages: 0 }

function createWrapper() {
  const queryClient = createTestQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useTrips', () => {
  beforeEach(() => resetTripFactory())

  it('fetches trips from the API and returns them', async () => {
    const trips = [makeTripSummary(), makeTripSummary()]
    server.use(
      http.get(`${API}/trips`, () =>
        HttpResponse.json({
          success: true,
          data: trips,
          pagination: { page: 1, limit: 12, total: 2, totalPages: 1 },
        }),
      ),
    )

    const { result } = renderHook(() => useTrips({}), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.trips).toHaveLength(2)
    expect(result.current.data?.pagination?.total).toBe(2)
  })

  it('passes filters as query params to the API', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API}/trips`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ success: true, data: [], pagination: DEFAULT_PAGINATION })
      }),
    )

    const { result } = renderHook(
      () => useTrips({ destinationId: 'dest-abc', tripType: 'BEACH', minPrice: 5000 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(capturedUrl).toContain('destinationId=dest-abc')
    expect(capturedUrl).toContain('tripType=BEACH')
    expect(capturedUrl).toContain('minPrice=5000')
  })

  it('shows initialData immediately before the API responds', async () => {
    const initialTrips = [makeTripSummary({ title: 'SSR Trip' })]
    server.use(
      http.get(`${API}/trips`, async () => {
        await new Promise((r) => setTimeout(r, 100))
        return HttpResponse.json({ success: true, data: [], pagination: DEFAULT_PAGINATION })
      }),
    )

    const { result } = renderHook(
      () => useTrips({}, { initialData: { trips: initialTrips, pagination: null } }),
      { wrapper: createWrapper() },
    )

    // SSR data available synchronously — no loading state shown
    expect(result.current.data?.trips[0].title).toBe('SSR Trip')
    expect(result.current.isLoading).toBe(false)
  })

  it('refetches in the background when staleTime is 0 (filter pages)', async () => {
    const initialTrips = [makeTripSummary()]
    let fetchCount = 0
    server.use(
      http.get(`${API}/trips`, () => {
        fetchCount++
        return HttpResponse.json({ success: true, data: [], pagination: DEFAULT_PAGINATION })
      }),
    )

    renderHook(
      () => useTrips({}, { initialData: { trips: initialTrips, pagination: null } }),
      { wrapper: createWrapper() },
    )

    // staleTime: 0 + initialDataUpdatedAt: 0 → data immediately stale → background refetch
    await waitFor(() => expect(fetchCount).toBeGreaterThan(0))
  })

  it('refetches when filter query key changes', async () => {
    let lastUrl = ''
    server.use(
      http.get(`${API}/trips`, ({ request }) => {
        lastUrl = request.url
        return HttpResponse.json({ success: true, data: [], pagination: DEFAULT_PAGINATION })
      }),
    )

    const { rerender } = renderHook(
      ({ filters }: { filters: Parameters<typeof useTrips>[0] }) => useTrips(filters),
      { wrapper: createWrapper(), initialProps: { filters: { tripType: 'BEACH' } } },
    )

    await waitFor(() => expect(lastUrl).toContain('tripType=BEACH'))

    rerender({ filters: { tripType: 'ADVENTURE' } })

    await waitFor(() => expect(lastUrl).toContain('tripType=ADVENTURE'))
  })
})

describe('useTrendingTrips', () => {
  beforeEach(() => resetTripFactory())

  it('fetches trending trips (sort=popularity, limit=6) when no initialData', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API}/trips`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          success: true,
          data: [makeTripSummary(), makeTripSummary()],
          pagination: { page: 1, limit: 6, total: 2, totalPages: 1 },
        })
      }),
    )

    const { result } = renderHook(() => useTrendingTrips(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.trips).toHaveLength(2)
    expect(capturedUrl).toContain('sort=popularity')
    expect(capturedUrl).toContain('limit=6')
  })

  it('does NOT immediately refetch when initialData is fresh within the 2-minute staleTime', async () => {
    const initialTrips = [makeTripSummary({ title: 'SSR Trending' })]
    let fetchCount = 0
    server.use(
      http.get(`${API}/trips`, () => {
        fetchCount++
        return HttpResponse.json({ success: true, data: [], pagination: DEFAULT_PAGINATION })
      }),
    )

    const { result } = renderHook(
      () => useTrendingTrips({ trips: initialTrips, pagination: null }),
      { wrapper: createWrapper() },
    )

    // SSR data shown immediately
    expect(result.current.data?.trips[0].title).toBe('SSR Trending')

    // Wait a tick — with staleTime: 2min and initialDataUpdatedAt: Date.now(),
    // React Query treats the data as fresh → NO background refetch
    await new Promise((r) => setTimeout(r, 50))
    expect(fetchCount).toBe(0)
  })

  it('returns initialData when provided', () => {
    const initialTrips = [makeTripSummary(), makeTripSummary()]

    const { result } = renderHook(
      () => useTrendingTrips({ trips: initialTrips, pagination: null }),
      { wrapper: createWrapper() },
    )

    expect(result.current.data?.trips).toHaveLength(2)
    expect(result.current.isLoading).toBe(false)
  })
})
