import { Logger } from 'pino'
import { Prisma } from '@prisma/client'
import * as Sentry from '@sentry/node'
import { startTimer } from '../utils/perf-timer'
import type { MyBookingFilters, MyBookingSummary, CancelBookingResult, MyTripBookingStatus } from '@shared/types/booking.types'
import type { MyTripRequestItem } from '@shared/types/trip-request.types'
import type { CreateBookingResponse, VerifyPaymentDto, VerifyPaymentResponse } from '@shared/types/payment.types'
import { BookingRepository } from '../repositories/booking.repository'
import { TripRepository } from '../repositories/trip.repository'
import { TripRequestRepository } from '../repositories/trip-request.repository'
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import { UserRepository } from '../repositories/user.repository'
import type { ResellerRepository } from '../repositories/reseller.repository'
import { PaymentService } from './payment.service'
import type { NotificationService } from './notification.service'
import type { VehicleService } from './vehicle.service'
import type { CacheService } from './cache.service'
import type { OtpService } from './otp.service'
import { cacheKeys, cacheInvalidation } from '../utils/cache-keys'
import { NotFoundError, ForbiddenError, ValidationError, ConflictError, AuthError, PaymentError } from '../errors/app-error'
import { PAGINATION_DEFAULTS, BOOKING_EXPIRY_MINUTES, BOOKING_LOCK_TTL_MS, PAYMENT_TX_TYPE, PAYMENT_TX_STATUS, CURRENCY, RAZORPAY_MOCK_KEY, BOOKING_ERROR_CODE, ESCROW_SAFETY_BUFFER_DAYS, PLATFORM_COMMISSION_PERCENT, RAZORPAY_ORDER_STATUS, NORMALIZED_ORDER_STATUS, CASHFREE_ENVIRONMENT, PAYOUT_EVENT } from '../utils/constants'
import { BOOKING_STATUS, BOOKING_MODE, TRIP_REQUEST_STATUS, TRIP_STATUS, TRANSFER_POINT_TYPE, VERIFICATION_STATUS, NOTIFICATION_TYPE, PAYMENT_PROVIDER } from '@shared/constants'
import type { PaymentProviderConst } from '@shared/constants'
import { calculateRefundPercent } from '@shared/utils/refund'
import { calculatePayoutSplit, assertPayoutSafe } from '@shared/utils/payout'
import { env } from '../config/env'
import { withLock } from '../utils/redis-lock'

