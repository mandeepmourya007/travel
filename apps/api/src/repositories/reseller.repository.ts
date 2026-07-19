import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import type {
  ResellerMainLinkFilters,
  ResellerSublinkFilters,
  ResellerLeadFilters,
} from '@shared/types/reseller.types'
import { RESELLER_LEAD_SORT, RESELLER_BOOKING_REFUND_STATUS } from '@shared/constants/reseller'
import { SORT_ORDER } from '@shared/constants/sort'
import { BOOKING_STATUS } from '@shared/constants/booking-status'
import { PAYMENT_TX_TYPE } from '../utils/constants'
import type { ResellerBookingRowDto } from '@shared/types/reseller.types'

/**
 * Only bookings in these statuses represent real, collected revenue —
 * PENDING_PAYMENT/CANCELLED/EXPIRED/REFUNDED bookings never generated actual
 * markup earnings, so leads/earnings aggregation must exclude them (a
 * PENDING_PAYMENT booking that never completes is not "earned" markup).
 */
const EARNED_BOOKING_STATUSES = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED]

const MAIN_LINK_LIST_SELECT = {
  id: true,
  token: true,
  tripId: true,
  organizerId: true,
  resellerId: true,
  resellerEmail: true,
  isActive: true,
  createdAt: true,
  trip: { select: { title: true, slug: true } },
  reseller: { select: { name: true } },
  _count: { select: { sublinks: { where: { isDeleted: false } } } },
} as const

const SUBLINK_LIST_SELECT = {
  id: true,
  token: true,
  mainLinkId: true,
  tripId: true,
  resellerId: true,
  markupAmount: true,
  label: true,
  isActive: true,
  createdAt: true,
  trip: { select: { title: true, slug: true } },
  _count: { select: { bookings: { where: { isDeleted: false, bookingStatus: { in: EARNED_BOOKING_STATUSES } } } } },
} as const

