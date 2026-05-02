import { Logger } from 'pino'
import type { MyBookingFilters, MyBookingSummary, CancelBookingResult } from '@shared/types/booking.types'
import { BookingRepository } from '../repositories/booking.repository'
import { NotFoundError, ForbiddenError, ValidationError } from '../errors/app-error'
import { PAGINATION_DEFAULTS } from '../utils/constants'

export class BookingService {
  constructor(
    private bookingRepo: BookingRepository,
    private logger: Logger,
  ) {}

  /**
   * Returns a paginated list of the traveler's bookings.
   *
   * Tab determines both the status filter and sort order.
   * Maps DB organizer.verificationStatus → boolean `verified`.
   * Maps review existence → boolean `hasReview`.
   *
   * @throws Never — returns empty list if no bookings match
   */
  async getMyBookings(userId: string, filters: MyBookingFilters) {
    const page = filters.page ?? 1
    const limit = Math.min(filters.limit ?? 10, PAGINATION_DEFAULTS.maxLimit)
    const offset = (page - 1) * limit

    const { data, total } = await this.bookingRepo.findByUserId(userId, filters.tab, { offset, limit })

    return {
      data: data.map((b: any) => ({
        id: b.id,
        bookingRef: b.bookingRef,
        bookingStatus: b.bookingStatus,
        numTravelers: b.numTravelers,
        totalAmount: b.totalAmount,
        tripProtection: b.tripProtection,
        createdAt: b.createdAt,
        cancelledAt: b.cancelledAt,
        trip: {
          id: b.trip.id,
          title: b.trip.title,
          slug: b.trip.slug,
          startDate: b.trip.startDate,
          endDate: b.trip.endDate,
          photos: b.trip.photos,
          tripType: b.trip.tripType,
          cancellationPolicy: b.trip.cancellationPolicy,
          destination: { id: b.trip.destination.id, name: b.trip.destination.name, slug: b.trip.destination.slug },
          organizer: {
            id: b.trip.organizer.id,
            businessName: b.trip.organizer.businessName,
            rating: b.trip.organizer.rating,
            verified: b.trip.organizer.verificationStatus === 'APPROVED',
          },
        },
        hasReview: b.review !== null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  /**
   * Returns booking count per tab for tab badges.
   *
   * Maps DB statuses to 4 tabs:
   * - upcoming = CONFIRMED + PENDING_PAYMENT
   * - completed = COMPLETED
   * - cancelled = CANCELLED + EXPIRED (AR-1)
   * - all = sum of everything
   */
  async getMyBookingSummary(userId: string): Promise<MyBookingSummary> {
    const groups = await this.bookingRepo.getMyBookingSummary(userId)
    let upcoming = 0, completed = 0, cancelled = 0, all = 0

    for (const g of groups) {
      const count = g._count.id
      all += count
      switch (g.bookingStatus) {
        case 'CONFIRMED':
        case 'PENDING_PAYMENT':
          upcoming += count; break
        case 'COMPLETED':
          completed += count; break
        case 'CANCELLED':
        case 'EXPIRED':
          cancelled += count; break
      }
    }
    return { all, upcoming, completed, cancelled }
  }

  /**
   * Cancels a booking and calculates refund based on cancellation policy.
   *
   * Refund rules:
   * - FLEXIBLE: 100% if >=48h, 50% if <48h
   * - MODERATE: 50% if >=48h, 0% if <48h
   * - STRICT: 0% always
   *
   * @throws NotFoundError — booking doesn't exist
   * @throws ForbiddenError — user doesn't own the booking (IDOR — AR-2)
   * @throws ValidationError — booking can't be cancelled (wrong status)
   */
  async cancelBooking(userId: string, bookingId: string, reason: string): Promise<CancelBookingResult> {
    const booking = await this.bookingRepo.findById(bookingId)
    if (!booking) throw new NotFoundError('Booking')
    if (booking.userId !== userId) throw new ForbiddenError('You can only cancel your own bookings')

    if (!['CONFIRMED', 'PENDING_PAYMENT'].includes(booking.bookingStatus)) {
      throw new ValidationError(`Cannot cancel a booking with status ${booking.bookingStatus}`)
    }

    const hoursUntilTrip = (booking.trip.startDate.getTime() - Date.now()) / (1000 * 60 * 60)
    const refundPercent = this.calculateRefundPercent(booking.trip.cancellationPolicy, hoursUntilTrip)
    const refundAmount = Math.round((booking.totalAmount * refundPercent) / 100)

    this.logger.info({ bookingId, userId, refundPercent, refundAmount }, 'Cancelling booking')

    await this.bookingRepo.cancel(bookingId, userId, reason)

    return {
      bookingId: booking.id,
      bookingStatus: 'CANCELLED',
      refundAmount,
      refundPercent,
      cancellationPolicy: booking.trip.cancellationPolicy,
    }
  }

  /** Refund % based on cancellation policy and hours until trip */
  private calculateRefundPercent(policy: string, hoursUntilTrip: number): number {
    switch (policy) {
      case 'FLEXIBLE': return hoursUntilTrip >= 48 ? 100 : 50
      case 'MODERATE': return hoursUntilTrip >= 48 ? 50 : 0
      case 'STRICT': return 0
      default: return 0
    }
  }
}
