import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, it, expect } from 'vitest'
import { useCompareTrips } from '../use-compare-trips'
import { createTestQueryClient } from '@/test/test-utils'
import { makeTripDetail, resetTripFactory } from '@/test/factories/trip.factory'
import { server } from '@/test/mocks/server'

function createWrapper() {
  const queryClient = createTestQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('useCompareTrips', () => {
  beforeEach(() => resetTripFactory())

  it('returns empty trips array when given no slugs', () => {
    const { result } = renderHook(() => useCompareTrips([]), {
      wrapper: createWrapper(),
    })

    expect(result.current.trips).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('fetches trip details for each slug', async () => {
    const trip1 = makeTripDetail({ slug: 'goa-beach', title: 'Goa Beach Trip' })
    const trip2 = makeTripDetail({ slug: 'manali-trek', title: 'Manali Trek' })

    server.use(
      http.get('*/trips/slug/goa-beach', () =>
        HttpResponse.json({ success: true, data: trip1 }),
      ),
      http.get('*/trips/slug/manali-trek', () =>
        HttpResponse.json({ success: true, data: trip2 }),
      ),
    )

    const { result } = renderHook(
      () => useCompareTrips(['goa-beach', 'manali-trek']),
      { wrapper: createWrapper() },
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.trips).toHaveLength(2)
    expect(result.current.trips[0].title).toBe('Goa Beach Trip')
    expect(result.current.trips[1].title).toBe('Manali Trek')
    expect(result.current.error).toBeNull()
  })

  it('reports error when any slug fetch fails', async () => {
    server.use(
      http.get('*/trips/slug/good-trip', () =>
        HttpResponse.json({
          success: true,
          data: makeTripDetail({ slug: 'good-trip' }),
        }),
      ),
      http.get('*/trips/slug/bad-trip', () =>
        HttpResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } },
          { status: 404 },
        ),
      ),
    )

    const { result } = renderHook(
      () => useCompareTrips(['good-trip', 'bad-trip']),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).not.toBeNull()
  })

  it('handles 3 trips (max comparison)', async () => {
    const slugs = ['trip-a', 'trip-b', 'trip-c']
    slugs.forEach((slug) => {
      server.use(
        http.get(`*/trips/slug/${slug}`, () =>
          HttpResponse.json({
            success: true,
            data: makeTripDetail({ slug }),
          }),
        ),
      )
    })

    const { result } = renderHook(() => useCompareTrips(slugs), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.trips).toHaveLength(3)
  })
})