/** Generates an opaque, unguessable token — same pattern as OrganizerInvite. */
function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export class ResellerRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  generateToken(): string {
    return generateToken()
  }

  // ─── Main links ────────────────────────────────────

  async createMainLink(data: {
    tripId: string
    organizerId: string
    resellerId: string
    resellerEmail: string
  }) {
    return this.prisma.resellerMainLink.create({
      data: { ...data, token: generateToken() },
    })
  }

  async findMainLinkById(id: string) {
    return this.prisma.resellerMainLink.findFirst({
      where: { id, isDeleted: false },
    })
  }

  /** Active, not-deleted main link lookup by opaque token. Used to create sublinks. */
  async findActiveMainLinkByToken(token: string) {
    return this.prisma.resellerMainLink.findFirst({
      where: { token, isActive: true, isDeleted: false },
    })
  }

  /**
   * Existing (trip, reseller) link, if any — backs the idempotent "invite"
   * flow in ResellerService.generateMainLink (a re-invite is a no-op success,
   * not a new row, matching the new @@unique([tripId, resellerId])).
   */
  async findMainLinkByTripAndReseller(tripId: string, resellerId: string) {
    return this.prisma.resellerMainLink.findFirst({
      where: { tripId, resellerId, isDeleted: false },
    })
  }

  /**
   * Organizer/admin main-link list, enriched with per-(trip,reseller) stats
   * (bookingCount + totalMarkupAmount) via the same sum-of-sums aggregation
   * used by `listMainLinksForReseller` — this is now effectively the
   * "resellers invited for my trips" view, since @@unique([tripId, resellerId])
   * guarantees one row per pairing.
   */
  async listMainLinks(
    filters: ResellerMainLinkFilters & { organizerId?: string },
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.ResellerMainLinkWhereInput = {
      isDeleted: false,
      ...(filters.organizerId && { organizerId: filters.organizerId }),
      ...(filters.tripId && { tripId: filters.tripId }),
      ...(filters.resellerId && { resellerId: filters.resellerId }),
    }

    const [rows, total] = await Promise.all([
      this.prisma.resellerMainLink.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        select: MAIN_LINK_LIST_SELECT,
      }),
      this.prisma.resellerMainLink.count({ where }),
    ])

    const stats = await this.computeMainLinkStats(rows.map((r) => r.id))
    return {
      data: rows.map((r) => ({ ...r, ...(stats.get(r.id) ?? { bookingCount: 0, totalMarkupAmount: 0 }) })),
      total,
    }
  }

  /**
   * Sum-of-sums: for each main link, sum `Booking.markupAmount` across all of
   * its sublinks' bookings, plus a booking count. Shared by `listMainLinks`
   * (organizer/admin) and `listMainLinksForReseller`.
   */
  private async computeMainLinkStats(mainLinkIds: string[]): Promise<Map<string, { bookingCount: number; totalMarkupAmount: number }>> {
    const result = new Map<string, { bookingCount: number; totalMarkupAmount: number }>()
    if (!mainLinkIds.length) return result

    const sublinks = await this.prisma.resellerSublink.findMany({
      where: { mainLinkId: { in: mainLinkIds }, isDeleted: false },
      select: { id: true, mainLinkId: true },
    })
    const sublinkIds = sublinks.map((s) => s.id)
    const bookingAgg = sublinkIds.length
      ? await this.prisma.booking.groupBy({
          by: ['sublinkId'],
          where: { sublinkId: { in: sublinkIds }, isDeleted: false, bookingStatus: { in: EARNED_BOOKING_STATUSES } },
          _count: { id: true },
          _sum: { markupAmount: true },
        })
      : []
    const aggBySublinkId = new Map(
      bookingAgg.map((b) => [b.sublinkId, { bookingCount: b._count.id, totalMarkupAmount: b._sum.markupAmount ?? 0 }]),
    )
    for (const s of sublinks) {
      const current = result.get(s.mainLinkId) ?? { bookingCount: 0, totalMarkupAmount: 0 }
      const agg = aggBySublinkId.get(s.id) ?? { bookingCount: 0, totalMarkupAmount: 0 }
      result.set(s.mainLinkId, {
        bookingCount: current.bookingCount + agg.bookingCount,
        totalMarkupAmount: current.totalMarkupAmount + agg.totalMarkupAmount,
      })
    }
    return result
  }

  /**
   * The reseller's own active main links, joined with the trip's cover photo,
   * for the trip-card landing page. `totalMarkupAmount` is a sum-of-sums: sum
   * `Booking.markupAmount` per sublink (same grouped query as `listSublinks`),
   * then add each sublink's sum into its parent main link's running total —
   * reusing the existing per-sublink aggregation building block rather than a
   * new query shape.
   */
  async listMainLinksForReseller(
    resellerId: string,
    filters: { tripId?: string },
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.ResellerMainLinkWhereInput = {
      isDeleted: false,
      isActive: true,
      resellerId,
      ...(filters.tripId && { tripId: filters.tripId }),
    }

    const [rows, total] = await Promise.all([
      this.prisma.resellerMainLink.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        select: {
          ...MAIN_LINK_LIST_SELECT,
          trip: { select: { title: true, slug: true, photos: true } },
          organizer: { select: { businessName: true } },
        },
      }),
      this.prisma.resellerMainLink.count({ where }),
    ])

    const stats = await this.computeMainLinkStats(rows.map((r) => r.id))
    return {
      data: rows.map((r) => ({ ...r, ...(stats.get(r.id) ?? { bookingCount: 0, totalMarkupAmount: 0 }) })),
      total,
    }
  }

  // ─── Sublinks ──────────────────────────────────────

  async createSublink(data: {
    mainLinkId: string
    resellerId: string
    tripId: string
    markupAmount: number
    label?: string
  }) {
    return this.prisma.resellerSublink.create({
      data: { ...data, token: generateToken() },
    })
  }

  /**
   * Includes the parent main link's `organizerId` so callers can check
   * organizer ownership (getSublinkBookings) without a second query.
   */
  async findSublinkById(id: string) {
    return this.prisma.resellerSublink.findFirst({
      where: { id, isDeleted: false },
      include: { mainLink: { select: { organizerId: true } } },
    })
  }

  /**
   * Active, not-deleted sublink lookup by opaque token, joined with the trip's
   * live price fields so callers (booking price calc, public resolve) can
   * compute base/markup/effective price from a single row.
   */
  async findActiveSublinkByToken(token: string) {
    return this.prisma.resellerSublink.findFirst({
      where: { token, isActive: true, isDeleted: false },
      include: {
        trip: {
          select: {
            id: true, slug: true, status: true, isHidden: true, isDeleted: true,
            pricePerPerson: true, earlyBirdPrice: true, earlyBirdDeadline: true,
          },
        },
        reseller: { select: { name: true } },
      },
    })
  }

  /**
   * Unified helper matching the (token, kind) call shape used in booking.service.
   * Overloaded so callers passing a literal 'sublink'/'main' get the narrower
   * return type instead of the union of both.
   */
  async findActiveByToken(token: string, kind: 'main'): ReturnType<ResellerRepository['findActiveMainLinkByToken']>
  async findActiveByToken(token: string, kind: 'sublink'): ReturnType<ResellerRepository['findActiveSublinkByToken']>
  async findActiveByToken(token: string, kind: 'main' | 'sublink') {
    return kind === 'main'
      ? this.findActiveMainLinkByToken(token)
      : this.findActiveSublinkByToken(token)
  }

  async listSublinks(
    filters: ResellerSublinkFilters & { resellerId?: string },
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.ResellerSublinkWhereInput = {
      isDeleted: false,
      ...(filters.resellerId && { resellerId: filters.resellerId }),
      ...(filters.tripId && { tripId: filters.tripId }),
      ...(filters.mainLinkId && { mainLinkId: filters.mainLinkId }),
    }

    const [rows, total] = await Promise.all([
      this.prisma.resellerSublink.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        select: SUBLINK_LIST_SELECT,
      }),
      this.prisma.resellerSublink.count({ where }),
    ])

    // Sum markup earned per sublink — one extra grouped query, cheaper than N+1.
    const sublinkIds = rows.map((r) => r.id)
    const markupSums = sublinkIds.length
      ? await this.prisma.booking.groupBy({
          by: ['sublinkId'],
          where: { sublinkId: { in: sublinkIds }, isDeleted: false, bookingStatus: { in: EARNED_BOOKING_STATUSES } },
          _sum: { markupAmount: true },
        })
      : []
    const markupBySublinkId = new Map(markupSums.map((m) => [m.sublinkId, m._sum.markupAmount ?? 0]))

    return {
      data: rows.map((r) => ({ ...r, totalMarkupAmount: markupBySublinkId.get(r.id) ?? 0 })),
      total,
    }
  }

  async updateSublink(id: string, data: Prisma.ResellerSublinkUpdateInput) {
    return this.prisma.resellerSublink.update({ where: { id }, data })
  }

  // ─── Attribution (last-wins) ───────────────────────

  async findAttributionByUserAndTrip(userId: string, tripId: string) {
    return this.prisma.sublinkAttribution.findUnique({
      where: { userId_tripId: { userId, tripId } },
      include: {
        sublink: {
          select: { id: true, markupAmount: true, tripId: true, isActive: true, isDeleted: true },
        },
      },
    })
  }

  /**
   * Batch attribution lookup for display-only price mirroring (e.g. the
   * "my trip requests" list) — one query instead of N.  Returns tripId →
   * markupAmount for active, non-deleted sublinks only.
   */
  async findAttributionsForTrips(userId: string, tripIds: string[]): Promise<Map<string, number>> {
    if (!tripIds.length) return new Map()
    const rows = await this.prisma.sublinkAttribution.findMany({
      where: { userId, tripId: { in: tripIds } },
      include: { sublink: { select: { markupAmount: true, isActive: true, isDeleted: true } } },
    })
    return new Map(
      rows
        .filter((r) => r.sublink.isActive && !r.sublink.isDeleted)
        .map((r) => [r.tripId, r.sublink.markupAmount]),
    )
  }

  /** Last-wins: a newer sublink for the same user+trip overwrites the earlier attribution. */
  async upsertAttribution(userId: string, sublinkId: string, tripId: string) {
    return this.prisma.sublinkAttribution.upsert({
      where: { userId_tripId: { userId, tripId } },
      create: { userId, sublinkId, tripId },
      update: { sublinkId },
    })
  }

  // ─── Leads aggregation ─────────────────────────────

  /**
   * Per-sublink lead rows: booking count + summed markup, scoped by any
   * combination of tripId/resellerId/organizerId. organizerId filters via the
   * sublink's mainLink relation (a sublink always belongs to exactly one main link).
   */
  async getLeads(
    filters: ResellerLeadFilters & { organizerId?: string; resellerId?: string },
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.ResellerSublinkWhereInput = {
      isDeleted: false,
      ...(filters.tripId && { tripId: filters.tripId }),
      ...(filters.resellerId && { resellerId: filters.resellerId }),
      ...(filters.organizerId && { mainLink: { organizerId: filters.organizerId } }),
      ...(filters.mainLinkId && { mainLinkId: filters.mainLinkId }),
    }

    const orderBy: Prisma.ResellerSublinkOrderByWithRelationInput =
      filters.sort === RESELLER_LEAD_SORT.OLDEST
        ? { createdAt: SORT_ORDER.ASC }
        : { createdAt: SORT_ORDER.DESC }
    // bookings_desc / markup_desc are applied in-memory after aggregation below,
    // since Prisma can't orderBy a computed aggregate directly on the parent query.

    const [rows, total] = await Promise.all([
      this.prisma.resellerSublink.findMany({
        where,
        orderBy,
        select: {
          id: true, token: true, label: true, mainLinkId: true, tripId: true,
          resellerId: true, isActive: true, createdAt: true, markupAmount: true,
          trip: { select: { title: true, slug: true } },
          reseller: { select: { name: true } },
          mainLink: {
            select: {
              organizerId: true,
              resellerEmail: true,
              organizer: { select: { businessName: true } },
            },
          },
        },
      }),
      this.prisma.resellerSublink.count({ where }),
    ])

    const sublinkIds = rows.map((r) => r.id)
    const bookingAgg = sublinkIds.length
      ? await this.prisma.booking.groupBy({
          by: ['sublinkId'],
          where: { sublinkId: { in: sublinkIds }, isDeleted: false, bookingStatus: { in: EARNED_BOOKING_STATUSES } },
          _count: { id: true },
          _sum: { markupAmount: true, numTravelers: true },
        })
      : []
    const aggBySublinkId = new Map(
      bookingAgg.map((b) => [
        b.sublinkId,
        {
          bookingCount: b._count.id,
          totalMarkupAmount: b._sum.markupAmount ?? 0,
          totalTravelers: b._sum.numTravelers ?? 0,
        },
      ]),
    )

    let leads = rows.map((r) => {
      const agg = aggBySublinkId.get(r.id) ?? { bookingCount: 0, totalMarkupAmount: 0, totalTravelers: 0 }
      return {
        sublinkId: r.id,
        sublinkToken: r.token,
        label: r.label,
        mainLinkId: r.mainLinkId,
        tripId: r.tripId,
        tripTitle: r.trip.title,
        tripSlug: r.trip.slug,
        resellerId: r.resellerId,
        resellerName: r.reseller.name,
        resellerEmail: r.mainLink.resellerEmail,
        organizerId: r.mainLink.organizerId,
        organizerName: r.mainLink.organizer.businessName,
        markupAmount: r.markupAmount,
        bookingCount: agg.bookingCount,
        totalTravelers: agg.totalTravelers ?? 0,
        totalMarkupAmount: agg.totalMarkupAmount,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
      }
    })

    if (filters.sort === RESELLER_LEAD_SORT.BOOKINGS_DESC) {
      leads = leads.sort((a, b) => b.bookingCount - a.bookingCount)
    } else if (filters.sort === RESELLER_LEAD_SORT.MARKUP_DESC) {
      leads = leads.sort((a, b) => b.totalMarkupAmount - a.totalMarkupAmount)
    }

    // Pagination applied in-memory after aggregation/sort — the aggregate sorts
    // above can't be pushed into the DB query, so the paged window is sliced here.
    const paged = leads.slice(pagination.skip, pagination.skip + pagination.take)

    return { data: paged, total }
  }

  // ─── Bookings feed (per main link / sublink) ───────

  private readonly BOOKING_SELECT = {
    id: true,
    bookingRef: true,
    numTravelers: true,
    totalAmount: true,
    markupAmount: true,
    bookingStatus: true,
    createdAt: true,
    user: { select: { id: true, name: true, email: true } },
    paymentTransactions: {
      where: { type: PAYMENT_TX_TYPE.REFUND },
      select: { status: true },
      take: 1,
    },
  } as const

  /**
   * Derives `refundStatus` for a booking row from its `bookingStatus` and
   * whether a REFUND-type PaymentTransaction row exists — see
   * `booking.service.ts#cancelBooking` (marks CANCELLED immediately, then
   * conditionally initiates a refund) and `payment.service.ts` (flips to
   * REFUNDED once the refund webhook confirms completion).
   */
  private mapBookingRow<T extends { bookingStatus: string; paymentTransactions: { status: string }[] }>(
    row: T,
  ): Omit<T, 'paymentTransactions'> & ResellerBookingRowDto {
    const { paymentTransactions, ...rest } = row
    const refundStatus: ResellerBookingRowDto['refundStatus'] =
      row.bookingStatus === BOOKING_STATUS.REFUNDED
        ? RESELLER_BOOKING_REFUND_STATUS.REFUNDED
        : row.bookingStatus === BOOKING_STATUS.CANCELLED && paymentTransactions.length > 0
          ? RESELLER_BOOKING_REFUND_STATUS.PENDING
          : null
    return { ...rest, refundStatus } as Omit<T, 'paymentTransactions'> & ResellerBookingRowDto
  }

  async listBookingsForMainLink(mainLinkId: string, pagination: { skip: number; take: number }) {
    const where: Prisma.BookingWhereInput = { sublink: { mainLinkId }, isDeleted: false }
    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where, skip: pagination.skip, take: pagination.take,
        orderBy: { createdAt: 'desc' }, select: this.BOOKING_SELECT,
      }),
      this.prisma.booking.count({ where }),
    ])
    return { data: rows.map((r) => this.mapBookingRow(r)), total }
  }

  async listBookingsForSublink(sublinkId: string, pagination: { skip: number; take: number }) {
    const where: Prisma.BookingWhereInput = { sublinkId, isDeleted: false }
    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where, skip: pagination.skip, take: pagination.take,
        orderBy: { createdAt: 'desc' }, select: this.BOOKING_SELECT,
      }),
      this.prisma.booking.count({ where }),
    ])
    return { data: rows.map((r) => this.mapBookingRow(r)), total }
  }

  // ─── Combobox search ───────────────────────────────

  /** Resellers already linked to this organizer's main links — for the organizer's picker. */
  async searchResellersForOrganizer(
    organizerId: string,
    query: string | undefined,
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.UserWhereInput = {
      isDeleted: false,
      resellerMainLinks: { some: { organizerId, isDeleted: false } },
      ...(query && {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } },
        ],
      }),
    }
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true },
      }),
      this.prisma.user.count({ where }),
    ])
    return { data, total }
  }

  /** All resellers, platform-wide — admin only. */
  async searchAllResellers(
    query: string | undefined,
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.UserWhereInput = {
      isDeleted: false,
      isReseller: true,
      ...(query && {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } },
        ],
      }),
    }
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true },
      }),
      this.prisma.user.count({ where }),
    ])
    return { data, total }
  }

  /** All organizers, platform-wide — admin only. */
  async searchOrganizers(
    query: string | undefined,
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.OrganizerProfileWhereInput = {
      isDeleted: false,
      ...(query && {
        OR: [
          { businessName: { contains: query, mode: 'insensitive' as const } },
          { user: { email: { contains: query, mode: 'insensitive' as const } } },
        ],
      }),
    }
    const [data, total] = await Promise.all([
      this.prisma.organizerProfile.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { businessName: 'asc' },
        select: { id: true, businessName: true, user: { select: { email: true } } },
      }),
      this.prisma.organizerProfile.count({ where }),
    ])
    return { data: data.map((o) => ({ id: o.id, businessName: o.businessName, email: o.user.email })), total }
  }
}
