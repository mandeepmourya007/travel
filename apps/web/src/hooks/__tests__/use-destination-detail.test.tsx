import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, beforeEach } from 'vitest'
import { useDestinationDetail } from '../use-destination-detail'
import { createTestQueryClient } from '@/test/test-utils'
import { makeTripSummary, resetTripFactory } from '@/test/factories/trip.factory'
import { server } from '@/test/mocks/server'
import { API_BASE_URL as API } from '@/test/test-constants'
import type { DestinationDetailResponse } from '@shared/types/destination.types'

function makeDestinationDetailResponse(
  slug = 'goa',
  overrides: Partial<DestinationDetailResponse> = {},
): DestinationDetailResponse {
  return {
    destination: {
      id: 'dest-1',
      name: 'Goa',
      slug,
      state: 'Goa',
      tripCount: 5,
      isPopular: true,
    },
    trips: [makeTripSummary()],
    tripsPagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
    stats: { avgPrice: 8000, organizerCount: 3, upcomingCount: 2, minPrice: 5000, maxPrice: 15000 },
    relatedDestinations: [],
    ...overrides,
  }
}

function createWrapper() {
  const queryClient = createTestQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useDestinationDetail', () => {
  beforeEach(() => resetTripFactory())

  it('fetches destination detail for a given slug', async () => {
    const mockData = makeDestinationDetailResponse('goa')
    server.use(
      http.get(`${API}/destinations/slug/goa`, () =>
        HttpResponse.json({ success: true, data: mockData }),
      ),
    )

    const { result } = renderHook(() => useDestinationDetail('goa'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.destination.slug).toBe('goa')
    expect(result.current.data?.trips).toHaveLength(1)
  })

  it('does not fetch when slug is empty', () => {
    const { result } = renderHook(
      () => useDestinationDetail(''),
      { wrapper: createWrapper() },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('passes filter query params to the API', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API}/destinations/slug/manali`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ success: true, data: makeDestinationDetailResponse('manali') })
      }),
    )

    const { result } = renderHook(
      () =>
        useDestinationDetail('manali', 1, undefined, {
          tripType: 'ADVENTURE',
          sort: 'price_asc',
          minPrice: 3000,
          maxPrice: 12000,
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(capturedUrl).toContain('tripType=ADVENTURE')
    expect(capturedUrl).toContain('sort=price_asc')
    expect(capturedUrl).toContain('minPrice=3000')
    expect(capturedUrl).toContain('maxPrice=12000')
  })

  it('passes the page param to the API', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API}/destinations/slug/goa`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ success: true, data: makeDestinationDetailResponse() })
      }),
    )

    const { result } = renderHook(
      () => useDestinationDetail('goa', 3),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(capturedUrl).toContain('page=3')
  })

  it('shows initialData immediately before the API responds', async () => {
    const initialData = makeDestinationDetailResponse('shimla', {
      destination: {
        id: 'dest-2',
        name: 'Shimla',
        slug: 'shimla',
        state: 'Himachal Pradesh',
        tripCount: 2,
        isPopular: false,
      },
    })
    server.use(
      http.get(`${API}/destinations/slug/shimla`, async () => {
        await new Promise((r) => setTimeout(r, 100))
        return HttpResponse.json({ success: true, data: makeDestinationDetailResponse('shimla') })
      }),
    )

    const { result } = renderHook(
      () => useDestinationDetail('shimla', 1, initialData),
      { wrapper: createWrapper() },
    )

    expect(result.current.data?.destination.name).toBe('Shimla')
    expect(result.current.isLoading).toBe(false)
  })

  it('background-refetches immediately because staleTime is 0', async () => {
    const initialData = makeDestinationDetailResponse()
    let fetchCount = 0
    server.use(
      http.get(`${API}/destinations/slug/goa`, () => {
        fetchCount++
        return HttpResponse.json({ success: true, data: makeDestinationDetailResponse() })
      }),
    )

    renderHook(
      () => useDestinationDetail('goa', 1, initialData),
      { wrapper: createWrapper() },
    )

    // staleTime: 0 + initialDataUpdatedAt: 0 → immediately stale → background refetch
    await waitFor(() => expect(fetchCount).toBeGreaterThan(0))
  })

  it('uses distinct cache keys for different filter combinations', async () => {
    const urls: string[] = []
    server.use(
      http.get(`${API}/destinations/slug/kerala`, ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json({ success: true, data: makeDestinationDetailResponse('kerala') })
      }),
    )

    const wrapper = createWrapper()

    const { result: r1 } = renderHook(
      () => useDestinationDetail('kerala', 1, undefined, { tripType: 'BEACH' }),
      { wrapper },
    )
    const { result: r2 } = renderHook(
      () => useDestinationDetail('kerala', 1, undefined, { tripType: 'ADVENTURE' }),
      { wrapper },
    )

    await waitFor(() => expect(r1.current.isLoading).toBe(false))
    await waitFor(() => expect(r2.current.isLoading).toBe(false))

    // Two different filter combos → two separate API calls
    expect(urls.length).toBeGreaterThanOrEqual(2)
    expect(urls.some((u) => u.includes('tripType=BEACH'))).toBe(true)
    expect(urls.some((u) => u.includes('tripType=ADVENTURE'))).toBe(true)
  })

  it('refetches when page changes', async () => {
    const pages: string[] = []
    server.use(
      http.get(`${API}/destinations/slug/goa`, ({ request }) => {
        const url = new URL(request.url)
        pages.push(url.searchParams.get('page') ?? '')
        return HttpResponse.json({ success: true, data: makeDestinationDetailResponse() })
      }),
    )

    const { rerender } = renderHook(
      ({ page }: { page: number }) => useDestinationDetail('goa', page),
      { wrapper: createWrapper(), initialProps: { page: 1 } },
    )

    await waitFor(() => expect(pages).toContain('1'))

    rerender({ page: 2 })

    await waitFor(() => expect(pages).toContain('2'))
  })
})
