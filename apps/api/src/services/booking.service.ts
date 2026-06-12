import { Logger } from 'pino'
import { startTimer } from '../utils/perf-timer'
import type { MyBookingFilters, MyBookingSummary, CancelBookingResult, MyTripBookingStatus } from '@shared/types/booking.types'
import type { MyTripRequestItem } from '@shared/types/trip-request.types'
import type { CreateBookingResponse, VerifyPaymentDto, VerifyPaymentResponse } from '@shared/types/payment.types'
import { BookingRepository } from '../repositories/booking.repository'
import { TripRepository } from '../repositories/trip.repository'
import { TripRequestRepository } from '../repositories/trip-request.repository'
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import { PaymentService } from './payment.service'
import type { NotificationService } from './notification.service'
import type { VehicleService } from './vehicle.service'
import type { CacheService } from './cache.service'
import { cacheKeys, cacheInvalidation } from '../utils/cache-keys'
import { NotFoundError, ForbiddenError, ValidationError, ConflictError, AuthError } from '../errors/app-error'
import { PAGINATION_DEFAULTS, BOOKING_EXPIRY_MINUTES, PLATFORM_COMMISSION_PERCENT, ESCROW_SAFETY_BUFFER_DAYS, PAYMENT_TX_TYPE, PAYMENT_TX_STATUS, CURRENCY, RAZORPAY_MOCK_KEY } from '../utils/constants'
import { BOOKING_STATUS, BOOKING_MODE, TRIP_REQUEST_STATUS, TRIP_STATUS, TRANSFER_POINT_TYPE, VERIFICATION_STATUS, NOTIFICATION_TYPE, CANCELLATION_POLICY } from '@shared/constants'
import { env } from '../config/env'

/** Maps Prisma's nested assignedSeat → flat API shape */
function mapAssignedSeat(
  seat: { seatNumber: number; seatLabel: string; tripVehicle: { label: string } } | null,
) {
  if (!seat) return null
  return { seatNumber: seat.seatNumber, seatLabel: seat.seatLabel, vehicleName: seat.tripVehicle.label }
}

/** Maps Prisma travelerDetails (with nested assignedSeat) to API shape */
function mapTravelerDetails(
  travelers: Array<{ assignedSeat?: { seatNumber: number; seatLabel: string; tripVehicle: { label: string } } | null; [key: string]: unknown }>,
) {
  return travelers.map((t) => {
    const { assignedSeat, ...rest } = t
    return { ...rest, assignedSeat: mapAssignedSeat(assignedSeat ?? null) }
  })
}

export class BookingService {
  constructor(
    private bookingRepo: BookingRepository,
    private tripRepo: TripRepository,
    private tripRequestRepo: TripRequestRepository,
    private paymentTxRepo: PaymentTransactionRepository,
    private paymentService: PaymentService,
    private logger: Logger,
    private notificationService: NotificationService,
    private vehicleService: VehicleService | null = null,
    private cache: CacheService | null = null,
  ) {}

  /** Invalidate trip search + detail caches after booking mutations. */
  private async invalidateTripCaches(tripSlug: string) {
    if (!this.cache) return
    await Promise.all([
      this.cache.invalidateByPrefix(cacheInvalidation.allTrips()),
      this.cache.del(cacheKeys.tripDetail(tripSlug)),
    ])
  }

  /** Guards against calling payment methods when Razorpay is not configured */
  private requirePaymentService(): PaymentService {
    if (!this.paymentService) {
      throw new ValidationError('Payment features are not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET')
    }
    return this.paymentService
  }

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

    type BookingRow = Awaited<ReturnType<BookingRepository['findByUserId']>>['data'][number]

