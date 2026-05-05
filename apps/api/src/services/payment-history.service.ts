import { Logger } from 'pino'
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import { TripRepository } from '../repositories/trip.repository'
import { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import { NotFoundError, ForbiddenError } from '../errors/app-error'
import type {
  PaymentHistoryFilters,
  AdminPaymentFilters,
  TravelerPaymentSummary,
  TripPaymentSummary,
  AdminPaymentSummary,
} from '@shared/types/payment.types'

/** Default platform commission rate (10%) — matches OrganizerProfile.commissionRate default */
const DEFAULT_COMMISSION_RATE = 10.0

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
    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    const { data, total } = await this.paymentTxRepo.findByUserId(
      userId,
      { type: filters.type, status: filters.status, fromDate: filters.fromDate, toDate: filters.toDate },
      { skip, take: limit },
    )

    this.logger.debug({ userId, filters, total }, 'Fetched payment history for traveler')

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
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

    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    const { data, total } = await this.paymentTxRepo.findByTripId(
      tripId,
      { type: filters.type, status: filters.status, fromDate: filters.fromDate, toDate: filters.toDate },
      { skip, take: limit },
    )

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  /** GET /payments/trip/:tripId/summary — Organizer's trip summary with commission */
  async getTripPaymentSummary(userId: string, tripId: string): Promise<TripPaymentSummary> {
    const profile = await this.verifyTripOrganizer(userId, tripId)

    const raw = await this.paymentTxRepo.getTripSummary(tripId)
    const netRevenue = raw.totalRevenue - raw.totalRefunded
    const commissionRate = (profile.commissionRate ?? DEFAULT_COMMISSION_RATE) / 100
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

  // ─── Admin Methods ─────────────────────────────────

  /** GET /payments/admin — Admin global view */
  async getAllPayments(filters: AdminPaymentFilters = {}) {
    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    const { data, total } = await this.paymentTxRepo.findAll(
      {
        type: filters.type, status: filters.status,
        fromDate: filters.fromDate, toDate: filters.toDate,
        userId: filters.userId, tripId: filters.tripId, bookingRef: filters.bookingRef,
      },
      { skip, take: limit },
    )

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
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
