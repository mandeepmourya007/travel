import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_REALTIME, STALE_TIME_STATIC } from '@/lib/constants'
import { useAuthStore } from '@/store/auth.store'
import { resellerKeys, leadKeys } from '@/lib/query-keys'
import type {
  ResellerMainLinkDto,
  ResellerMainLinkWithEarningsDto,
  MyMainLinksFilters,
  ResellerSublinkDto,
  ResellerSublinkFilters,
  ResellerLeadFilters,
  ResellerLeadRow,
  ResolvedSublinkDto,
  PaginatedResult,
} from '@shared/types/reseller.types'
import type { ResellerBookingRefundStatus } from '@shared/constants/reseller'

interface PaginatedResponse<T> {
  success: true
  data: T[]
  pagination: { page: number; limit: number; total: number }
}

interface BookingRow {
  id: string
  bookingRef: string
  numTravelers: number
  totalAmount: number
  markupAmount: number
  bookingStatus: string
  createdAt: string
  user: { id: string; name: string; email: string | null }
  /** Refund progress, derived server-side — see `ResellerBookingRowDto`. */
  refundStatus: ResellerBookingRefundStatus | null
}

// ─── Organizer: main links ───────────────────────────

/** POST /reseller/main-links — generate a shareable main link for (trip, reseller email). */
export function useGenerateMainLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dto: { tripId: string; resellerEmail: string }) => {
      const res = await apiClient.post<{ success: true; data: ResellerMainLinkDto }>('/reseller/main-links', dto)
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resellerKeys.mainLinksBase() })
    },
  })
}

/** GET /reseller/main-links/:mainLinkId/bookings — bookings feed for a main link (organizer view). */
export function useMainLinkBookings(mainLinkId: string, page = 1, limit = 10) {
  const hasToken = !!useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: resellerKeys.mainLinkBookings(mainLinkId, page, limit),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<BookingRow>>(`/reseller/main-links/${mainLinkId}/bookings`, {
        params: { page, limit },
      })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    enabled: hasToken && !!mainLinkId,
    placeholderData: (prev) => prev,
  })
}

/** GET /reseller/leads — organizer's per-sublink lead aggregation. */
export function useOrganizerLeads(filters: ResellerLeadFilters) {
  const hasToken = !!useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: leadKeys.organizer(filters),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<ResellerLeadRow>>('/reseller/leads', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    enabled: hasToken,
    placeholderData: (prev) => prev,
  })
}

// ─── Reseller: main links shared with them ───────────

/**
 * GET /reseller/main-links/mine — reseller's own active main links, for the
 * trip-card landing page. Each row carries `sublinkCount` and
 * `totalMarkupAmount` (summed across all of that main link's sublinks' bookings).
 */
export function useMyMainLinksAsReseller(filters: MyMainLinksFilters = {}) {
  const hasToken = !!useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: resellerKeys.myMainLinks(filters),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<ResellerMainLinkWithEarningsDto>>('/reseller/main-links/mine', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    enabled: hasToken,
    placeholderData: (prev) => prev,
  })
}

// ─── Reseller: sublinks ──────────────────────────────

/** POST /reseller/sublinks — create a sublink (with markup) off a main link. */
export function useCreateSublink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dto: { mainLinkToken: string; markupAmount: number; label?: string }) => {
      const res = await apiClient.post<{ success: true; data: ResellerSublinkDto }>('/reseller/sublinks', dto)
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resellerKeys.sublinksBase() })
    },
  })
}

/** GET /reseller/sublinks — reseller's own sublinks (filter by tripId/mainLinkId). */
export function useMySublinks(filters: ResellerSublinkFilters = {}) {
  const hasToken = !!useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: resellerKeys.mySublinks(filters),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<ResellerSublinkDto>>('/reseller/sublinks', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    enabled: hasToken,
    placeholderData: (prev) => prev,
  })
}

/** PATCH /reseller/sublinks/:sublinkId — edit markup/label/isActive. */
export function usePatchSublink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ sublinkId, ...data }: { sublinkId: string; markupAmount?: number; label?: string; isActive?: boolean }) => {
      await apiClient.patch(`/reseller/sublinks/${sublinkId}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resellerKeys.sublinksBase() })
    },
  })
}

/** GET /reseller/sublinks/:sublinkId/bookings — bookings feed for a sublink (reseller view). */
export function useSublinkBookings(sublinkId: string, page = 1, limit = 10) {
  const hasToken = !!useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: resellerKeys.sublinkBookings(sublinkId, page, limit),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<BookingRow>>(`/reseller/sublinks/${sublinkId}/bookings`, {
        params: { page, limit },
      })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    enabled: hasToken && !!sublinkId,
    placeholderData: (prev) => prev,
  })
}

/** GET /reseller/my-leads — reseller's own per-sublink lead aggregation (markup earned). */
export function useMyLeads(filters: ResellerLeadFilters) {
  const hasToken = !!useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: leadKeys.reseller(filters),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<ResellerLeadRow>>('/reseller/my-leads', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    enabled: hasToken,
    placeholderData: (prev) => prev,
  })
}

// ─── Admin ────────────────────────────────────────────

/**
 * GET /reseller/admin/leads — all leads, platform-wide. Optionally scoped to a
 * single `mainLinkId` (e.g. the admin "sublinks for this main link" modal) —
 * pass `options.enabled: false` while that scoping id isn't known yet so the
 * modal's query doesn't fire until it has a target.
 */
export function useAdminLeads(filters: ResellerLeadFilters, options?: { enabled?: boolean }) {
  const hasToken = !!useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: leadKeys.admin(filters),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<ResellerLeadRow>>('/reseller/admin/leads', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    enabled: hasToken && (options?.enabled ?? true),
    placeholderData: (prev) => prev,
  })
}

// ─── Public resolve + attribution ────────────────────

/**
 * GET /reseller/sublinks/resolve/:token — PUBLIC, no auth. Resolves a sublink
 * token to price-display fields (basePrice/markupAmount/effectivePrice).
 * Used client-side as a fallback when the SSR trip-detail page didn't resolve
 * (e.g. token came from the `reseller_ref` cookie rather than the `?ref` query param).
 */
export function useSublinkResolve(token: string | undefined) {
  return useQuery({
    queryKey: resellerKeys.resolve(token ?? ''),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: ResolvedSublinkDto }>(`/reseller/sublinks/resolve/${token}`)
      return res.data.data
    },
    staleTime: STALE_TIME_STATIC,
    enabled: !!token,
    retry: false,
  })
}

/** POST /reseller/attribution — authed, idempotent last-wins attribution upsert. */
export function useRecordAttribution() {
  return useMutation({
    mutationFn: async (sublinkToken: string) => {
      await apiClient.post('/reseller/attribution', { sublinkToken })
    },
  })
}

export type { PaginatedResult, BookingRow }
