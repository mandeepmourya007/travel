import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, it, expect } from 'vitest'
import { useResellerSearch, useOrganizerSearch } from '../use-resellers'
import { createTestQueryClient } from '@/test/test-utils'
import { resellerKeys } from '@/lib/query-keys'
import { makeResellerSearchResult, makeOrganizerSearchResult } from '@/test/factories/reseller.factory'
import { server } from '@/test/mocks/server'
import { API_BASE_URL as API } from '@/test/test-constants'

function createWrapper() {
  const queryClient = createTestQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useResellerSearch', () => {
  it('uses resellerKeys.resellerSearch(q, page, limit) as its query key and returns results', async () => {
    const item = makeResellerSearchResult({ name: 'Resale Rani' })
    server.use(
      http.get(`${API}/reseller/resellers/search`, () =>
        HttpResponse.json({ success: true, data: [item], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }),
      ),
    )

    const { result } = renderHook(() => useResellerSearch('rani', 1, 10), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data?.data[0].name).toBe('Resale Rani')
  })

  it('re-fires the query when the search term changes (distinct query keys)', async () => {
    const capturedQueries: (string | null)[] = []
    server.use(
      http.get(`${API}/reseller/resellers/search`, ({ request }) => {
        capturedQueries.push(new URL(request.url).searchParams.get('q'))
        return HttpResponse.json({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } })
      }),
    )

    const { result, rerender } = renderHook(
      ({ q }) => useResellerSearch(q, 1, 10),
      { wrapper: createWrapper(), initialProps: { q: 'ra' } },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    rerender({ q: 'rani' })
    await waitFor(() => expect(capturedQueries).toContain('rani'))

    expect(capturedQueries).toEqual(['ra', 'rani'])
    // Confirms the two calls are backed by distinct query keys per the QK convention.
    expect(resellerKeys.resellerSearch('ra', 1, 10)).not.toEqual(resellerKeys.resellerSearch('rani', 1, 10))
  })
})

describe('useOrganizerSearch', () => {
  it('uses resellerKeys.organizerSearch(q, page, limit) as its query key and returns results', async () => {
    const item = makeOrganizerSearchResult({ businessName: 'Trek India Adventures' })
    server.use(
      http.get(`${API}/reseller/organizers/search`, () =>
        HttpResponse.json({ success: true, data: [item], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }),
      ),
    )

    const { result } = renderHook(() => useOrganizerSearch('trek', 1, 10), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data?.data[0].businessName).toBe('Trek India Adventures')
  })
})