// Matches a real Razorpay linked account ID: "acc_" + 14+ alphanumeric chars.
// Used to gate SafePay transfers — test/sandbox IDs won't match and transfers are skipped.

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
    private userRepo: UserRepository | null = null,
    private resellerRepo: ResellerRepository | null = null,
    private otpService: OtpService | null = null,
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
   * Resolves how to handle an active booking found during idempotency checks.
   * Called from both the pre-lock fast-path and the under-lock re-check so the
   * decision logic lives in exactly one place.
   *
   * @returns CreateBookingResponse — PENDING_PAYMENT with expiresAt → return to client
   * @returns null                  — PENDING_PAYMENT without expiresAt → caller must expire + retry
   */
  private buildIdempotentResponse(
    existing: NonNullable<Awaited<ReturnType<BookingRepository['findActiveByUserAndTrip']>>>,
  ): CreateBookingResponse | null {
    const existingTx = existing.paymentTransactions[0]
    const provider = (existingTx?.provider as PaymentProviderConst | undefined) ?? PAYMENT_PROVIDER.RAZORPAY
    if (!existing.expiresAt) {
      // No expiresAt — cron can never reap this row. Caller must expire + create fresh order.
      return null
    }
    // Cashfree payment_session_id is not stored in DB — cannot be recovered.
    // Caller must expire the stale booking and create a fresh order with a new session.
    if (provider === PAYMENT_PROVIDER.CASHFREE) {
      return null
    }
    // Only Razorpay reaches here — Cashfree returned null above.
    const gatewayOrderId = existingTx?.gatewayOrderId ?? existingTx?.razorpayOrderId ?? ''
    return {
      bookingId: existing.id,
      bookingRef: existing.bookingRef,
      provider,
      gatewayOrderId,
      razorpayOrderId: gatewayOrderId,
      razorpayKeyId: env.RAZORPAY_KEY_ID || RAZORPAY_MOCK_KEY,
      amountInRupees: existing.totalAmount,
      currency: CURRENCY,
      expiresAt: existing.expiresAt.toISOString(),
    }
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
        hasVerifiedContact: (b.travelerDetails ?? []).some(
          (t: { isPrimary: boolean; phoneVerified: boolean }) => t.isPrimary && t.phoneVerified,
        ),
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
   * Refund rules (see @shared/utils/refund.ts — single source of truth):
   * - FLEXIBLE / MODERATE: MAX_REFUND_PERCENT (50%) if hoursUntilTrip >= REFUND_CLIFF_DAYS*24
   *   (7 days), else 0%
   * - STRICT: 0% always
   *
   * hoursUntilTrip is computed from the trip's startDate FROZEN into this booking's
   * DEPOSIT_RELEASE ledger row (metadata.computedSplit.startDate) when one exists —
   * never the live trip.startDate in that case — so an organizer rescheduling the trip
   * after the deposit was released can't manufacture refund eligibility the platform
   * never reserved money for. Falls back to the live trip.startDate when no
   * DEPOSIT_RELEASE row exists (Razorpay bookings, or Cashfree bookings with no vendor
   * linked) — today's original behaviour, unchanged for those cases.
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

    // CRITICAL fix: use the trip startDate FROZEN at deposit-release time (if a
    // DEPOSIT_RELEASE tx exists for this booking), not the live trip.startDate. An
    // organizer can reschedule a trip (TripService.updateTrip) after a Cashfree deposit
    // has already been released for a booking on it — recomputing against the live
    // (possibly later) startDate could manufacture refund eligibility the platform never
    // reserved money for when it released that deposit. No DEPOSIT_RELEASE row (Razorpay
    // bookings, or Cashfree bookings with no vendor linked) → fall back to the live
    // trip.startDate, unchanged from today's behaviour. Fetched once here and passed down
    // to initiateBookingRefund so the double-refund-guard lookup doesn't re-fetch it.
    const txList = await this.paymentTxRepo.findByBookingId(bookingId)
    const depositReleaseTx = txList.find((tx) => tx.type === PAYMENT_TX_TYPE.DEPOSIT_RELEASE)
    const frozenStartDate = (depositReleaseTx?.metadata as { computedSplit?: { startDate?: string } } | null)?.computedSplit?.startDate
    const refundRelevantStartDate = frozenStartDate ? new Date(frozenStartDate) : booking.trip.startDate

    const hoursUntilTrip = (refundRelevantStartDate.getTime() - Date.now()) / (1000 * 60 * 60)
    const refundPercent = calculateRefundPercent(booking.trip.cancellationPolicy, hoursUntilTrip)
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
        await this.initiateBookingRefund(bookingId, refundAmount, reason, txList)
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
   * Creates a REFUND PaymentTransaction and dispatches a refund to the correct gateway.
   * The refund.processed webhook finalises the transaction status to REFUNDED.
   * Logs errors but does not throw — cancellation is already committed; the INITIATED
   * REFUND record is the retry target for ops/admin.
   *
   * Provider routing uses PaymentService.resolveProviderFromTx — checks the stored
   * provider field first, then infers from order ID format for legacy rows.
   *
   * @param preloadedTxList - Optional — cancelBooking already fetches this list (to look
   *   up the frozen DEPOSIT_RELEASE startDate, see cancelBooking docblock) before deciding
   *   whether to call this method at all, so it's passed through here to avoid a second
   *   identical `findByBookingId` round-trip. Falls back to fetching if not provided (e.g.
   *   a future caller outside cancelBooking).
   */
  private async initiateBookingRefund(
    bookingId: string,
    refundAmount: number,
    reason: string,
    preloadedTxList?: Awaited<ReturnType<PaymentTransactionRepository['findByBookingId']>>,
  ): Promise<void> {
    const txList = preloadedTxList ?? (await this.paymentTxRepo.findByBookingId(bookingId))
    // For Cashfree, refunds are order-scoped — gatewayPaymentId is not required.
    // Accept any captured PAYMENT tx that has either a payment ID (Razorpay) or an order ID (Cashfree).
    const capturedTx = txList.find(
      (tx) => tx.type === PAYMENT_TX_TYPE.PAYMENT && tx.status === PAYMENT_TX_STATUS.CAPTURED
        && (tx.gatewayPaymentId ?? tx.razorpayPaymentId ?? tx.gatewayOrderId ?? tx.razorpayOrderId),
    )

    const capturedPaymentId = capturedTx?.gatewayPaymentId ?? capturedTx?.razorpayPaymentId ?? null

    if (!capturedTx) {
      this.logger.warn({ bookingId }, 'No captured payment tx found — skipping gateway refund')
      return
    }

    // After the guard, capturedTx is guaranteed non-null.
    // Cashfree scopes refunds to orders (not payments) — orderId is required in notes.
    // Razorpay ignores this field, so it's safe to always include it.
    const capturedOrderId = capturedTx.gatewayOrderId ?? capturedTx.razorpayOrderId
    // Delegate provider resolution to PaymentService — single source of truth.
    const capturedProvider = this.paymentService.resolveProviderFromTx(capturedTx)

    // No-clawback refund (see @shared/utils/payout.ts): for Cashfree bookings that had a
    // deposit split attached, force refund_splits vendor amount to 0 so the organizer's
    // already-settled deposit is never debited — the platform's own retained share always
    // covers the refund by construction (deposit <= platformRetained, assertPayoutSafe).
    // Only fetched for Cashfree — Razorpay ignores this field entirely.
    const vendorAccountId = capturedProvider === PAYMENT_PROVIDER.CASHFREE
      ? (await this.bookingRepo.findForBalanceRelease(bookingId))?.trip.organizer?.cashfreeVendorId ?? undefined
      : undefined

    // Double-refund guard: if a REFUND tx already exists and either has a gateway refund ID
    // (already processed) or is REFUNDED, do not issue another API call.
    const existingRefundTx = txList.find((tx) => tx.type === PAYMENT_TX_TYPE.REFUND)
    if (existingRefundTx) {
      const hasRefundId = !!(existingRefundTx.gatewayRefundId ?? existingRefundTx.razorpayRefundId)
      if (existingRefundTx.status === PAYMENT_TX_STATUS.REFUNDED || hasRefundId) {
        this.logger.info({ bookingId, refundTxId: existingRefundTx.id }, 'Refund already processed — skipping duplicate gateway call')
        return
      }

      // INITIATED with no gateway refund ID: a prior attempt failed before the gateway processed it — safe to retry.
      // CRITICAL: always use the amount and reason from the existing DB record, never the caller's params.
      // Caller params might differ (e.g., admin re-triggers with adjusted amount or time changes refund %).
      // Using a different amount here would make the gateway and our DB diverge — the DB stores
      // existingRefundTx.amount, so the gateway must receive that exact value.
      const storedAmount = existingRefundTx.amount
      const storedReason = (existingRefundTx.metadata as { reason?: string } | null)?.reason ?? reason

      if (storedAmount !== refundAmount) {
        this.logger.warn(
          { bookingId, refundTxId: existingRefundTx.id, storedAmount, callerAmount: refundAmount },
          'Retry: caller refundAmount differs from stored REFUND tx amount — using stored amount to keep DB/gateway consistent',
        )
      }

      this.logger.info({ bookingId, refundTxId: existingRefundTx.id, amount: storedAmount }, 'Retrying gateway refund for existing INITIATED tx')
      try {
        await this.paymentTxRepo.recordRetryAttempt(existingRefundTx.id, existingRefundTx.metadata)
      } catch (err) {
        this.logger.warn({ err, bookingId, refundTxId: existingRefundTx.id }, 'Failed to record refund retry attempt in metadata')
      }
      try {
        await this.paymentService.initiateRefund(
          capturedPaymentId ?? '',
          storedAmount * 100,
          { bookingId, reason: storedReason, orderId: capturedOrderId, ...(vendorAccountId ? { vendorAccountId } : {}) },
          capturedProvider,
        )
        this.logger.info({ bookingId, refundTxId: existingRefundTx.id, amount: storedAmount, vendorAccountId }, 'Refund initiated with gateway (retry)')
      } catch (err) {
        this.logger.error({ err, bookingId, refundTxId: existingRefundTx.id }, 'Gateway refund retry failed — REFUND tx remains INITIATED')
      }
      return
    }

    // Create the INITIATED record first — provides audit trail and retry target if the API call fails
    const refundTx = await this.paymentTxRepo.create({
      bookingId,
      type: PAYMENT_TX_TYPE.REFUND,
      amount: refundAmount,
      status: PAYMENT_TX_STATUS.INITIATED,
      provider: capturedProvider,
      metadata: { reason },
    })

    try {
      await this.paymentService.initiateRefund(
        capturedPaymentId ?? '',
        refundAmount * 100,
        // orderId is required by Cashfree (refunds are order-scoped); Razorpay ignores it.
        // vendorAccountId (Cashfree only) forces the zero-amount refund_splits no-clawback path.
        { bookingId, reason, orderId: capturedOrderId, ...(vendorAccountId ? { vendorAccountId } : {}) },
        capturedProvider,
      )
      this.logger.info({ bookingId, refundTxId: refundTx.id, amount: refundAmount, vendorAccountId }, 'Refund initiated with gateway')
    } catch (err) {
      // REFUND tx with INITIATED status remains — ops/admin can retry; gateway async may still process it
      this.logger.error({ err, bookingId, refundTxId: refundTx.id }, 'Gateway refund initiation failed — REFUND tx remains INITIATED for retry')
    }
  }

  // ─── Payment Flow Methods ─────────────────────────────

  /**
   * Creates a booking with Razorpay order (Facade pattern).
   *
   * Flow:
   * 1. Fast-path idempotency — return existing PENDING_PAYMENT order without acquiring lock
   * 2. Redis distributed lock (BOOKING_LOCK_TTL_MS) — serialises concurrent requests per user+trip
   * 3. Under-lock re-check — concurrent arrival that slipped past step 1 returns existing booking
   * 4. Validations — trip status, capacity, deadline, booking mode, transfer points, seat count
   * 5. Calculate price — base + early-bird discount + transfer-point extra charges
   * 6. Build SafePay transfers — only in production with a verified Razorpay linked account
   * 7. Create Razorpay order with order-level transfers
   * 8. Create Booking(PENDING_PAYMENT) + PaymentTransaction(INITIATED)
   * 9. Atomically hold seats (if seatIds provided) — expire booking on hold failure
   *
   * @throws ConflictError(ALREADY_BOOKED)       — CONFIRMED booking already exists
   * @throws ConflictError(BOOKING_IN_PROGRESS)  — Redis lock not acquired (concurrent request)
   * @throws NotFoundError                       — trip doesn't exist
   * @throws ValidationError                     — trip not accepting bookings, capacity exceeded, etc.
   */
  async createBooking(
    userId: string,
    input: {
      tripId: string
      pickupPointId?: string
      dropPointId?: string
      numTravelers: number
      // [TravelerDetail] travelers: Array<{ name: string; phone: string; age: number; gender: 'MALE' | 'FEMALE' | 'OTHER'; isPrimary: boolean }>
      travelers?: Array<{ name: string; phone?: string; age?: number; gender?: 'MALE' | 'FEMALE' | 'OTHER'; isPrimary: boolean }>
      seatIds?: string[]
      // Reseller feature — opaque token only, never a price. See markup resolution below.
      sublinkToken?: string
    },
  ): Promise<CreateBookingResponse> {
    const timer = startTimer()
    const paymentSvc = this.requirePaymentService()

    // 1. Fast-path idempotency check (no lock needed — read-only, skips lock overhead)
    //    Only applies to PENDING_PAYMENT bookings — a CONFIRMED booking means the user
    //    bought one slot; they are allowed to create additional bookings for friends.
    const earlyExisting = await this.bookingRepo.findActiveByUserAndTrip(userId, input.tripId)
    if (earlyExisting && earlyExisting.bookingStatus === BOOKING_STATUS.PENDING_PAYMENT) {
      const idempotent = this.buildIdempotentResponse(earlyExisting)
      if (idempotent) return idempotent
      // null → no expiresAt (cron-unreapable) or Cashfree (session not stored). Expire + retry.
      this.logger.warn(
        { bookingId: earlyExisting.id, provider: earlyExisting.paymentTransactions[0]?.provider ?? 'unknown' },
        'Expiring stale PENDING_PAYMENT booking to issue a fresh payment order',
      )
      await this.bookingRepo.updateStatus(earlyExisting.id, BOOKING_STATUS.EXPIRED)
      if (this.vehicleService) {
        this.vehicleService.releaseSeats(earlyExisting.id)
          .catch((err: unknown) => this.logger.error({ err, bookingId: earlyExisting.id }, 'Failed to release seats on idempotency expiry'))
      }
    }

    // 2. Distributed lock — serialises concurrent booking-creation for the same user+trip.
    //    Eliminates the TOCTOU gap between findActiveByUserAndTrip and bookingRepo.create:
    //    two simultaneous form-submits both pass the fast-path check above (both see null),
    //    but only one wins the lock and creates the booking; the second re-checks under the
    //    lock and returns the booking the first one just created.
    //    When Redis is unavailable (dev/CI) withLock degrades to a no-op and the DB partial
    //    unique index on Booking(userId, tripId) is the hard backstop.
    const lockKey = `booking:create:${userId}:${input.tripId}`
    let bookingResponse: CreateBookingResponse | null = null

    // Fetch user outside the lock — read-only, no need to hold the lock for this.
    const bookingUser = this.userRepo ? await this.userRepo.findById(userId) : null
    if (!this.userRepo) {
      this.logger.warn({ userId }, 'userRepo not injected — Cashfree customer details will use fallback values')
    }

    const lockAcquired = await withLock(lockKey, BOOKING_LOCK_TTL_MS, async () => {
      // Re-check under lock — catches concurrent arrivals that both passed the fast-path.
      // Same guard: only PENDING_PAYMENT gets idempotency treatment; CONFIRMED is allowed
      // to co-exist with a new booking (user booking for friends).
      const existing = await this.bookingRepo.findActiveByUserAndTrip(userId, input.tripId)
      if (existing && existing.bookingStatus === BOOKING_STATUS.PENDING_PAYMENT) {
        const idempotent = this.buildIdempotentResponse(existing)
        if (idempotent) { bookingResponse = idempotent; return }
        // null → no expiresAt (cron-unreapable) or Cashfree (session not stored). Expire + retry.
        this.logger.warn(
          { bookingId: existing.id, provider: existing.paymentTransactions[0]?.provider ?? 'unknown' },
          'Expiring stale PENDING_PAYMENT booking to issue a fresh payment order',
        )
        await this.bookingRepo.updateStatus(existing.id, BOOKING_STATUS.EXPIRED)
        if (this.vehicleService) {
          this.vehicleService.releaseSeats(existing.id)
            .catch((err: unknown) => this.logger.error({ err, bookingId: existing.id }, 'Failed to release seats on idempotency expiry'))
        }
      }

      // 3. Validations
      if (!env.RAZORPAY_KEY_ID && env.NODE_ENV === 'production') {
        throw new ValidationError('Payment configuration is missing — contact support')
      }

      const trip = await this.tripRepo.findByIdForBooking(input.tripId)
      if (!trip) throw new NotFoundError('Trip')
      if (trip.isHidden) {
        throw new ValidationError('This trip is not available for booking')
      }
      if (trip.status !== TRIP_STATUS.ACTIVE) {
        throw new ValidationError('This trip is not accepting bookings')
      }
      if (!trip.acceptingBookings) {
        throw new ValidationError(
          trip.bookingsPausedReason
            ? `Bookings are closed: ${trip.bookingsPausedReason}`
            : 'Bookings are currently closed for this trip',
        )
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
      // Vendor gate: for Cashfree, organizer must have a cashfreeVendorId (split required).
      // Razorpay Route is disabled — no vendor account needed for Razorpay bookings.
      const gatewayProvider = env.PAYMENT_GATEWAY
      if (gatewayProvider === PAYMENT_PROVIDER.CASHFREE && !trip.organizer?.cashfreeVendorId) {
        throw new ValidationError('Organizer has not set up payment — booking unavailable')
      }
      // travelers is optional (collected later in some flows), but when provided
      // it must match numTravelers — a mismatched list would assign seats/details
      // to the wrong number of people.
      if (input.travelers?.length && input.travelers.length !== input.numTravelers) {
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

      // 4. Validate transfer points (if provided)
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

      // 5. Resolve reseller markup (opaque token, never a client-sent price):
      //    (a) explicit sublinkToken in body → active sublink whose tripId matches; else
      //    (b) a prior SublinkAttribution for this user+trip (survives across devices); else
      //    (c) no markup — byte-identical to the pre-reseller pricing path.
      let sublink: { id: string; markupAmount: number; tripId: string } | null = null
      if (input.sublinkToken && this.resellerRepo) {
        const resolved = await this.resellerRepo.findActiveByToken(input.sublinkToken, 'sublink')
        if (resolved && resolved.tripId === input.tripId) {
          sublink = resolved
        }
        // Mismatched/invalid token is ignored (not thrown) — the booking still proceeds
        // at base price rather than failing a real purchase over a bad ref link.
      }
      if (!sublink && this.resellerRepo) {
        const attribution = await this.resellerRepo.findAttributionByUserAndTrip(userId, input.tripId)
        if (attribution?.sublink && attribution.sublink.isActive && !attribution.sublink.isDeleted) {
          sublink = attribution.sublink
        }
      }
      const markupPerPerson = sublink?.markupAmount ?? 0

      // 6. Calculate price (base + transfer point extra charges; markup on top)
      const isEarlyBird = trip.earlyBirdPrice && trip.earlyBirdDeadline && new Date(trip.earlyBirdDeadline) > new Date()
      const pricePerPerson = isEarlyBird ? trip.earlyBirdPrice! : trip.pricePerPerson
      const baseTotal = (pricePerPerson + pickupExtraCharge + dropExtraCharge) * input.numTravelers
      const markupTotal = markupPerPerson * input.numTravelers
      const totalAmount = baseTotal + markupTotal
      const amountInPaise = totalAmount * 100

      // Pre-check seat availability (optimistic — atomic hold happens after booking creation)
      if (input.seatIds?.length && this.vehicleService) {
        const availableSeats = await this.vehicleService.checkSeatsAvailable(input.seatIds)
        if (!availableSeats) {
          throw new ConflictError('One or more selected seats are no longer available', BOOKING_ERROR_CODE.SEAT_CONFLICT)
        }
      }

      // 7. Create payment order. Cashfree Easy Split wires vendor payout at order creation.
      // Razorpay Route is not enabled — full payment collected into platform account.
      // Commission split is computed on BASE ONLY — the reseller markup is track-only
      // (no payout counterpart), so folding it into the split would over-pay the organizer.
      // When markup=0 this is byte-identical to the pre-reseller calculation.
      const baseAmountInPaise = baseTotal * 100
      const commissionRate = Number(trip.organizer?.commissionRate ?? PLATFORM_COMMISSION_PERCENT)
      const holdUntilEpochSec = Math.floor(
        new Date(trip.endDate).getTime() / 1000 + ESCROW_SAFETY_BUFFER_DAYS * 24 * 60 * 60,
      )
      // Cashfree Easy Split only works with KYC-verified vendors (production only), OR in
      // sandbox when CASHFREE_ENABLE_SANDBOX_SPLIT is set (see cashfree.gateway.ts
      // createPayoutAccount — that flag does NOT force real bank verification, it only
      // relaxes this attachment gate so the deposit/balance flow is testable end-to-end).
      const cashfreeVendorId =
        gatewayProvider === PAYMENT_PROVIDER.CASHFREE
        && (env.CASHFREE_ENV === CASHFREE_ENVIRONMENT.PRODUCTION || env.CASHFREE_ENABLE_SANDBOX_SPLIT)
          ? (trip.organizer?.cashfreeVendorId ?? null)
          : null

      // Deposit/balance payout split (see @shared/utils/payout.ts): only ever release the
      // organizer's non-refundable deposit at booking time; hold the balance until the
      // refund cliff passes (balance-release cron). hoursUntilTrip uses the trip's real
      // startDate — this decides whether the refund window is already closed at booking
      // time (last-minute booking edge case), and it is FROZEN into the DEPOSIT_RELEASE
      // ledger row's metadata so the balance-release cron never has to (and must never)
      // recompute it later against "now", which would always show the window as closed.
      let vendorAmountPaise = 0
      let vendorBalancePaise = 0
      let payoutSplit: ReturnType<typeof calculatePayoutSplit> | null = null
      const hoursUntilTrip = (new Date(trip.startDate).getTime() - Date.now()) / (1000 * 60 * 60)
      if (cashfreeVendorId) {
        payoutSplit = calculatePayoutSplit({
          baseAmount: baseAmountInPaise, commissionRate, hoursUntilTrip,
          cancellationPolicy: trip.cancellationPolicy,
        })
        const platformRetained = baseAmountInPaise - payoutSplit.deposit
        try {
          assertPayoutSafe(payoutSplit.deposit, platformRetained, payoutSplit.refundWindowClosed)
        } catch (err) {
          this.logger.error(
            {
              tripId: input.tripId, userId, deposit: payoutSplit.deposit, platformRetained,
              baseAmountInPaise, commissionRate, hoursUntilTrip, event: PAYOUT_EVENT.INVARIANT_VIOLATED,
            },
            'Payout safety invariant violated — refusing to attach deposit split',
          )
          Sentry.captureException(err, { extra: { tripId: input.tripId, userId, deposit: payoutSplit.deposit, platformRetained } })
          throw new PaymentError('Payout safety invariant violated', err)
        }
        vendorAmountPaise = payoutSplit.deposit
        vendorBalancePaise = payoutSplit.balance
        this.logger.info(
          {
            tripId: input.tripId, userId, baseAmountPaise: baseAmountInPaise, baseAmountRupees: baseAmountInPaise / 100,
            commissionRate, hoursUntilTrip,
            entitlementPaise: payoutSplit.entitlement, entitlementRupees: payoutSplit.entitlement / 100,
            depositPaise: payoutSplit.deposit, depositRupees: payoutSplit.deposit / 100,
            balancePaise: payoutSplit.balance, balanceRupees: payoutSplit.balance / 100,
            platformRetainedPaise: platformRetained, platformRetainedRupees: platformRetained / 100,
            event: PAYOUT_EVENT.DEPOSIT_ATTACHED,
          },
          'Deposit split computed and about to be attached to Cashfree order',
        )
      }

      const order = await paymentSvc.createOrder({
        amountPaise: amountInPaise,
        receipt: `booking-${Date.now()}`,
        notes: { tripTitle: trip.title, tripId: input.tripId, userId },
        split: cashfreeVendorId
          ? { vendorAccountId: cashfreeVendorId, vendorAmountPaise, vendorBalancePaise, holdUntilEpochSec, notes: { tripId: input.tripId } }
          : null,
        customer: {
          id: userId,
          name: input.travelers?.[0]?.name ?? bookingUser?.name ?? undefined,
          email: bookingUser?.email ?? undefined,
          phone: input.travelers?.[0]?.phone ?? bookingUser?.phone ?? undefined,
        },
        // Cashfree needs a return_url so the SDK knows where to redirect after payment.
        // {order_id} is a Cashfree-substituted placeholder — it becomes the actual order ID.
        ...(gatewayProvider === PAYMENT_PROVIDER.CASHFREE ? {
          returnUrl: `${env.CLIENT_URL}/payment-complete?order_id={order_id}`,
        } : {}),
      })

      // Deposit/balance payout split (see @shared/utils/payout.ts): the DEPOSIT_RELEASE
      // ledger row's metadata.computedSplit.startDate freezes the trip's startDate AT
      // deposit-release time. This is the CRITICAL fix: if the organizer later reschedules
      // the trip (TripService.updateTrip changes trip.startDate), cancelBooking must keep
      // computing the refund window against the ORIGINAL startDate this deposit was
      // computed against, never the live (possibly rescheduled) one — otherwise a
      // reschedule-after-release could manufacture refund eligibility the platform never
      // reserved money for. See BookingService.cancelBooking's frozen-startDate lookup.
      const depositRelease = cashfreeVendorId && payoutSplit
        ? {
            vendorId: cashfreeVendorId,
            orderId: order.orderId,
            amountRupees: Math.round(payoutSplit.deposit / 100),
            metadata: {
              event: PAYOUT_EVENT.DEPOSIT_SETTLED,
              idempotencyKey: `DEPOSIT_${order.orderId}`,
              computedSplit: {
                entitlement: payoutSplit.entitlement,
                deposit: payoutSplit.deposit,
                balance: payoutSplit.balance,
                baseAmount: baseAmountInPaise,
                commissionRate,
                hoursUntilTrip,
                startDate: new Date(trip.startDate).toISOString(),
              },
            },
          }
        : undefined

      // 8. Create Booking + PaymentTransaction (+ DEPOSIT_RELEASE, when applicable)
      // atomically — prevents the crash window where booking exists but has no
      // PaymentTransaction (making webhook lookup fail), and the HIGH#2 fix: prevents
      // the window where a booking exists but its DEPOSIT_RELEASE ledger row doesn't
      // (a stranded balance with no recovery path, since the balance-release cron and
      // cancelBooking's frozen-startDate lookup both depend on this row existing).
      const expiresAt = new Date(Date.now() + BOOKING_EXPIRY_MINUTES * 60 * 1000)
      let booking: Awaited<ReturnType<BookingRepository['createWithPaymentTx']>>
      try {
        booking = await this.bookingRepo.createWithPaymentTx(
          {
            tripId: input.tripId,
            userId,
            numTravelers: input.numTravelers,
            totalAmount,
            expiresAt,
            pickupPointId: input.pickupPointId,
            dropPointId: input.dropPointId,
            // [TravelerDetail] travelers: input.travelers,
            sublinkId: sublink?.id,
            markupAmount: markupTotal,
          },
          // Service owns these business decisions — type=PAYMENT, status=INITIATED
          {
            provider: order.clientPayload.provider,
            gatewayOrderId: order.orderId,
            razorpayOrderId: order.orderId, // mirror during expand phase
            amount: totalAmount,
            type: PAYMENT_TX_TYPE.PAYMENT,
            status: PAYMENT_TX_STATUS.INITIATED,
          },
          // Explicit sublinkToken resolved to a real sublink → record/refresh the
          // last-wins attribution in the SAME transaction as the booking create.
          sublink && input.sublinkToken
            ? { userId, sublinkId: sublink.id, tripId: input.tripId }
            : undefined,
          depositRelease,
        )
      } catch (err) {
        // The partial unique index on Booking(userId, tripId) is the hard backstop for the
        // TOCTOU gap between the fast-path/lock checks above and this insert (e.g. two
        // concurrent requests from the same user both slipping past the Redis lock when
        // Redis is unavailable). Translate the resulting P2002 into the documented
        // ConflictError instead of letting a raw PrismaClientKnownRequestError reach the
        // client as an unhandled 500.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          // The gateway order created above (step 6) is now orphaned — no Booking/PaymentTransaction
          // row exists for it. Razorpay orders have no cancel/void endpoint (they only support
          // deferred *capture*, not order cancellation) and expire naturally when unpaid; Cashfree
          // exposes no cancel capability in IPaymentGateway either, so there is nothing to actively
          // cancel here. This order also isn't picked up by the expireStaleBookings or
          // sweepOrphanedConfirmedBookings crons (cron-jobs.ts) — both sweep rows on the Booking
          // table, and no Booking row was ever created for this order. Log for ops/Sentry
          // visibility so a dangling gateway-side order doesn't silently confuse reconciliation.
          this.logger.warn(
            { orderId: order.orderId, provider: order.clientPayload.provider, tripId: input.tripId, userId },
            'Gateway order orphaned by concurrent duplicate-booking conflict (P2002) — no DB row created; order will expire naturally at the gateway',
          )
          throw new ConflictError('You already have an active booking for this trip', BOOKING_ERROR_CODE.ALREADY_BOOKED)
        }
        throw err
      }

      // 8b. Observability parity only — the DEPOSIT_RELEASE ledger row itself was already
      // written atomically inside createWithPaymentTx above (see `depositRelease` built
      // before step 8). This is purely a structured log for ops/reconciliation visibility;
      // it cannot fail the booking and never needs a .catch() (no I/O against a store that
      // can reject).
      if (depositRelease && payoutSplit) {
        this.logger.info(
          {
            bookingId: booking.id, bookingRef: booking.bookingRef, orderId: order.orderId,
            vendorId: depositRelease.vendorId, provider: PAYMENT_PROVIDER.CASHFREE,
            entitlementPaise: payoutSplit.entitlement, entitlementRupees: payoutSplit.entitlement / 100,
            depositPaise: payoutSplit.deposit, depositRupees: payoutSplit.deposit / 100,
            balancePaise: payoutSplit.balance, balanceRupees: payoutSplit.balance / 100,
            baseAmountPaise: baseAmountInPaise, commissionRate, hoursUntilTrip,
            event: PAYOUT_EVENT.DEPOSIT_SETTLED,
          },
          'Deposit release recorded atomically with booking creation',
        )
      }

      // 9. Atomically hold seats (if hold fails, expire booking to prevent orphaned state)
      if (input.seatIds?.length && this.vehicleService) {
        try {
          await this.vehicleService.holdSeats(input.seatIds, userId, booking.id)
        } catch (seatErr) {
          // Expire the booking — Razorpay order expires naturally
          await this.bookingRepo.updateStatus(booking.id, BOOKING_STATUS.EXPIRED)
            .catch((cancelErr: unknown) => this.logger.error({ cancelErr, bookingId: booking.id }, 'Failed to expire booking after seat hold failure'))
          throw seatErr
        }
      }

      this.logger.info(
        { bookingId: booking.id, orderId: order.orderId, provider: order.clientPayload.provider, amount: totalAmount, seatCount: input.seatIds?.length ?? 0, durationMs: timer.elapsed() },
        'Booking created with payment order',
      )

      const clientPayload = order.clientPayload
      bookingResponse = {
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        provider: clientPayload.provider,
        gatewayOrderId: order.orderId,
        // Razorpay-specific fields (present when provider='razorpay')
        ...(clientPayload.provider === PAYMENT_PROVIDER.RAZORPAY ? {
          razorpayOrderId: order.orderId,
          razorpayKeyId: clientPayload.razorpayKeyId,
        } : {}),
        // Cashfree-specific fields (present when provider='cashfree')
        ...(clientPayload.provider === PAYMENT_PROVIDER.CASHFREE ? {
          paymentSessionId: clientPayload.paymentSessionId,
        } : {}),
        amountInRupees: totalAmount,
        currency: CURRENCY,
        expiresAt: expiresAt.toISOString(),
      }
    })

    if (!lockAcquired) {
      throw new ConflictError(
        'A booking request for this trip is already in progress — please wait a moment and try again',
        BOOKING_ERROR_CODE.BOOKING_IN_PROGRESS,
      )
    }

    // Invariant: lockAcquired=true means withLock called fn to completion without throwing.
    // fn always sets bookingResponse before returning. If this assertion ever fires, a change
    // to withLock broke the contract — fix withLock, not this assertion.
    if (!bookingResponse) {
      throw new Error('Invariant violation: lock acquired but bookingResponse was not set — this is a bug in withLock or createBooking')
    }

    return bookingResponse
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
  ): Promise<VerifyPaymentResponse> {
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
        bookingRef: booking.bookingRef,
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
          bookingRef: fresh.bookingRef,
        }
      }
      throw new ConflictError('Booking confirmation is already in progress', BOOKING_ERROR_CODE.CONFIRM_RACE)
    }

    // We won the gate — proceed with seat increment then capture
    const rowsUpdated = await this.tripRepo.atomicIncrementBookings(booking.trip.id, booking.numTravelers)
    if (rowsUpdated === 0) {
      // Trip is at capacity — revert the gate so the customer can be refunded or retry later
      await this.bookingRepo.revertConfirmGate(bookingId)
        .catch((err) => this.logger.error({ err, bookingId }, 'Failed to revert confirmation gate after capacity check'))
      throw new ConflictError('Not enough seats available — trip may be full', BOOKING_ERROR_CODE.CAPACITY_FULL)
    }

    // Guard: gatewayPaymentId must be set before we can capture.
    // If the booking was confirmed via webhook before payment.authorized fired (e.g. out-of-order
    // delivery of order.paid), the paymentId is not yet in the DB. Revert the gate so the
    // payment.authorized webhook can complete the confirmation when it arrives.
    const txPaymentId = paymentTx.gatewayPaymentId ?? paymentTx.razorpayPaymentId
    const txProvider = (paymentTx.provider as PaymentProviderConst | undefined) ?? PAYMENT_PROVIDER.RAZORPAY
    if (!txPaymentId) {
      const [decrResult, gateResult] = await Promise.allSettled([
        this.tripRepo.atomicDecrementBookings(booking.trip.id, booking.numTravelers),
        this.bookingRepo.revertConfirmGate(bookingId),
      ])
      if (decrResult.status === 'rejected')
        this.logger.error({ err: decrResult.reason, bookingId }, 'Failed to decrement seats during null-paymentId rollback — seat count may be inconsistent')
      if (gateResult.status === 'rejected')
        this.logger.error({ err: gateResult.reason, bookingId }, 'Failed to revert confirmation gate during null-paymentId rollback — booking stuck in CONFIRMED')
      throw new ValidationError('Payment has not been authorized yet — confirmation will be retried by webhook')
    }

    // Capture payment (exact amount from DB — prevents amount tampering)
    // Cashfree: auto-captured, capturePayment is a no-op status fetch
    try {
      await this.paymentService.capturePayment(txPaymentId, paymentTx.amount * 100, CURRENCY, txProvider)
    } catch (error) {
      // Rollback seats and revert the gate so webhook retries can re-attempt
      this.logger.error({ bookingId, error }, 'Payment capture failed — rolling back seat increment and confirmation gate')
      const [decrResult, gateResult] = await Promise.allSettled([
        this.tripRepo.atomicDecrementBookings(booking.trip.id, booking.numTravelers),
        this.bookingRepo.revertConfirmGate(bookingId),
      ])
      if (decrResult.status === 'rejected')
        this.logger.error({ err: decrResult.reason, bookingId }, 'Failed to decrement seats during capture-failure rollback — seat count may be inconsistent')
      if (gateResult.status === 'rejected')
        this.logger.error({ err: gateResult.reason, bookingId }, 'Failed to revert confirmation gate during capture-failure rollback — booking stuck in CONFIRMED')
      throw error
    }

    // Persist CAPTURED status immediately after a successful Razorpay capture so that
    // sweepOrphanedConfirmedBookings never reverts this booking to PENDING_PAYMENT and
    // triggers a duplicate confirmation email. Non-fatal: if the DB write fails, the
    // incoming payment.captured webhook is the safety net and will update it shortly.
    try {
      await this.paymentTxRepo.updateStatus(paymentTx.id, PAYMENT_TX_STATUS.CAPTURED)
    } catch (dbErr) {
      this.logger.warn({ dbErr, bookingId }, 'Could not persist CAPTURED status after capture — payment.captured webhook is safety net')
    }

    // Confirm held seats → BOOKED and auto-assign travelers
    if (this.vehicleService) {
      try {
        const heldSeats = await this.vehicleService.getBookingSeats(booking.id)
        if (heldSeats.length > 0) {
          // Flip HELD → BOOKED. Traveler assignments are best-effort (only populated
          // when travelerDetails are persisted); confirmSeats itself only needs
          // bookingId+userId to do the status transition.
          const travelers: Array<{ id: string }> = booking.travelerDetails ?? []
          const assignments: Array<{ seatId: string; travelerDetailId: string }> = heldSeats
            .flatMap((seat: { id: string }, i: number) =>
              travelers[i]?.id ? [{ seatId: seat.id, travelerDetailId: travelers[i].id }] : []
            )

          await this.vehicleService.confirmSeats(booking.id, booking.userId, assignments)
        }
      } catch (seatErr) {
        // Seat assignment is non-critical — booking and payment are already committed
        this.logger.error({ bookingId, seatErr }, 'Seat confirmation failed — booking still confirmed')
      }
    }

    // Mark trip request as CONVERTED if this booking originated from a REQUEST_BASED flow.
    // We look up by userId+tripId rather than booking.tripRequest because the back-relation
    // is populated via the bookingId FK on TripRequest — which markConverted itself sets,
    // making booking.tripRequest always null at this point (chicken-and-egg).
    const approvedRequest = await this.tripRequestRepo.findApprovedForUser(booking.trip.id, booking.userId)
    if (approvedRequest) {
      await this.tripRequestRepo.markConverted(approvedRequest.id, bookingId)
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
      data: { bookingId: booking.id, tripId: booking.trip.id, tripSlug: booking.trip.slug, tripName: booking.trip.title, tripImage: booking.trip.photos?.[0] ?? null },
    }).catch((err) => this.logger.error({ err, bookingId }, 'Failed to send booking confirmation notification'))

    await this.invalidateTripCaches(booking.trip.slug)

    return {
      bookingId: booking.id,
      bookingStatus: BOOKING_STATUS.CONFIRMED,
      paymentStatus: PAYMENT_TX_STATUS.CAPTURED,
      bookingRef: booking.bookingRef,
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
        bookingRef: booking.bookingRef,
      }
    }

    // Verify payment callback — Razorpay: HMAC signature; Cashfree: server-side status check
    const paymentTx = booking.paymentTransactions[0]
    const txProvider = (paymentTx?.provider as PaymentProviderConst | undefined) ?? PAYMENT_PROVIDER.RAZORPAY
    // Normalize DTO to provider-neutral shape (handle legacy razorpay* fields)
    const orderId = dto.orderId ?? dto.razorpayOrderId ?? ''
    const paymentId = dto.paymentId ?? dto.razorpayPaymentId
    const signature = dto.signature ?? dto.razorpaySignature

    const isValid = await this.paymentService.verifyClientCallback({
      orderId,
      paymentId,
      signature,
      provider: (dto.provider ?? txProvider),
    })
    if (!isValid) {
      throw new AuthError('Payment verification failed — invalid signature or payment not confirmed')
    }

    // Persist gatewayPaymentId so confirmBooking() can capture it
    if (paymentTx) {
      // Guard against payment replay: the client-supplied orderId must match the one
      // stored for this booking. Without this check, a valid signature from
      // booking A could be reused to confirm booking B that has the same amount.
      const storedOrderId = paymentTx.gatewayOrderId ?? paymentTx.razorpayOrderId
      if (storedOrderId && storedOrderId !== orderId) {
        throw new AuthError('Payment order ID does not match this booking — possible replay attack')
      }

      // Cashfree does not include cf_payment_id in the redirect URL — fetch it from
      // the gateway API so confirmBooking() has a paymentId to work with.
      let resolvedPaymentId = paymentId
      if (!resolvedPaymentId && txProvider === PAYMENT_PROVIDER.CASHFREE) {
        resolvedPaymentId = (await this.paymentService.fetchPaymentIdForOrder(orderId, PAYMENT_PROVIDER.CASHFREE)) ?? undefined
        this.logger.debug({ bookingId, orderId, resolvedPaymentId }, 'Cashfree: fetched paymentId for order')
      }

      if (resolvedPaymentId) {
        await this.paymentTxRepo.updatePaymentId(paymentTx.id, resolvedPaymentId)
        // Update in-memory so confirmBooking() can read the payment ID without re-fetching
        ;(paymentTx as Record<string, unknown>).gatewayPaymentId = resolvedPaymentId
        ;(paymentTx as Record<string, unknown>).razorpayPaymentId = resolvedPaymentId
      }
    }

    // Confirm booking (capture + seats) — pass pre-loaded booking to avoid re-fetching
    return this.confirmBooking(bookingId, booking)
  }

  async syncPaymentStatus(
    bookingId: string,
    userId: string,
  ): Promise<VerifyPaymentResponse> {
    const booking = await this.bookingRepo.findWithPaymentDetails(bookingId)
    if (!booking) throw new NotFoundError('Booking')
    if (booking.userId !== userId) throw new ForbiddenError('You can only sync your own bookings')

    // Already confirmed — nothing to do
    if (booking.bookingStatus === BOOKING_STATUS.CONFIRMED) {
      return {
        bookingId: booking.id,
        bookingStatus: BOOKING_STATUS.CONFIRMED,
        paymentStatus: booking.paymentTransactions[0]?.status || PAYMENT_TX_STATUS.CAPTURED,
        bookingRef: booking.bookingRef,
      }
    }

    const paymentTx = booking.paymentTransactions[0]
    const txOrderId = paymentTx?.gatewayOrderId ?? paymentTx?.razorpayOrderId
    const txProvider = (paymentTx?.provider as PaymentProviderConst | undefined) ?? PAYMENT_PROVIDER.RAZORPAY
    if (!txOrderId) {
      throw new ValidationError('No payment order found for this booking')
    }

    const orderStatus = await this.paymentService.checkOrderStatus(txOrderId, txProvider)

    // 'paid'     → Razorpay captured / Cashfree paid — proceed
    // 'attempted' → Razorpay authorized but not yet captured (deferred-capture mode; webhook missed).
    //               recoverPaidBooking will fetch the cf_payment_id / razorpay payment ID and
    //               call capturePayment, which performs the actual capture for Razorpay.
    const isRecoverable = orderStatus === NORMALIZED_ORDER_STATUS.PAID ||
      (orderStatus === RAZORPAY_ORDER_STATUS.ATTEMPTED && txProvider === PAYMENT_PROVIDER.RAZORPAY)

    if (!isRecoverable) {
      throw new ValidationError(`Payment not completed yet — order status is "${orderStatus}". Please complete payment or try again.`)
    }

    await this.recoverPaidBooking(bookingId, booking)

    return {
      bookingId: booking.id,
      bookingStatus: BOOKING_STATUS.CONFIRMED,
      paymentStatus: PAYMENT_TX_STATUS.CAPTURED,
      bookingRef: booking.bookingRef,
    }
  }

  // Confirms a paid booking whose confirmation was missed (webhook not delivered, FE verify-payment failed, etc.).
  // Accepts a preloaded booking to avoid a redundant DB fetch when called from syncPaymentStatus.
  async recoverPaidBooking(
    bookingId: string,
    preloaded?: Awaited<ReturnType<BookingRepository['findWithPaymentDetails']>>,
  ): Promise<void> {
    const booking = preloaded ?? await this.bookingRepo.findWithPaymentDetails(bookingId)
    if (!booking) return

    const paymentTx = booking.paymentTransactions[0]
    if (!paymentTx) return

    const recoveryPaymentId = paymentTx.gatewayPaymentId ?? paymentTx.razorpayPaymentId
    const recoveryOrderId = paymentTx.gatewayOrderId ?? paymentTx.razorpayOrderId
    const recoveryProvider = (paymentTx.provider as PaymentProviderConst | undefined) ?? PAYMENT_PROVIDER.RAZORPAY
    if (!recoveryPaymentId && recoveryOrderId) {
      const paymentId = await this.paymentService.fetchPaymentIdForOrder(recoveryOrderId, recoveryProvider)
      if (paymentId) {
        await this.paymentTxRepo.updatePaymentId(paymentTx.id, paymentId)
        ;(paymentTx as Record<string, unknown>).gatewayPaymentId = paymentId
        ;(paymentTx as Record<string, unknown>).razorpayPaymentId = paymentId
        this.logger.info({ bookingId, paymentId }, 'Stored missing gatewayPaymentId during recovery')
      } else {
        // Gateway API couldn't return the payment ID yet — don't call confirmBooking with a null
        // paymentId or it will roll back the atomic gate and leave the booking in a confused state.
        this.logger.error({ bookingId }, 'Could not resolve gatewayPaymentId from provider — recovery aborted')
        throw new ValidationError('Payment ID not found on gateway yet — please try again in a moment')
      }
    }

    await this.confirmBooking(bookingId, { ...booking, paymentTransactions: [paymentTx] })
    this.logger.info({ bookingId }, 'Booking recovered and confirmed')
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

    // Reseller feature (display-only): if this user has an active-sublink attribution
    // for the trip, mirror the base+markup price here so the figure they see matches
    // what createBooking will actually charge once they pay. The authoritative charge
    // still happens in createBooking — this never affects any stored amount.
    const markupByTripId = this.resellerRepo
      ? await this.resellerRepo.findAttributionsForTrips(userId, requests.map((r: PendingRequest) => r.tripId))
      : new Map<string, number>()

    return requests.map((r: PendingRequest) => {
      const basePricePerPerson = (r.trip.earlyBirdPrice && r.trip.earlyBirdDeadline && new Date(r.trip.earlyBirdDeadline) > new Date())
        ? r.trip.earlyBirdPrice
        : r.trip.pricePerPerson
      const markupPerPerson = markupByTripId.get(r.tripId) ?? 0

      return {
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
          pricePerPerson: basePricePerPerson + markupPerPerson,
          destination: r.trip.destination,
          organizer: {
            id: r.trip.organizer.id,
            businessName: r.trip.organizer.businessName,
            verified: r.trip.organizer.verificationStatus === VERIFICATION_STATUS.APPROVED,
          },
        },
      }
    })
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

  // ─── Post-Payment Booking Contact Verification ────────
  // Booking-scoped contact verification, collected right after payment succeeds.
  // Deliberately never writes to User.phone/User.phoneVerified — the contact may
  // belong to someone other than the account owner (e.g. booking for a friend).

  /** Guards against calling booking-contact methods when OtpService is not wired */
  private requireOtpService(): OtpService {
    if (!this.otpService) {
      throw new ValidationError('Booking contact verification is not configured')
    }
    return this.otpService
  }

  /**
   * Ownership + status guard shared by the booking-contact methods below.
   * @throws NotFoundError — booking doesn't exist
   * @throws ForbiddenError — user doesn't own the booking
   * @throws ValidationError — booking is not CONFIRMED (contact is only collected post-payment)
   */
  private async guardBookingContactAccess(userId: string, bookingId: string) {
    const booking = await this.bookingRepo.findById(bookingId)
    if (!booking) throw new NotFoundError('Booking')
    if (booking.userId !== userId) throw new ForbiddenError('You can only manage contact details for your own bookings')
    if (booking.bookingStatus !== BOOKING_STATUS.CONFIRMED) {
      throw new ValidationError(`Cannot set a booking contact for a booking with status ${booking.bookingStatus}`)
    }
    return booking
  }

  /**
   * Sends an OTP to verify a contact number for a CONFIRMED booking.
   * No User-table write — see class-level note above.
   */
  async sendBookingContactOtp(userId: string, bookingId: string, phone: string) {
    await this.guardBookingContactAccess(userId, bookingId)
    return this.requireOtpService().sendBookingContactOtp(phone)
  }

  /**
   * Verifies the OTP and persists the verified contact onto the booking's primary
   * TravelerDetail. No User-table write — see class-level note above.
   */
  async verifyBookingContactOtp(
    userId: string,
    bookingId: string,
    data: { name: string; phone: string; otp: string },
  ) {
    await this.guardBookingContactAccess(userId, bookingId)
    await this.requireOtpService().verifyBookingContactOtp(data.phone, data.otp)
    return this.bookingRepo.upsertPrimaryContact(bookingId, {
      name: data.name,
      phone: data.phone,
      phoneVerified: true,
    })
  }

  /**
   * One-tap shortcut: reuses the account's own verified phone as this booking's
   * contact — no OTP needed. Only READS from User; never writes to it.
   * @throws ValidationError — account has no verified phone to reuse
   */
  async useAccountPhoneForBooking(userId: string, bookingId: string) {
    await this.guardBookingContactAccess(userId, bookingId)
    if (!this.userRepo) {
      throw new ValidationError('Booking contact verification is not configured')
    }
    const user = await this.userRepo.findById(userId)
    if (!user || !user.phone || !user.phoneVerified) {
      throw new ValidationError('No verified account phone available')
    }
    return this.bookingRepo.upsertPrimaryContact(bookingId, {
      name: user.name,
      phone: user.phone,
      phoneVerified: true,
    })
  }

}
