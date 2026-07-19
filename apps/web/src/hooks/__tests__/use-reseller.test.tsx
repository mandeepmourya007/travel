import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useGenerateMainLink,
  useCreateSublink,
  useMySublinks,
  useMyMainLinksAsReseller,
  useSublinkResolve,
  useRecordAttribution,
  useAdminLeads,
} from '../use-reseller'
import { useAuthStore } from '@/store/auth.store'
import { createTestQueryClient } from '@/test/test-utils'
import { resellerKeys } from '@/lib/query-keys'
import { RESELLER_LEAD_SORT } from '@shared/constants/reseller'
import { makeMainLink, makeMainLinkWithEarnings, makeSublink, makeLeadRow, makeResolvedSublink, resetResellerFactory } from '@/test/factories/reseller.factory'
import { server } from '@/test/mocks/server'
import { API_BASE_URL as API } from '@/test/test-constants'

function createWrapper() {
  const queryClient = createTestQueryClient()
  return {
    queryClient,
    Wrapper: function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    },
  }
}

beforeEach(() => {
  resetResellerFactory()
  useAuthStore.setState({ accessToken: 'test-token' })
})

afterEach(() => {
  useAuthStore.setState({ accessToken: null })
  vi.restoreAllMocks()
})

// ═════════════════════════════════════════════════════
// useMyMainLinksAsReseller — GET /reseller/main-links/mine
// ═════════════════════════════════════════════════════
describe('useMyMainLinksAsReseller', () => {
  it('returns paginated main links with earnings on success', async () => {
    const link = makeMainLinkWithEarnings({ tripTitle: 'Kerala Backwaters', sublinkCount: 3, totalMarkupAmount: 4500 })
    server.use(
      http.get(`${API}/reseller/main-links/mine`, () =>
        HttpResponse.json({ success: true, data: [link], pagination: { page: 1, limit: 20, total: 1 } }),
      ),
    )

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useMyMainLinksAsReseller(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data?.data[0]).toMatchObject({
      tripTitle: 'Kerala Backwaters',
      sublinkCount: 3,
      totalMarkupAmount: 4500,
    })
  })

  it('is disabled (no request) when there is no access token', () => {
    useAuthStore.setState({ accessToken: null })
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useMyMainLinksAsReseller(), { wrapper: Wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ═════════════════════════════════════════════════════
// useGenerateMainLink — mutation invalidates mainLinksBase()
// ═════════════════════════════════════════════════════
describe('useGenerateMainLink', () => {
  it('invalidates resellerKeys.mainLinksBase() on success', async () => {
    const newLink = makeMainLink({ tripId: 'trip-1', resellerEmail: 'reseller@x.com' })
    server.use(
      http.post(`${API}/reseller/main-links`, () => HttpResponse.json({ success: true, data: newLink })),
    )
    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useGenerateMainLink(), { wrapper: Wrapper })
    result.current.mutate({ tripId: 'trip-1', resellerEmail: 'reseller@x.com' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: resellerKeys.mainLinksBase() })
  })
})

// ═════════════════════════════════════════════════════
// useCreateSublink — mutation invalidates sublinksBase()
// ═════════════════════════════════════════════════════
describe('useCreateSublink', () => {
  it('invalidates resellerKeys.sublinksBase() on success', async () => {
    const sublink = makeSublink({ markupAmount: 500 })
    server.use(
      http.post(`${API}/reseller/sublinks`, () => HttpResponse.json({ success: true, data: sublink })),
    )
    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateSublink(), { wrapper: Wrapper })
    result.current.mutate({ mainLinkToken: 'tok-A', markupAmount: 500 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.markupAmount).toBe(500)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: resellerKeys.sublinksBase() })
  })

  it('surfaces a ForbiddenError-shaped failure (e.g. not the named reseller) without invalidating', async () => {
    server.use(
      http.post(`${API}/reseller/sublinks`, () =>
        HttpResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'This main link was not shared with you' } }, { status: 403 }),
      ),
    )
    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateSublink(), { wrapper: Wrapper })
    result.current.mutate({ mainLinkToken: 'tok-not-mine', markupAmount: 500 })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════
// useMySublinks — query key filters
// ═════════════════════════════════════════════════════
describe('useMySublinks', () => {
  it('passes tripId filter through to the request', async () => {
    let capturedUrl: string | undefined
    server.use(
      http.get(`${API}/reseller/sublinks`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0 } })
      }),
    )
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useMySublinks({ tripId: 'trip-9' }), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(capturedUrl).toContain('tripId=trip-9')
  })
})

// ═════════════════════════════════════════════════════
// useAdminLeads — mainLinkId scoping + options.enabled gate
// (admin "sublinks for this main link" modal on the reseller-links page)
// ═════════════════════════════════════════════════════
describe('useAdminLeads', () => {
  it('passes mainLinkId through as a query param when provided', async () => {
    let capturedUrl: string | undefined
    const lead = makeLeadRow({ mainLinkId: 'main-A' })
    server.use(
      http.get(`${API}/reseller/admin/leads`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ success: true, data: [lead], pagination: { page: 1, limit: 20, total: 1 } })
      }),
    )
    const { Wrapper } = createWrapper()
    const { result } = renderHook(
      () => useAdminLeads({ mainLinkId: 'main-A', sort: RESELLER_LEAD_SORT.MARKUP_DESC, page: 1, limit: 20 }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(capturedUrl).toContain('mainLinkId=main-A')
    expect(result.current.data?.data[0].mainLinkId).toBe('main-A')
  })

  it('does not fire the request when options.enabled is false, even with a valid token', () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(
      () => useAdminLeads({ sort: RESELLER_LEAD_SORT.MARKUP_DESC, page: 1, limit: 20 }, { enabled: false }),
      { wrapper: Wrapper },
    )

    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ═════════════════════════════════════════════════════
// useSublinkResolve — public, disabled with no token
// ═════════════════════════════════════════════════════
describe('useSublinkResolve', () => {
  it('resolves the DTO for a valid token', async () => {
    const resolved = makeResolvedSublink({ effectivePrice: 6200 })
    server.use(
      http.get(`${API}/reseller/sublinks/resolve/tok-1`, () => HttpResponse.json({ success: true, data: resolved })),
    )
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useSublinkResolve('tok-1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data?.effectivePrice).toBe(6200)
  })

  it('is disabled (idle) when token is undefined', () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useSublinkResolve(undefined), { wrapper: Wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ═════════════════════════════════════════════════════
// useRecordAttribution — fire-and-forget mutation
// ═════════════════════════════════════════════════════
describe('useRecordAttribution', () => {
  it('posts the sublinkToken and resolves on success', async () => {
    let capturedBody: unknown
    server.use(
      http.post(`${API}/reseller/attribution`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ success: true, data: null })
      }),
    )
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useRecordAttribution(), { wrapper: Wrapper })

    result.current.mutate('tok-B')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(capturedBody).toEqual({ sublinkToken: 'tok-B' })
  })
})
