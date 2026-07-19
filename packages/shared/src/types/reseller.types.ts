import type { ResellerLeadSort, ResellerBookingRefundStatus } from '../constants/reseller'

// ─── Main links ──────────────────────────────────────

export interface ResellerMainLinkDto {
  id: string
  token: string
  tripId: string
  tripTitle: string
  tripSlug: string
  organizerId: string
  resellerId: string
  resellerEmail: string
  resellerName: string | null
  isActive: boolean
  createdAt: string
  sublinkCount: number
  /** Total bookings across all of this (trip, reseller) pairing's sublinks. */
  bookingCount: number
  /** Sum of markupAmount across all of this (trip, reseller) pairing's sublinks' bookings. */
  totalMarkupAmount: number
}

export interface ResellerMainLinkFilters {
  tripId?: string
  resellerId?: string
  page?: number
  limit?: number
}

/**
 * A reseller's own main link, enriched for the trip-card landing page:
 * `tripPhoto` (cover image, may be null) and `totalMarkupAmount` — the sum of
 * `markupAmount` across ALL of this main link's sublinks' bookings (a
 * sum-of-sums over the same per-sublink aggregation used by leads).
 */
export interface ResellerMainLinkWithEarningsDto extends ResellerMainLinkDto {
  tripPhoto: string | null
  totalMarkupAmount: number
  /** Organizer's business name, for display on the reseller's trip-card landing page. */
  organizerName: string
}

export interface MyMainLinksFilters {
  tripId?: string
  page?: number
  limit?: number
}

// ─── Sublinks ────────────────────────────────────────

export interface ResellerSublinkDto {
  id: string
  token: string
  mainLinkId: string
  tripId: string
  tripTitle: string
  tripSlug: string
  resellerId: string
  markupAmount: number
  label: string | null
  isActive: boolean
  createdAt: string
  bookingCount: number
  totalMarkupAmount: number
}

export interface ResellerSublinkFilters {
  tripId?: string
  mainLinkId?: string
  page?: number
  limit?: number
}

// ─── Leads (aggregated bookings + markup, per sublink) ─

export interface ResellerLeadRow {
  sublinkId: string
  sublinkToken: string
  label: string | null
  mainLinkId: string
  tripId: string
  tripTitle: string
  tripSlug: string
  resellerId: string
  resellerName: string | null
  resellerEmail: string
  organizerId: string
  organizerName: string
  markupAmount: number
  bookingCount: number
  totalTravelers: number
  totalMarkupAmount: number
  isActive: boolean
  createdAt: string
}

export interface ResellerLeadFilters {
  tripId?: string
  resellerId?: string
  organizerId?: string
  mainLinkId?: string
  sort: ResellerLeadSort
  page?: number
  limit?: number
}

// ─── Bookings feed (per main link / sublink) ─────────

/**
 * Refund progress derived server-side from `bookingStatus` + whether a
 * REFUND-type PaymentTransaction exists — the frontend must never re-derive
 * this from raw booking/transaction fields.
 *
 * - `'REFUNDED'` — refund fully complete (`bookingStatus === REFUNDED`).
 * - `'PENDING'` — booking cancelled, a REFUND transaction was initiated but
 *   hasn't completed yet (`bookingStatus === CANCELLED` + a REFUND tx row exists).
 * - `null` — no refund applicable (any other status, or CANCELLED with no
 *   refund owed).
 */
export interface ResellerBookingRowDto {
  id: string
  bookingRef: string
  numTravelers: number
  totalAmount: number
  markupAmount: number
  bookingStatus: string
  createdAt: string
  user: { id: string; name: string; email: string | null }
  refundStatus: ResellerBookingRefundStatus | null
}

// ─── Public resolve + attribution ───────────────────

/**
 * PUBLIC — returned by the no-auth resolve endpoint. Deliberately omits
 * `basePrice`/`markupAmount`: this DTO is embedded directly into SSR HTML
 * (apps/web `trips/[slug]/page.tsx`), so any base/markup breakdown here would
 * let a traveler view-source their way to the exact markup. Only the merged,
 * undifferentiated `effectivePrice` may ever appear on this type.
 */
export interface ResolvedSublinkDto {
  tripId: string
  tripSlug: string
  effectivePrice: number
  resellerName?: string | null
}

// ─── Combobox search ─────────────────────────────────

export interface ResellerSearchResultItem {
  id: string
  name: string
  email: string | null
}

export interface OrganizerSearchResultItem {
  id: string
  businessName: string
  email: string | null
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page?: number
  limit?: number
}