    return {
      data: data.map((b: BookingRow) => ({
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
            verified: b.trip.organizer.verificationStatus === VERIFICATION_STATUS.APPROVED,
          },
        },
        hasReview: b.review !== null,
        review: b.review
          ? {
              id: b.review.id,
              overallRating: b.review.overallRating,
              comment: b.review.comment,
              photos: b.review.photos,
              createdAt: b.review.createdAt,
              editedAt: b.review.editedAt,
            }
          : null,
        travelerDetails: mapTravelerDetails(b.travelerDetails ?? []),
        pickupPoint: b.pickupPoint ?? undefined,
        dropPoint: b.dropPoint ?? undefined,
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
        case BOOKING_STATUS.CONFIRMED:
        case BOOKING_STATUS.PENDING_PAYMENT:
          upcoming += count; break
        case BOOKING_STATUS.COMPLETED:
          completed += count; break
        case BOOKING_STATUS.CANCELLED:
        case BOOKING_STATUS.EXPIRED:
          cancelled += count; break
      }
    }
    const paymentPending = await this.tripRequestRepo.countPendingPaymentForUser(userId)
    return { all, upcoming, completed, cancelled, paymentPending }
  }

  /**
   * Cancels a booking and issues a refund based on the cancellation policy.
   *
   * Refund rules:
   * - FLEXIBLE: 100% if >=48h, 50% if <48h
   * - MODERATE: 50% if >=48h, 0% if <48h
   * - STRICT: 0% always
   *
   * Uses an atomic transaction gate (SELECT FOR UPDATE + UPDATE + conditional seat
   * decrement) to prevent double-cancel and stale-read races. Only the first concurrent
   * cancel request that wins the gate proceeds; the other gets a validation error.
   *
   * For CONFIRMED cancellations with refundAmount > 0, creates a REFUND PaymentTransaction
   * and calls Razorpay initiateRefund. The refund.processed webhook marks it REFUNDED.
   *
   * @throws NotFoundError — booking doesn't exist
   * @throws ForbiddenError — user doesn't own the booking
   * @throws ValidationError — booking can't be cancelled (wrong status)
   */
  async cancelBooking(userId: string, bookingId: string, reason: string): Promise<CancelBookingResult> {
    const timer = startTimer()
    const booking = await this.bookingRepo.findById(bookingId)
    if (!booking) throw new NotFoundError('Booking')
    if (booking.userId !== userId) throw new ForbiddenError('You can only cancel your own bookings')

    const hoursUntilTrip = (booking.trip.startDate.getTime() - Date.now()) / (1000 * 60 * 60)
    const refundPercent = this.calculateRefundPercent(booking.trip.cancellationPolicy, hoursUntilTrip)
    const refundAmount = Math.round((booking.totalAmount * refundPercent) / 100)

    // Atomic gate with SELECT FOR UPDATE: captures the true pre-cancel status and atomically
    // decrements trip seats if it was CONFIRMED — all in one transaction.
    const { rows: cancelledRows, preCancelStatus } = await this.bookingRepo.cancelAtomically(
      bookingId, userId, reason,
      { tripId: booking.trip.id, numTravelers: booking.numTravelers },
    )
    if (cancelledRows === 0) {
      const status = preCancelStatus ?? booking.bookingStatus
      throw new ValidationError(`Cannot cancel a booking with status ${status}`)
    }

    this.logger.info({ bookingId, userId, refundPercent, refundAmount, durationMs: timer.elapsed() }, 'Booking cancelled')

    const wasConfirmed = preCancelStatus === BOOKING_STATUS.CONFIRMED

    if (wasConfirmed) {
      // Seats were already decremented atomically inside cancelAtomically.
      // Revert FULL → ACTIVE if now under capacity (idempotent — safe outside tx).
      const revertedRows = await this.tripRepo.revertFullIfUnderCapacity(booking.trip.id)
      if (revertedRows > 0) {
        this.logger.info({ tripId: booking.trip.id }, 'Trip reverted from FULL to ACTIVE after cancellation')
      }

      if (refundAmount > 0) {
        await this.initiateBookingRefund(bookingId, refundAmount, reason)
      }
    }

    // Release any held/booked seats
    if (this.vehicleService) {
      this.vehicleService.releaseSeats(bookingId)
        .catch((err) => this.logger.error({ err, bookingId }, 'Failed to release seats on cancellation'))
    }

    // Fire-and-forget: notify traveler of cancellation
    this.notificationService.send({
      userId: booking.userId,
      type: NOTIFICATION_TYPE.BOOKING_CANCELLED,
      title: 'Booking Cancelled',
      body: `Your booking for ${booking.trip.title} has been cancelled. Refund: ₹${refundAmount} (${refundPercent}%).`,
      data: { bookingId: booking.id, tripId: booking.trip.id, tripSlug: booking.trip.slug, tripName: booking.trip.title, refundAmount, refundPercent },
    }).catch((err) => this.logger.error({ err, bookingId }, 'Failed to send booking cancellation notification'))

    // Invalidate trip caches (currentBookings changed)
    await this.invalidateTripCaches(booking.trip.slug)

    return {
      bookingId: booking.id,
      bookingStatus: BOOKING_STATUS.CANCELLED,
      refundAmount,
      refundPercent,
      cancellationPolicy: booking.trip.cancellationPolicy,
    }
  }

  /**
   * Creates a REFUND PaymentTransaction and calls Razorpay initiateRefund.
   * The refund.processed webhook finalises the transaction status to REFUNDED.
   * Logs errors but does not throw — cancellation is already committed; the INITIATED
   * REFUND record is the retry target for ops/admin.
   */
  private async initiateBookingRefund(bookingId: string, refundAmount: number, reason: string): Promise<void> {
    const txList = await this.paymentTxRepo.findByBookingId(bookingId)
    const capturedTx = txList.find(
      (tx) => tx.type === PAYMENT_TX_TYPE.PAYMENT && tx.status === PAYMENT_TX_STATUS.CAPTURED && tx.razorpayPaymentId,
    )

    if (!capturedTx?.razorpayPaymentId) {
      this.logger.warn({ bookingId }, 'No captured payment tx found — skipping Razorpay refund')
      return
    }

    // Create the INITIATED record first — provides audit trail and retry target if the API call fails
    const refundTx = await this.paymentTxRepo.create({
      bookingId,
      type: PAYMENT_TX_TYPE.REFUND,
      amount: refundAmount,
      status: PAYMENT_TX_STATUS.INITIATED,
      metadata: { reason },
    })

    try {
      await this.paymentService.initiateRefund(
        capturedTx.razorpayPaymentId,
        refundAmount * 100,
        { bookingId, reason },
      )
      this.logger.info({ bookingId, refundTxId: refundTx.id, amount: refundAmount }, 'Refund initiated with Razorpay')
    } catch (err) {
      // REFUND tx with INITIATED status remains — ops/admin can retry; Razorpay async may still process it
      this.logger.error({ err, bookingId, refundTxId: refundTx.id }, 'Razorpay refund initiation failed — REFUND tx remains INITIATED for retry')
    }
  }

  // ─── Payment Flow Methods ─────────────────────────────

  /**
   * Creates a booking with Razorpay order (Facade pattern).
   *
   * Flow:
   * 1. Idempotency check — return existing PENDING_PAYMENT order
   * 2. 9 validations (trip status, seats, deadline, booking mode, etc.)
   * 3. Calculate price (early bird check)
   * 4. Create Razorpay order WITH order-level transfers (H4 fix)
   * 5. Create Booking(PENDING_PAYMENT) + PaymentTransaction(INITIATED)
   *
   * @throws ConflictError — user already has CONFIRMED booking
   * @throws NotFoundError — trip doesn't exist
   * @throws ValidationError — trip not active, full, past deadline, etc.
   */
  async createBooking(
    userId: string,
    input: {
      tripId: string
      pickupPointId?: string
      dropPointId?: string
      numTravelers: number
      travelers: Array<{ name: string; phone: string; age: number; gender: 'MALE' | 'FEMALE' | 'OTHER'; isPrimary: boolean }>
      seatIds?: string[]
    },
  ): Promise<CreateBookingResponse> {
    const timer = startTimer()
    const paymentSvc = this.requirePaymentService()

    // 1. Idempotency check
    const existing = await this.bookingRepo.findActiveByUserAndTrip(userId, input.tripId)
    if (existing) {
      if (existing.bookingStatus === BOOKING_STATUS.CONFIRMED) {
        throw new ConflictError('You already have a confirmed booking for this trip', 'ALREADY_BOOKED')
      }
      if (existing.expiresAt) {
        // PENDING_PAYMENT — return same order
        const paymentTx = existing.paymentTransactions[0]
        return {
          bookingId: existing.id,
          bookingRef: existing.bookingRef,
          razorpayOrderId: paymentTx?.razorpayOrderId || '',
          razorpayKeyId: env.RAZORPAY_KEY_ID || RAZORPAY_MOCK_KEY,
          amountInRupees: existing.totalAmount,
          currency: CURRENCY,
          expiresAt: existing.expiresAt.toISOString(),
        }
      }
      // PENDING_PAYMENT without expiresAt — the expiry cron can never reap it
      // (matches expiresAt < now only), so supersede it and create a fresh order
      this.logger.warn({ bookingId: existing.id }, 'PENDING_PAYMENT booking has no expiresAt — expiring it and creating a fresh order')
      await this.bookingRepo.updateStatus(existing.id, BOOKING_STATUS.EXPIRED)
    }

    // 2. Validations
    if (!env.RAZORPAY_KEY_ID && env.NODE_ENV === 'production') {
      throw new ValidationError('Payment configuration is missing — contact support')
    }

    const trip = await this.tripRepo.findByIdForBooking(input.tripId)
    if (!trip) throw new NotFoundError('Trip')
    if (trip.status !== TRIP_STATUS.ACTIVE || !trip.acceptingBookings) {
      throw new ValidationError('This trip is not accepting bookings')
    }
    if (trip.bookingDeadline && new Date(trip.bookingDeadline) < new Date()) {
      throw new ValidationError('Booking deadline has passed')
    }
    if (trip.currentBookings + input.numTravelers > trip.maxGroupSize) {
      throw new ValidationError('Not enough seats available')
    }
    if (trip.organizer?.userId === userId) {
      throw new ValidationError('You cannot book your own trip')
    }
    if (!trip.organizer?.razorpayAccountId) {
      throw new ValidationError('Organizer has not set up payment — booking unavailable')
    }
    if (input.numTravelers !== input.travelers.length) {
      throw new ValidationError('Number of traveler details must match numTravelers')
    }
    if (input.seatIds?.length && input.seatIds.length !== input.numTravelers) {
      throw new ValidationError('Number of selected seats must match number of travelers')
    }

    // REQUEST_BASED mode check
    if (trip.bookingMode === BOOKING_MODE.REQUEST_BASED) {
      const approvedRequest = await this.tripRequestRepo.findApprovedForUser(input.tripId, userId)
      if (!approvedRequest) {
        throw new ValidationError('You need an approved request to book this trip')
      }
    }

    // 3. Validate transfer points (if provided)
    let pickupExtraCharge = 0
    let dropExtraCharge = 0
    if (input.pickupPointId) {
      const point = trip.transferPoints?.find((p: { id: string }) => p.id === input.pickupPointId)
      if (!point) throw new ValidationError('Selected pickup point does not belong to this trip')
      if (point.type !== TRANSFER_POINT_TYPE.PICKUP) throw new ValidationError('Selected pickup point is not a PICKUP type')
      pickupExtraCharge = point.extraCharge ?? 0
    }
    if (input.dropPointId) {
      const point = trip.transferPoints?.find((p: { id: string }) => p.id === input.dropPointId)
      if (!point) throw new ValidationError('Selected drop point does not belong to this trip')
      if (point.type !== TRANSFER_POINT_TYPE.DROP) throw new ValidationError('Selected drop point is not a DROP type')
      dropExtraCharge = point.extraCharge ?? 0
    }

    // 4. Calculate price (base + transfer point extra charges)
    const isEarlyBird = trip.earlyBirdPrice && trip.earlyBirdDeadline && new Date(trip.earlyBirdDeadline) > new Date()
    const pricePerPerson = isEarlyBird ? trip.earlyBirdPrice! : trip.pricePerPerson
    const totalAmount = (pricePerPerson + pickupExtraCharge + dropExtraCharge) * input.numTravelers
    const amountInPaise = totalAmount * 100

    // 5. Build order-level transfers (H4 fix)
    // Only attach transfers in production with a real Razorpay linked account
    // Real Razorpay linked account IDs: "acc_" + 14+ alphanumeric chars (e.g. acc_HjVXtlV9LdABJ0)
    const REAL_ACCOUNT_RE = /^acc_[A-Za-z0-9]{14,}$/
    const isRealAccount =
      env.NODE_ENV === 'production' &&
      REAL_ACCOUNT_RE.test(trip.organizer.razorpayAccountId ?? '')

    const transfers: Record<string, unknown>[] = isRealAccount
      ? [{
          account: trip.organizer.razorpayAccountId,
          amount: Math.round(amountInPaise * (1 - (trip.organizer.commissionRate ?? PLATFORM_COMMISSION_PERCENT) / 100)),
          currency: CURRENCY,
          on_hold: 1,
          on_hold_until: Math.floor(
            new Date(trip.endDate).getTime() / 1000 + ESCROW_SAFETY_BUFFER_DAYS * 24 * 60 * 60,
          ),
          notes: { tripId: input.tripId },
        }]
      : []

    // 5. Pre-check seat availability (optimistic — atomic hold happens after booking creation)
    if (input.seatIds?.length && this.vehicleService) {
      const availableSeats = await this.vehicleService.checkSeatsAvailable(input.seatIds)
      if (!availableSeats) {
        throw new ConflictError('One or more selected seats are no longer available', 'SEAT_CONFLICT')
      }
    }

    // 6. Create Razorpay order
    const order = await paymentSvc.createOrder(
      amountInPaise,
      `booking-${Date.now()}`,
      transfers,
      { tripId: input.tripId, userId },
    )

    // 7. Create Booking + PaymentTransaction
    const expiresAt = new Date(Date.now() + BOOKING_EXPIRY_MINUTES * 60 * 1000)
    const booking = await this.bookingRepo.create({
      tripId: input.tripId,
      userId,
      numTravelers: input.numTravelers,
      totalAmount,
      expiresAt,
      pickupPointId: input.pickupPointId,
      dropPointId: input.dropPointId,
      travelers: input.travelers,
    })

    // H2 fix: Persist PaymentTransaction so confirmBooking can find it
    await this.paymentTxRepo.create({
      bookingId: booking.id,
      type: PAYMENT_TX_TYPE.PAYMENT,
      amount: totalAmount,
      razorpayOrderId: order.id,
      status: PAYMENT_TX_STATUS.INITIATED,
    })

    // 8. Atomically hold seats (if hold fails, cancel booking to prevent orphaned state)
    if (input.seatIds?.length && this.vehicleService) {
      try {
        await this.vehicleService.holdSeats(input.seatIds, userId, booking.id)
      } catch (seatErr) {
        // Cancel the booking — Razorpay order expires naturally
        await this.bookingRepo.updateStatus(booking.id, BOOKING_STATUS.EXPIRED)
          .catch((cancelErr: unknown) => this.logger.error({ cancelErr, bookingId: booking.id }, 'Failed to expire booking after seat hold failure'))
        throw seatErr
      }
    }

    this.logger.info(
      { bookingId: booking.id, orderId: order.id, amount: totalAmount, seatCount: input.seatIds?.length ?? 0, durationMs: timer.elapsed() },
      'Booking created with Razorpay order',
    )

    return {
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      razorpayOrderId: order.id,
      razorpayKeyId: env.RAZORPAY_KEY_ID || RAZORPAY_MOCK_KEY,
      amountInRupees: totalAmount,
      currency: CURRENCY,
      expiresAt: expiresAt.toISOString(),
    }
  }

  /**
   * Confirms a booking after payment — captures payment + reserves seats.
   *
   * Uses an atomic gate (PENDING_PAYMENT → CONFIRMED) before any seat increment or
   * network call. This prevents:
   *   - Resurrection of EXPIRED/CANCELLED bookings via a late payment webhook
   *   - Double seat-increment on concurrent confirms of the same booking (only the
   *     request that wins the gate proceeds; retries see CONFIRMED and return idempotently)
   *
   * Flow:
   * 1. Load booking — if CONFIRMED already, return idempotent success
   * 2. Reject non-PENDING_PAYMENT statuses (EXPIRED/CANCELLED) with a clear error
   * 3. Atomic gate: UPDATE WHERE bookingStatus='PENDING_PAYMENT' → CONFIRMED
   * 4. Increment seat counter (capacity check)
   * 5. Capture payment (exact authorized amount — verified against Razorpay on timeout)
   * 6. If either step 4 or 5 fails → rollback seats + revert gate (CONFIRMED → PENDING_PAYMENT)
   *
   * @throws NotFoundError — booking doesn't exist
   * @throws ValidationError — booking is in a non-confirmable state (EXPIRED, CANCELLED)
   * @throws ConflictError — seats full
   * @throws PaymentError — capture fails (seats and gate auto-rollback)
   */
  async confirmBooking(
    bookingId: string,
    preloadedBooking?: Awaited<ReturnType<BookingRepository['findWithPaymentDetails']>>,
  ): Promise<{ bookingId: string; bookingStatus: string; paymentStatus: string }> {
    const timer = startTimer()
    this.requirePaymentService()

    const booking = preloadedBooking ?? await this.bookingRepo.findWithPaymentDetails(bookingId)
    if (!booking) throw new NotFoundError('Booking')

    // Idempotent — already confirmed
    if (booking.bookingStatus === BOOKING_STATUS.CONFIRMED) {
      return {
        bookingId: booking.id,
        bookingStatus: BOOKING_STATUS.CONFIRMED,
        paymentStatus: booking.paymentTransactions[0]?.status || PAYMENT_TX_STATUS.CAPTURED,
      }
    }

    // Reject EXPIRED/CANCELLED bookings — do not resurrect them
    if (booking.bookingStatus !== BOOKING_STATUS.PENDING_PAYMENT) {
      this.logger.warn({ bookingId, status: booking.bookingStatus }, 'confirmBooking called on non-pending booking — rejecting')
      throw new ValidationError(`Cannot confirm a booking with status ${booking.bookingStatus}`)
    }

    const paymentTx = booking.paymentTransactions[0]
    if (!paymentTx) {
      throw new ValidationError('No payment transaction found for this booking')
    }

    // Atomic gate — only the first concurrent call transitions PENDING_PAYMENT→CONFIRMED.
    // Subsequent retries see CONFIRMED and return idempotently without re-incrementing seats.
    const gateRows = await this.bookingRepo.atomicConfirmGate(bookingId)
    if (gateRows === 0) {
      // Lost the race — re-read to return idempotent response
      const fresh = await this.bookingRepo.findWithPaymentDetails(bookingId)
      if (fresh?.bookingStatus === BOOKING_STATUS.CONFIRMED) {
        return {
          bookingId,
          bookingStatus: BOOKING_STATUS.CONFIRMED,
          paymentStatus: fresh.paymentTransactions[0]?.status || PAYMENT_TX_STATUS.CAPTURED,
        }
      }
      throw new ConflictError('Booking confirmation is already in progress', 'CONFIRM_RACE')
    }

    // We won the gate — proceed with seat increment then capture
    const rowsUpdated = await this.tripRepo.atomicIncrementBookings(booking.trip.id, booking.numTravelers)
    if (rowsUpdated === 0) {
      // Trip is at capacity — revert the gate so the customer can be refunded or retry later
      await this.bookingRepo.revertConfirmGate(bookingId)
        .catch((err) => this.logger.error({ err, bookingId }, 'Failed to revert confirmation gate after capacity check'))
      throw new ConflictError('Not enough seats available — trip may be full', 'CAPACITY_FULL')
    }

    // Capture payment (exact amount from DB — prevents amount tampering)
    try {
      await this.paymentService.capturePayment(paymentTx.razorpayPaymentId!, paymentTx.amount * 100, CURRENCY)
    } catch (error) {
      // Rollback seats and revert the gate so webhook retries can re-attempt
      this.logger.error({ bookingId, error }, 'Payment capture failed — rolling back seat increment and confirmation gate')
      await Promise.allSettled([
        this.tripRepo.atomicDecrementBookings(booking.trip.id, booking.numTravelers),
        this.bookingRepo.revertConfirmGate(bookingId),
      ])
      throw error
    }

    // Confirm held seats → BOOKED and auto-assign travelers
    if (this.vehicleService) {
      try {
        const heldSeats = await this.vehicleService.getBookingSeats(booking.id)
        const travelers: Array<{ id: string }> = booking.travelerDetails ?? []
        if (heldSeats.length > 0 && travelers.length > 0) {
          const assignments = heldSeats
            .map((seat: { id: string }, i: number) => ({
              seatId: seat.id,
              travelerDetailId: travelers[i]?.id ?? '',
            }))
            .filter((a: { travelerDetailId: string }) => a.travelerDetailId)

          await this.vehicleService.confirmSeats(booking.id, booking.userId, assignments)
        }
      } catch (seatErr) {
        // Seat assignment is non-critical — booking and payment are already committed
        this.logger.error({ bookingId, seatErr }, 'Seat confirmation failed — booking still confirmed')
      }
    }

    // Mark trip request as CONVERTED if this booking originated from a REQUEST_BASED flow
    if (booking.tripRequest && booking.tripRequest.status === TRIP_REQUEST_STATUS.APPROVED) {
      await this.tripRequestRepo.markConverted(booking.tripRequest.id, bookingId)
    }

    // Auto-transition ACTIVE → FULL if trip is at capacity (atomic, no TOCTOU)
    const fullRows = await this.tripRepo.markFullIfAtCapacity(booking.trip.id)
    if (fullRows > 0) {
      this.logger.info({ tripId: booking.trip.id }, 'Trip auto-transitioned to FULL')
    }

    this.logger.info({ bookingId, durationMs: timer.elapsed() }, 'Booking confirmed')

    // Fire-and-forget: notify traveler
    this.notificationService.send({
      userId: booking.userId,
      type: NOTIFICATION_TYPE.BOOKING_CONFIRMED,
      title: 'Booking Confirmed!',
      body: `Your booking for ${booking.trip.title} has been confirmed.`,
      data: { bookingId: booking.id, tripId: booking.trip.id, tripSlug: booking.trip.slug, tripName: booking.trip.title },
    }).catch((err) => this.logger.error({ err, bookingId }, 'Failed to send booking confirmation notification'))

    await this.invalidateTripCaches(booking.trip.slug)

    return {
      bookingId: booking.id,
      bookingStatus: BOOKING_STATUS.CONFIRMED,
      paymentStatus: PAYMENT_TX_STATUS.CAPTURED,
    }
  }

  /**
   * Frontend callback — verifies Razorpay signature then confirms booking.
   * Dual verification: FE verifies immediately, webhook as backup.
   *
   * @throws NotFoundError — booking doesn't exist
   * @throws AuthError — invalid payment signature
   */
  async verifyAndConfirmPayment(
    bookingId: string,
    userId: string,
    dto: VerifyPaymentDto,
  ): Promise<VerifyPaymentResponse> {
    const booking = await this.bookingRepo.findWithPaymentDetails(bookingId)
    if (!booking) throw new NotFoundError('Booking')

    // Authorization — only booking owner can verify payment
    if (booking.userId !== userId) {
      throw new ForbiddenError('You can only verify your own bookings')
    }

    // Already confirmed — idempotent return
    if (booking.bookingStatus === BOOKING_STATUS.CONFIRMED) {
      return {
        bookingId: booking.id,
        bookingStatus: BOOKING_STATUS.CONFIRMED,
        paymentStatus: booking.paymentTransactions[0]?.status || PAYMENT_TX_STATUS.CAPTURED,
      }
    }

    // Verify HMAC-SHA256 signature
    const isValid = this.paymentService.verifySignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    )
    if (!isValid) {
      throw new AuthError('Invalid payment signature — possible tampering')
    }

    // Persist razorpayPaymentId so confirmBooking() can capture it
    const paymentTx = booking.paymentTransactions[0]
    if (paymentTx) {
      await this.paymentTxRepo.updatePaymentId(paymentTx.id, dto.razorpayPaymentId)
      // Update in-memory so the pre-loaded booking reflects the DB change
      paymentTx.razorpayPaymentId = dto.razorpayPaymentId
    }

    // Confirm booking (capture + seats) — pass pre-loaded booking to avoid re-fetching
    return this.confirmBooking(bookingId, booking)
  }

  /**
   * Returns the traveler's approved trip requests that are awaiting payment.
   * Used by the "Payment Pending" tab on My Bookings page.
   *
   * Business rule: only returns requests where approvalExpiresAt > now
   * (expired ones don't show — they'll be cleaned up by cron)
   */
  async getMyPendingPaymentRequests(userId: string): Promise<MyTripRequestItem[]> {
    const requests = await this.tripRequestRepo.findPendingPaymentForUser(userId)

    type PendingRequest = Awaited<ReturnType<TripRequestRepository['findPendingPaymentForUser']>>[number]

    return requests.map((r: PendingRequest) => ({
      id: r.id,
      tripId: r.tripId,
      numTravelers: r.numTravelers,
      message: r.message,
      status: r.status,
      approvalExpiresAt: r.approvalExpiresAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      canPay: r.status === TRIP_REQUEST_STATUS.APPROVED,
      travelerDetails: r.travelerDetails?.length ? r.travelerDetails : null,
      trip: {
        id: r.trip.id,
        title: r.trip.title,
        slug: r.trip.slug,
        startDate: r.trip.startDate.toISOString(),
        endDate: r.trip.endDate.toISOString(),
        photos: r.trip.photos,
        pricePerPerson: (r.trip.earlyBirdPrice && r.trip.earlyBirdDeadline && new Date(r.trip.earlyBirdDeadline) > new Date())
          ? r.trip.earlyBirdPrice
          : r.trip.pricePerPerson,
        destination: r.trip.destination,
        organizer: {
          id: r.trip.organizer.id,
          businessName: r.trip.organizer.businessName,
          verified: r.trip.organizer.verificationStatus === VERIFICATION_STATUS.APPROVED,
        },
      },
    }))
  }

  /**
   * Returns the user's active booking/request status for a specific trip.
   * Used by trip detail page to show correct CTA button.
   */
  async getMyTripStatus(userId: string, tripId: string): Promise<MyTripBookingStatus> {
    const [booking, request] = await Promise.all([
      this.bookingRepo.findActiveByUserAndTrip(userId, tripId),
      this.tripRequestRepo.findActiveByUserAndTrip(tripId, userId),
    ])

    return {
      // Safe: findActiveByUserAndTrip only returns PENDING_PAYMENT | CONFIRMED
      bookingStatus: (booking?.bookingStatus as MyTripBookingStatus['bookingStatus']) ?? null,
      // Safe: findActiveByUserAndTrip only returns PENDING | non-expired APPROVED
      requestStatus: (request?.status as MyTripBookingStatus['requestStatus']) ?? null,
    }
  }

  /** Refund % based on cancellation policy and hours until trip */
  private calculateRefundPercent(policy: string, hoursUntilTrip: number): number {
    switch (policy) {
      case CANCELLATION_POLICY.FLEXIBLE: return hoursUntilTrip >= 48 ? 100 : 50
      case CANCELLATION_POLICY.MODERATE: return hoursUntilTrip >= 48 ? 50 : 0
      case CANCELLATION_POLICY.STRICT: return 0
      default: return 0
    }
  }
}
