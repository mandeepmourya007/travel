import type { Logger } from 'pino'
import type { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import type { UserRepository } from '../repositories/user.repository'
import type { BookingRepository } from '../repositories/booking.repository'
import type { TripRepository } from '../repositories/trip.repository'
import type { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import type { MessageRepository } from '../repositories/message.repository'
import type { WalletRepository } from '../repositories/wallet.repository'
import type { WalletService } from './wallet.service'
import type { NotificationService } from './notification.service'
import type {
  OrganizerApprovalFilters, ApproveRejectDto, PlatformStatsResponse, AdminBookingFilters,
  CashbackTripFilters, IssueCashbackDto, CashbackHistoryFilters, CashbackTravelerItem,
} from '@shared/types/admin.types'
import { NotFoundError, ValidationError } from '../errors/app-error'
import { TRIP_STATUS } from '@shared/constants/trip-types'
import { WALLET_TX, WALLET_REFERENCE_MODELS } from '@shared/constants/wallet'
import { VERIFICATION_STATUS, NOTIFICATION_TYPE } from '@shared/constants'
import { paginate } from '../utils/constants'

export class AdminService {
  constructor(
    private organizerProfileRepo: OrganizerProfileRepository,
    private userRepo: UserRepository,
    private bookingRepo: BookingRepository,
    private tripRepo: TripRepository,
    private paymentTxRepo: PaymentTransactionRepository,
    private messageRepo: MessageRepository,
    private walletRepo: WalletRepository,
    private walletService: WalletService,
    private logger: Logger,
    private notificationService: NotificationService,
  ) {}

  // ─── Organizer Approvals ──────────────────────────────

  /**
   * Paginated list of organizer profiles for admin approval queue.
   * Defaults to showing PENDING organizers.
   */
  async getApprovalQueue(filters: OrganizerApprovalFilters) {
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const skip = (page - 1) * limit

    const { data, total } = await this.organizerProfileRepo.findAllAdmin(
      { status: filters.status },
      { skip, take: limit },
    )

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /** Single organizer profile detail for admin review. */
  async getOrganizerDetail(profileId: string) {
    const profile = await this.organizerProfileRepo.findByIdAdmin(profileId)
    if (!profile) throw new NotFoundError('OrganizerProfile')
    return profile
  }

  /**
   * Approve or reject an organizer profile.
   * Creates an in-app notification for the organizer.
   */
  async approveOrReject(profileId: string, dto: ApproveRejectDto) {
    const profile = await this.organizerProfileRepo.findById(profileId)
    if (!profile) throw new NotFoundError('OrganizerProfile')

    if (profile.verificationStatus === dto.action) {
      throw new ValidationError(`Profile is already ${dto.action}`)
    }

    await this.organizerProfileRepo.update(profileId, {
      verificationStatus: dto.action,
    })

    // Create notification for the organizer
    const isApproved = dto.action === VERIFICATION_STATUS.APPROVED
    const title = isApproved
      ? 'Your organizer profile has been approved!'
      : 'Your organizer profile has been rejected'
    const body = isApproved
      ? 'Congratulations! You can now create and publish trips on TripCompare.'
      : dto.reason
        ? `Your organizer application was rejected. Reason: ${dto.reason}`
        : 'Your organizer application was rejected. Please contact support for details.'

    this.notificationService.send({
      userId: profile.userId,
      type: isApproved ? NOTIFICATION_TYPE.ORGANIZER_APPROVED : NOTIFICATION_TYPE.ORGANIZER_REJECTED,
      title,
      body,
      data: { profileId, reason: dto.reason },
    }).catch((err) => this.logger.error({ err, profileId }, 'Failed to send organizer status notification'))

    this.logger.info(
      { profileId, action: dto.action, reason: dto.reason },
      `Organizer profile ${dto.action.toLowerCase()}`,
    )

    return { profileId, status: dto.action }
  }

  // ─── Platform Stats ───────────────────────────────────

  /** Aggregates platform-wide statistics for admin dashboard. */
  async getPlatformStats(): Promise<PlatformStatsResponse> {
    const [
      totalUsers,
      totalOrganizers,
      pendingApprovals,
      tripsByStatus,
      tripsByType,
      bookingsByStatus,
      revenueTrend,
      flaggedMessages,
      globalSummary,
    ] = await Promise.all([
      this.userRepo.countAll(),
      this.userRepo.countByRole('ORGANIZER'),
      this.organizerProfileRepo.countPending(),
      this.tripRepo.countByStatus(),
      this.tripRepo.countByType(),
      this.bookingRepo.countByStatusAdmin(),
      this.bookingRepo.getRevenueTrend(6),
      this.messageRepo.countFlagged(),
      this.paymentTxRepo.getGlobalSummary(),
    ])

    // Count active trips from status grouping
    const activeTrips = tripsByStatus
      .filter((s) => s.status === 'ACTIVE' || s.status === 'FULL')
      .reduce((sum: number, s) => sum + s.count, 0)

    const totalTrips = tripsByStatus.reduce((sum: number, s) => sum + s.count, 0)
    const totalBookings = bookingsByStatus.reduce((sum: number, s) => sum + s.count, 0)

    return {
      overview: {
        totalUsers,
        totalOrganizers,
        pendingApprovals,
        totalTrips,
        activeTrips,
        totalBookings,
        totalRevenue: globalSummary.totalRevenue - globalSummary.totalRefunded,
        flaggedMessages,
      },
      revenueTrend,
      bookingsByStatus,
      tripsByType,
    }
  }

  // ─── Admin Bookings / Disputes ────────────────────────

  /** Paginated list of all bookings for admin view. */
  async getBookings(filters: AdminBookingFilters) {
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const skip = (page - 1) * limit

    const { data, total } = await this.bookingRepo.findAllAdmin(
      { status: filters.status, search: filters.search },
      { skip, take: limit },
    )

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /** Full booking detail for dispute review. */
  async getBookingDetail(bookingId: string) {
    const booking = await this.bookingRepo.findByIdAdmin(bookingId)
    if (!booking) throw new NotFoundError('Booking')
    return {
      ...booking,
      travelerDetails: booking.travelerDetails.map((t) => ({
        ...t,
        assignedSeat: t.assignedSeat
          ? { seatNumber: t.assignedSeat.seatNumber, seatLabel: t.assignedSeat.seatLabel, vehicleName: t.assignedSeat.tripVehicle.label }
          : null,
      })),
    }
  }

  // ─── Cashback ───────────────────────────────────────

  /** Paginated COMPLETED trips with cashback stats. */
  async getCompletedTripsForCashback(filters: CashbackTripFilters) {
    const pg = paginate(filters)
    const { data, total } = await this.tripRepo.findCompletedTripsForCashback(
      { search: filters.search },
      { skip: pg.skip, take: pg.take },
    )
    return { data, pagination: pg.meta(total) }
  }

  /** Travelers for a completed trip with cashback status. */
  async getTripCashbackDetail(tripId: string) {
    const trip = await this.tripRepo.findById(tripId)
    if (!trip) throw new NotFoundError('Trip')
    if (trip.status !== TRIP_STATUS.COMPLETED) {
      throw new ValidationError('Cashback can only be issued for completed trips')
    }

    return this.bookingRepo.findConfirmedByTripForCashback(tripId)
  }

  /**
   * Issues cashback to selected travelers for a completed trip.
   * Validates: trip COMPLETED, booking belongs to trip, amount ≤ totalAmount, no duplicate.
   */
  async issueCashback(adminUserId: string, dto: IssueCashbackDto) {
    const trip = await this.tripRepo.findById(dto.tripId)
    if (!trip) throw new NotFoundError('Trip')
    if (trip.status !== TRIP_STATUS.COMPLETED) {
      throw new ValidationError('Cashback can only be issued for completed trips')
    }

    const travelers = await this.bookingRepo.findConfirmedByTripForCashback(dto.tripId)
    const travelerMap = new Map(travelers.map((t) => [t.bookingId, t]))

    let issued = 0
    let totalAmount = 0

    for (const item of dto.items) {
      this.validateCashbackItem(item, travelerMap)

      await this.walletService.credit({
        userId: item.userId,
        amount: item.amount,
        type: WALLET_TX.CASHBACK,
        referenceModel: WALLET_REFERENCE_MODELS.BOOKING,
        referenceId: item.bookingId,
        description: `Cashback for trip: ${trip.title}`,
      })

      issued++
      totalAmount += item.amount
    }

    this.logger.info(
      { adminUserId, tripId: dto.tripId, issued, totalAmount },
      'Cashback issued',
    )

    return { issued, totalAmount }
  }

  /** All cashback grouped by user (admin). */
  async getCashbackHistoryByUser(filters: CashbackHistoryFilters) {
    const pg = paginate(filters)
    const { data, total } = await this.walletRepo.getCashbackByUser({ skip: pg.skip, take: pg.take })
    return { data, pagination: pg.meta(total) }
  }

  /** All cashback grouped by trip (admin). */
  async getCashbackHistoryByTrip(filters: CashbackHistoryFilters) {
    const pg = paginate(filters)
    const { data, total } = await this.walletRepo.getCashbackByTrip({ skip: pg.skip, take: pg.take })
    return { data, pagination: pg.meta(total) }
  }

  /** Per-user cashback drill-down (admin). */
  async getCashbackUserDetail(userId: string, filters: CashbackHistoryFilters) {
    const pg = paginate(filters)
    const { data, total } = await this.walletRepo.getCashbackForUserDetail(
      userId,
      { skip: pg.skip, take: pg.take },
    )
    return { data, pagination: pg.meta(total) }
  }

  // ─── Private Helpers ────────────────────────────────

  private validateCashbackItem(
    item: { bookingId: string; userId: string; amount: number },
    travelerMap: Map<string, CashbackTravelerItem>,
  ) {
    const traveler = travelerMap.get(item.bookingId)
    if (!traveler) {
      throw new ValidationError(`Booking ${item.bookingId} not found in trip`)
    }
    if (traveler.userId !== item.userId) {
      throw new ValidationError(`User mismatch for booking ${item.bookingId}`)
    }
    if (item.amount > traveler.totalAmount) {
      throw new ValidationError(
        `Cashback ₹${item.amount} exceeds booking amount ₹${traveler.totalAmount} for ${traveler.userName}`,
      )
    }
    if (traveler.cashbackIssued !== null) {
      throw new ValidationError(`Cashback already issued for booking ${item.bookingId} (${traveler.userName})`)
    }
  }
}
