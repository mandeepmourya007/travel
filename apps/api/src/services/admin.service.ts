import type { Logger } from 'pino'
import type { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import type { UserRepository } from '../repositories/user.repository'
import type { BookingRepository } from '../repositories/booking.repository'
import type { TripRepository } from '../repositories/trip.repository'
import type { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import type { MessageRepository } from '../repositories/message.repository'
import type { NotificationRepository } from '../repositories/notification.repository'
import type { OrganizerApprovalFilters, ApproveRejectDto, PlatformStatsResponse, AdminBookingFilters } from '@shared/types/admin.types'
import { NotFoundError, ValidationError } from '../errors/app-error'

export class AdminService {
  constructor(
    private organizerProfileRepo: OrganizerProfileRepository,
    private userRepo: UserRepository,
    private bookingRepo: BookingRepository,
    private tripRepo: TripRepository,
    private paymentTxRepo: PaymentTransactionRepository,
    private messageRepo: MessageRepository,
    private notificationRepo: NotificationRepository,
    private logger: Logger,
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
    const isApproved = dto.action === 'APPROVED'
    const title = isApproved
      ? 'Your organizer profile has been approved!'
      : 'Your organizer profile has been rejected'
    const body = isApproved
      ? 'Congratulations! You can now create and publish trips on TripCompare.'
      : dto.reason
        ? `Your organizer application was rejected. Reason: ${dto.reason}`
        : 'Your organizer application was rejected. Please contact support for details.'

    await this.notificationRepo.create({
      userId: profile.userId,
      type: isApproved ? 'ORGANIZER_APPROVED' : 'ORGANIZER_REJECTED',
      channel: 'IN_APP',
      title,
      body,
      data: { profileId, reason: dto.reason },
    })

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
    return booking
  }
}
