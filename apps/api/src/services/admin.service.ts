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
import type { DocumentReviewRepository, DocumentReviewCommentRow } from '../repositories/document-review.repository'
import type { OrganizerInviteRepository } from '../repositories/organizer-invite.repository'
import type {
  OrganizerApprovalFilters, ApproveRejectDto, PlatformStatsResponse, AdminBookingFilters,
  CashbackTripFilters, IssueCashbackDto, CashbackHistoryFilters, CashbackTravelerItem,
  ReviewDocDto, AddDocCommentDto, OrganizerInviteFilters,
} from '@shared/types/admin.types'
import { REQUIRED_DOC_COUNT, DOC_LABELS } from '@shared/constants/upload'
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
    private docReviewRepo: DocumentReviewRepository,
    private organizerInviteRepo?: OrganizerInviteRepository,
  ) {}

  // ─── Organizer Approvals ──────────────────────────────

  /**
   * Paginated list of organizer profiles for admin approval queue.
   * Defaults to showing PENDING organizers.
   */
  async getApprovalQueue(filters: OrganizerApprovalFilters) {
    const pg = paginate(filters)
    const { data, total } = await this.organizerProfileRepo.findAllAdmin(
      { status: filters.status },
      { skip: pg.skip, take: pg.take },
    )
    return { data, pagination: pg.meta(total) }
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

    // Sync DocumentReview rows with bulk action
    if (dto.action === VERIFICATION_STATUS.APPROVED) {
      await this.docReviewRepo.updateAllDocStatuses(profileId, 'APPROVED')
    } else if (dto.action === VERIFICATION_STATUS.REJECTED) {
      await this.docReviewRepo.updateAllDocStatuses(profileId, 'REJECTED')
    }

    // Create notification for the organizer
    const isApproved = dto.action === VERIFICATION_STATUS.APPROVED
    const title = isApproved
      ? 'Your organizer profile has been approved!'
      : 'Your organizer profile has been rejected'
    const body = isApproved
      ? 'Congratulations! You can now create and publish trips on Safarnama.'
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
    const pg = paginate(filters)
    const { data, total } = await this.bookingRepo.findAllAdmin(
      { status: filters.status, search: filters.search },
      { skip: pg.skip, take: pg.take },
    )
    return { data, pagination: pg.meta(total) }
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

  // ─── Document Review ──────────────────────────────────

  /**
   * Review a single document for an organizer (approve/reject).
   * Auto-approves the organizer when all 3 docs are APPROVED.
   * Sets REVISION_REQUIRED when a doc is rejected.
   */
  async reviewDocument(adminUserId: string, organizerId: string, docType: string, dto: ReviewDocDto) {
    const profile = await this.organizerProfileRepo.findById(organizerId)
    if (!profile) throw new NotFoundError('OrganizerProfile')

    const isApproved = dto.action === 'APPROVED'

    await this.docReviewRepo.upsert(organizerId, docType, {
      status: dto.action,
      reviewedAt: new Date(),
      reviewedBy: adminUserId,
    })

    // Auto-add comment if provided
    if (dto.comment) {
      await this.docReviewRepo.addComment({
        organizerId,
        authorId: adminUserId,
        authorRole: 'ADMIN',
        docType,
        comment: dto.comment,
      })
    }

    if (isApproved) {
      // Check if all docs are approved → auto-approve organizer
      const approvedCount = await this.docReviewRepo.countApproved(organizerId)
      if (approvedCount >= REQUIRED_DOC_COUNT) {
        await this.organizerProfileRepo.update(organizerId, {
          verificationStatus: VERIFICATION_STATUS.APPROVED,
        })
        this.notificationService.send({
          userId: profile.userId,
          type: NOTIFICATION_TYPE.ORGANIZER_APPROVED,
          title: 'Your organizer profile has been approved!',
          body: 'All documents verified. You can now create and publish trips on Safarnama.',
          data: { profileId: organizerId },
        }).catch((err) => this.logger.error({ err, organizerId }, 'Failed to send approval notification'))
      }
    } else {
      // Rejected → set REVISION_REQUIRED + notify
      await this.organizerProfileRepo.update(organizerId, {
        verificationStatus: VERIFICATION_STATUS.REVISION_REQUIRED,
      })
      const docLabel = DOC_LABELS[docType as keyof typeof DOC_LABELS] ?? docType
      this.notificationService.send({
        userId: profile.userId,
        type: NOTIFICATION_TYPE.DOCUMENT_REUPLOAD_REQUIRED,
        title: 'Document requires re-upload',
        body: dto.comment
          ? `Your ${docLabel} was rejected. Reason: ${dto.comment}. Please re-upload a clearer document.`
          : `Your ${docLabel} was rejected. Please re-upload a clearer document.`,
        data: { organizerId, docType },
      }).catch((err) => this.logger.error({ err, organizerId }, 'Failed to send doc reupload notification'))
    }

    this.logger.info({ adminUserId, organizerId, docType, action: dto.action, comment: dto.comment ?? null }, 'Document reviewed')
    return { organizerId, docType, status: dto.action }
  }

  /** Add a comment to the organizer's document review thread. */
  async addDocComment(userId: string, role: string, organizerId: string, dto: AddDocCommentDto) {
    const profile = await this.organizerProfileRepo.findById(organizerId)
    if (!profile) throw new NotFoundError('OrganizerProfile')

    const comment = await this.docReviewRepo.addComment({
      organizerId,
      authorId: userId,
      authorRole: role,
      docType: dto.docType,
      comment: dto.comment,
      attachmentUrl: dto.attachmentUrl,
    })

    // Notify organizer about the admin comment
    if (role === 'ADMIN') {
      this.notificationService.send({
        userId: profile.userId,
        type: NOTIFICATION_TYPE.ADMIN_SUPPORT_MESSAGE,
        title: 'New comment on your document review',
        body: dto.comment.length > 100 ? `${dto.comment.slice(0, 100)}...` : dto.comment,
        data: { organizerId },
      }).catch((err) => this.logger.error({ err, organizerId }, 'Failed to send doc comment notification'))
    }

    return comment
  }

  /** Full document review detail: organizer + doc reviews + comments. */
  async getDocReviewDetail(organizerId: string) {
    const profile = await this.organizerProfileRepo.findByIdAdmin(organizerId)
    if (!profile) throw new NotFoundError('OrganizerProfile')

    const comments = await this.docReviewRepo.findComments(organizerId, { skip: 0, take: 100 })

    // Resolve author names from User table
    const commentData = comments.data as DocumentReviewCommentRow[]
    const authorIds = Array.from(new Set(commentData.map((c) => c.authorId)))
    const authors = await this.userRepo.findByIds(authorIds)
    const authorMap = new Map(authors.map((a) => [a.id, a.name]))

    return {
      ...profile,
      reviewComments: commentData.map((c) => ({
        id: c.id,
        authorId: c.authorId,
        authorName: authorMap.get(c.authorId) ?? (c.authorRole === 'ADMIN' ? 'Admin' : 'Organizer'),
        authorRole: c.authorRole,
        docType: c.docType,
        comment: c.comment,
        attachmentUrl: c.attachmentUrl,
        createdAt: c.createdAt.toISOString(),
      })),
    }
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

  async getOrganizerInvites(filters: OrganizerInviteFilters) {
    if (!this.organizerInviteRepo) {
      throw new ValidationError('Organizer invite feature is not configured')
    }
    const pg = paginate(filters)
    const { data, total } = await this.organizerInviteRepo.findAll(
      { status: filters.status },
      { skip: pg.skip, take: pg.take },
    )

    const mapped = data.map((inv) => ({
      id: inv.id,
      email: inv.email,
      sentAt: inv.sentAt.toISOString(),
      acceptedAt: inv.acceptedAt ? inv.acceptedAt.toISOString() : null,
      sentBy: inv.sentBy,
      sentByUser: inv.sentByUser
        ? { id: inv.sentByUser.id, name: inv.sentByUser.name, email: inv.sentByUser.email }
        : null,
    }))

    return { data: mapped, pagination: pg.meta(total) }
  }
}
