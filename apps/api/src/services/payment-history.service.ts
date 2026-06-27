import { Logger } from 'pino'
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import { TripRepository } from '../repositories/trip.repository'
import { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import { NotFoundError, ForbiddenError } from '../errors/app-error'
import { DEFAULT_COMMISSION_RATE, paginate } from '../utils/constants'
import type {
  PaymentHistoryFilters,
  AdminPaymentFilters,
  TravelerPaymentSummary,
  TripPaymentSummary,
  AdminPaymentSummary,
} from '@shared/types/payment.types'

export class PaymentHistoryService {
  constructor(
    private paymentTxRepo: PaymentTransactionRepository,
    private tripRepo: TripRepository,
    private organizerProfileRepo: OrganizerProfileRepository,
    private logger: Logger,
  ) {}

  // ─── Traveler Methods ──────────────────────────────

  /** GET /payments/my — Traveler's paginated payment history */
  async getMyPayments(userId: string, filters: PaymentHistoryFilters = {}) {
    const pg = paginate(filters)
    const { data, total } = await this.paymentTxRepo.findByUserId(
      userId,
      { type: filters.type, status: filters.status, fromDate: filters.fromDate, toDate: filters.toDate },
      { skip: pg.skip, take: pg.take },
    )
    this.logger.debug({ userId, filters, total }, 'Fetched payment history for traveler')
    return { data, pagination: pg.meta(total) }
  }

  /** GET /payments/my/summary — Traveler summary stats */
  async getMyPaymentSummary(userId: string): Promise<TravelerPaymentSummary> {
    return this.paymentTxRepo.getUserSummary(userId)
  }

  // ─── Organizer Methods ─────────────────────────────

  /** GET /payments/trip/:tripId — Organizer's per-trip payment view */
  async getTripPayments(
    userId: string,
    tripId: string,
    filters: PaymentHistoryFilters = {},
  ) {
    await this.verifyTripOrganizer(userId, tripId)

    const pg = paginate(filters)
    const { data, total } = await this.paymentTxRepo.findByTripId(
      tripId,
      { type: filters.type, status: filters.status, fromDate: filters.fromDate, toDate: filters.toDate },
      { skip: pg.skip, take: pg.take },
    )
    return { data, pagination: pg.meta(total) }
  }

  /** GET /payments/trip/:tripId/summary — Organizer's trip summary with commission */
  async getTripPaymentSummary(userId: string, tripId: string): Promise<TripPaymentSummary> {
    const profile = await this.verifyTripOrganizer(userId, tripId)

    const raw = await this.paymentTxRepo.getTripSummary(tripId)
    const netRevenue = raw.totalRevenue - raw.totalRefunded
    const commissionRate = (profile.commissionRate != null ? Number(profile.commissionRate) : DEFAULT_COMMISSION_RATE) / 100
    const platformCommission = Math.round(netRevenue * commissionRate)
    const organizerEarnings = netRevenue - platformCommission

    return {
      totalRevenue: raw.totalRevenue,
      totalRefunded: raw.totalRefunded,
      netRevenue,
      platformCommission,
      organizerEarnings,
      transactionCount: raw.transactionCount,
      refundCount: raw.refundCount,
    }
  }

  // ─── Organizer Payout Methods ──────────────────────

  /**
   * GET /payments/payouts — Organizer's payout statement.
   *
   * Returns:
   * - Released payouts: ESCROW_RELEASE records with per-trip breakdown
   * - Pending estimate: captured payments with no escrow release yet
   *
   * Ownership is enforced via the organizer profile lookup.
   */
  async getPayoutStatement(userId: string, tripId?: string) {
    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new ForbiddenError('Organizer profile not found')

    const [released, pendingPayments] = await Promise.all([
      this.paymentTxRepo.findEscrowReleasesForOrganizer(profile.id, tripId),
      this.paymentTxRepo.findPendingEscrowForOrganizer(profile.id),
    ])

    const releasedTotal = released.reduce((sum, r) => sum + r.amount, 0)

    const pendingTotal = pendingPayments.reduce((sum, p) => {
      const rawRate = p.booking.trip.organizer.commissionRate
      const commissionRate = (rawRate != null ? Number(rawRate) : DEFAULT_COMMISSION_RATE) / 100
      return sum + Math.round(p.amount * (1 - commissionRate))
    }, 0)

    // Group released payouts by trip for the statement view
    const byTrip = new Map<string, {
      tripId: string; tripTitle: string; tripSlug: string; startDate: Date
      payouts: Array<{ id: string; amount: number; releasedAt: string; razorpayTransferId: string | null }>
    }>()

    for (const r of released) {
      const key = r.booking.trip.id
      if (!byTrip.has(key)) {
        byTrip.set(key, {
          tripId: r.booking.trip.id,
          tripTitle: r.booking.trip.title,
          tripSlug: r.booking.trip.slug,
          startDate: r.booking.trip.startDate,
          payouts: [],
        })
      }
      const meta = r.metadata as Record<string, unknown> | null
      const entry = byTrip.get(key)
      if (!entry) {
        this.logger.error({ payoutId: r.id, key }, 'BUG: payout trip key missing from map — data loss prevented')
        continue
      }
      entry.payouts.push({
        id: r.id,
        amount: r.amount,
        releasedAt: meta?.releasedAt as string ?? r.createdAt.toISOString(),
        razorpayTransferId: r.razorpayTransferId ?? null,
      })
    }

    return {
      releasedTotal,
      pendingTotal,
      trips: Array.from(byTrip.values()),
    }
  }

  // ─── Admin Methods ─────────────────────────────────

  /** GET /payments/admin — Admin global view */
  async getAllPayments(filters: AdminPaymentFilters = {}) {
    const pg = paginate(filters)
    const { data, total } = await this.paymentTxRepo.findAll(
      {
        type: filters.type, status: filters.status,
        fromDate: filters.fromDate, toDate: filters.toDate,
        userId: filters.userId, tripId: filters.tripId, bookingRef: filters.bookingRef,
      },
      { skip: pg.skip, take: pg.take },
    )
    return { data, pagination: pg.meta(total) }
  }

  /**
   * GET /payments/admin/summary — Admin global summary
   *
   * @remarks totalCommission is estimated using a flat DEFAULT_COMMISSION_RATE (10%).
   * Per-organizer commission rates are not aggregated — treat this as an approximation.
   */
  async getGlobalSummary(): Promise<AdminPaymentSummary> {
    const raw = await this.paymentTxRepo.getGlobalSummary()
    const netRevenue = raw.totalRevenue - raw.totalRefunded
    const totalCommission = Math.round(netRevenue * (DEFAULT_COMMISSION_RATE / 100))

    return {
      totalRevenue: raw.totalRevenue,
      totalRefunded: raw.totalRefunded,
      netRevenue,
      totalCommission,
      transactionCount: raw.transactionCount,
      failedCount: raw.failedCount,
    }
  }

  // ─── Private helpers ───────────────────────────────

  /**
   * Verifies the calling user is the organizer of the trip.
   * Pattern matches TripService: organizerProfileRepo.findByUserId → compare trip.organizerId
   *
   * @throws NotFoundError — trip not found
   * @throws ForbiddenError — not the organizer
   * @returns the organizer profile (for commission rate access)
   */
  private async verifyTripOrganizer(userId: string, tripId: string) {
    const [trip, profile] = await Promise.all([
      this.tripRepo.findById(tripId),
      this.organizerProfileRepo.findByUserId(userId),
    ])
    if (!trip) {
      throw new NotFoundError('Trip')
    }

    if (!profile) {
      throw new ForbiddenError('Organizer profile not found')
    }
    if (trip.organizerId !== profile.id) {
      throw new ForbiddenError('You can only manage your own trips')
    }

    return profile
  }
}
