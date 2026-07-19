/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { logger } from '../../../src/utils/logger'

// Auto-cashback is env-gated (WALLET_AUTO_CASHBACK_PERCENT/CAP default to 0 in test
// env, which would make the cashback path a permanent no-op). Enable it for this
// suite only, keeping every other constant real.
vi.mock('../../../src/utils/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/constants')>()
  return { ...actual, WALLET_AUTO_CASHBACK_PERCENT: 5, WALLET_AUTO_CASHBACK_CAP: 5000 }
})

const { TripLifecycleService } = await import('../../../src/services/trip-lifecycle.service')

// ── Mock Repositories ─────────────────────────────────
const mockTx = {
  trip: { update: vi.fn() },
  booking: { updateMany: vi.fn() },
  organizerProfile: { update: vi.fn() },
  destination: { update: vi.fn() },
}

const mockTripRepo = {
  findTripsToComplete: vi.fn(),
  withTransaction: vi.fn().mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
}

const mockPaymentTxRepo = {
  findCapturedTransfersForTrip: vi.fn(),
  findByBookingId: vi.fn(),
  findReleasedBookingIdsForTrip: vi.fn().mockResolvedValue(new Set()),
  findUnreleasedSafePays: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
}

const mockPaymentService = {
  releaseTransferHold: vi.fn(),
  fetchTransferId: vi.fn(),
}

// ── Test Data Factory ────────────────────────────────
function createMockTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trip-1',
    organizerId: 'org-1',
    destinationId: 'dest-1',
    status: 'ACTIVE',
    ...overrides,
  }
}

function createMockCapturedPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ptx-1',
    bookingId: 'booking-1',
    amount: 9000,
    razorpayTransferId: 'trf_abc123',
    razorpayPaymentId: 'pay_abc123',
    booking: {
      totalAmount: 9000,
      markupAmount: 0,
      tripId: 'trip-1',
      trip: {
        organizer: { commissionRate: 10 },
      },
    },
    ...overrides,
  }
}

let service: TripLifecycleService

beforeEach(() => {
  vi.clearAllMocks()
  service = new TripLifecycleService(
    mockTripRepo as any,
    mockPaymentTxRepo as any,
    mockPaymentService as any,
    logger as any,
  )
})

describe('TripLifecycleService', () => {
  // ═══════════════════════════════════════════════════
  // completeEndedTrips
  // ═══════════════════════════════════════════════════
  describe('completeEndedTrips', () => {
    it('should complete trips past endDate with DB transaction', async () => {
      mockTripRepo.findTripsToComplete.mockResolvedValue([createMockTrip()])
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([])

      const result = await service.completeEndedTrips()

      expect(result.completed).toBe(1)
      expect(mockTripRepo.withTransaction).toHaveBeenCalled()
      expect(mockTx.trip.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'trip-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }))
      expect(mockTx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tripId: 'trip-1', bookingStatus: 'CONFIRMED' }),
        data: { bookingStatus: 'COMPLETED' },
      }))
      expect(mockTx.organizerProfile.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'org-1' },
        data: { totalTripsCompleted: { increment: 1 } },
      }))
      expect(mockTx.destination.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'dest-1' },
        data: { tripCount: { decrement: 1 } },
      }))
    })

    it('should return no-op when no trips past endDate', async () => {
      mockTripRepo.findTripsToComplete.mockResolvedValue([])

      const result = await service.completeEndedTrips()

      expect(result.completed).toBe(0)
      expect(result.safePayReleased).toBe(0)
      expect(result.safePayFailed).toBe(0)
      expect(mockTripRepo.withTransaction).not.toHaveBeenCalled()
    })

    it('should respect batch size limit (50)', async () => {
      mockTripRepo.findTripsToComplete.mockResolvedValue([])

      await service.completeEndedTrips()

      expect(mockTripRepo.findTripsToComplete).toHaveBeenCalledWith(50)
    })

    it('should continue processing when one trip fails', async () => {
      const trips = [createMockTrip(), createMockTrip({ id: 'trip-2', organizerId: 'org-2', destinationId: 'dest-2' })]
      mockTripRepo.findTripsToComplete.mockResolvedValue(trips)
      mockTripRepo.withTransaction
        .mockRejectedValueOnce(new Error('DB error'))
        .mockImplementationOnce((fn: any) => fn(mockTx))
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([])

      const result = await service.completeEndedTrips()

      expect(result.completed).toBe(1)
    })

    it('should not rollback trip completion when SafePay release fails', async () => {
      mockTripRepo.findTripsToComplete.mockResolvedValue([createMockTrip()])
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([createMockCapturedPayment()])
      mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set())
      mockPaymentService.releaseTransferHold.mockRejectedValue(new Error('Razorpay down'))

      const result = await service.completeEndedTrips()

      // Trip was completed even though SafePay failed
      expect(result.completed).toBe(1)
      expect(result.safePayFailed).toBe(1)
      expect(mockTripRepo.withTransaction).toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // releaseSafePayForTrip
  // ═══════════════════════════════════════════════════
  describe('releaseSafePayForTrip', () => {
    it('should release escrow and record ESCROW_RELEASE transaction', async () => {
      const payment = createMockCapturedPayment()
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment])
      mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set())
      mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
      mockPaymentTxRepo.create.mockResolvedValue({})

      const result = await service.releaseSafePayForTrip('trip-1')

      expect(result.released).toBe(1)
      expect(result.failed).toBe(0)
      expect(result.skipped).toBe(0)
      expect(mockPaymentService.releaseTransferHold).toHaveBeenCalledWith('trf_abc123')
      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        bookingId: 'booking-1',
        type: 'ESCROW_RELEASE',
        amount: 8100, // 9000 * (1 - 10/100) = 8100
        status: 'CAPTURED',
        razorpayTransferId: 'trf_abc123',
      }))
    })

    it('should skip already-released bookings (idempotency)', async () => {
      const payment = createMockCapturedPayment()
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment])
      // booking-1 already released — skip it
      mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set(['booking-1']))

      const result = await service.releaseSafePayForTrip('trip-1')

      expect(result.skipped).toBe(1)
      expect(result.released).toBe(0)
      expect(mockPaymentService.releaseTransferHold).not.toHaveBeenCalled()
    })

    it('should handle partial failures — continue releasing other bookings', async () => {
      const payment1 = createMockCapturedPayment({ id: 'ptx-1', bookingId: 'b1' })
      const payment2 = createMockCapturedPayment({ id: 'ptx-2', bookingId: 'b2', razorpayTransferId: 'trf_def456' })
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment1, payment2])
      mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set())
      mockPaymentService.releaseTransferHold
        .mockRejectedValueOnce(new Error('Razorpay error'))
        .mockResolvedValueOnce(undefined)
      mockPaymentTxRepo.create.mockResolvedValue({})

      const result = await service.releaseSafePayForTrip('trip-1')

      expect(result.released).toBe(1)
      expect(result.failed).toBe(1)
    })

    it('should return no-op when no captured transfers found', async () => {
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([])

      const result = await service.releaseSafePayForTrip('trip-1')

      expect(result).toEqual({ released: 0, failed: 0, skipped: 0 })
      expect(mockPaymentService.releaseTransferHold).not.toHaveBeenCalled()
    })

    it('should skip when payment service is null', async () => {
      const serviceNoPayment = new TripLifecycleService(
        mockTripRepo as any,
        mockPaymentTxRepo as any,
        null,
        logger as any,
      )

      const result = await serviceNoPayment.releaseSafePayForTrip('trip-1')

      expect(result).toEqual({ released: 0, failed: 0, skipped: 0 })
    })

    it('should lazy-fetch transfer ID when missing', async () => {
      const payment = createMockCapturedPayment({ razorpayTransferId: null })
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment])
      mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set())
      mockPaymentService.fetchTransferId.mockResolvedValue('trf_lazy_123')
      mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
      mockPaymentTxRepo.create.mockResolvedValue({})

      const result = await service.releaseSafePayForTrip('trip-1')

      expect(result.released).toBe(1)
      expect(mockPaymentService.fetchTransferId).toHaveBeenCalledWith('pay_abc123')
      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith(
        'ptx-1', 'CAPTURED', { razorpayTransferId: 'trf_lazy_123' },
      )
    })

    it('should record correct transfer amount using commission rate', async () => {
      const payment = createMockCapturedPayment({
        booking: {
          totalAmount: 10000,
          markupAmount: 0,
          tripId: 'trip-1',
          trip: { organizer: { commissionRate: 15 } },
        },
      })
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment])
      mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set())
      mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
      mockPaymentTxRepo.create.mockResolvedValue({})

      await service.releaseSafePayForTrip('trip-1')

      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        amount: 8500, // 10000 * (1 - 15/100) = 8500
      }))
    })

    it('computes the transfer amount from the base amount only — reseller markup never enters the escrow-release ledger', async () => {
      // totalAmount includes a 2000 markup on top of an 8000 base; only the base
      // may be transferred/recorded, matching the booking-time commission split.
      const payment = createMockCapturedPayment({
        booking: {
          totalAmount: 10000,
          markupAmount: 2000,
          tripId: 'trip-1',
          trip: { organizer: { commissionRate: 10 } },
        },
      })
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment])
      mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set())
      mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
      mockPaymentTxRepo.create.mockResolvedValue({})

      await service.releaseSafePayForTrip('trip-1')

      // base = 10000 - 2000 = 8000; 8000 * (1 - 10/100) = 7200
      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        amount: 7200,
      }))
    })

    it('is byte-identical to a non-reseller booking when markupAmount is 0', async () => {
      const paymentNoMarkup = createMockCapturedPayment({
        booking: { totalAmount: 10000, markupAmount: 0, tripId: 'trip-1', trip: { organizer: { commissionRate: 10 } } },
      })
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([paymentNoMarkup])
      mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set())
      mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
      mockPaymentTxRepo.create.mockResolvedValue({})

      await service.releaseSafePayForTrip('trip-1')

      // totalAmount - 0 === totalAmount — same result as pre-markup calculation
      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        amount: 9000, // 10000 * (1 - 10/100) = 9000
      }))
    })
  })

  // ═══════════════════════════════════════════════════
  // releaseUnreleasedSafePays (crash recovery)
  // ═══════════════════════════════════════════════════
  describe('releaseUnreleasedSafePays', () => {
    it('should pick up previously-failed SafePay releases', async () => {
      const unreleased = createMockCapturedPayment({ booking: { ...createMockCapturedPayment().booking, tripId: 'trip-1' } })
      mockPaymentTxRepo.findUnreleasedSafePays.mockResolvedValue([unreleased])
      mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
      mockPaymentTxRepo.create.mockResolvedValue({})

      const result = await service.releaseUnreleasedSafePays()

      expect(result.released).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockPaymentService.releaseTransferHold).toHaveBeenCalledWith('trf_abc123')
      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ESCROW_RELEASE',
        metadata: expect.objectContaining({ crashRecovery: true }),
      }))
    })

    it('should return no-op when no unreleased SafePays exist', async () => {
      mockPaymentTxRepo.findUnreleasedSafePays.mockResolvedValue([])

      const result = await service.releaseUnreleasedSafePays()

      expect(result).toEqual({ released: 0, failed: 0 })
    })

    it('should return no-op when payment service is null', async () => {
      const serviceNoPayment = new TripLifecycleService(
        mockTripRepo as any,
        mockPaymentTxRepo as any,
        null,
        logger as any,
      )

      const result = await serviceNoPayment.releaseUnreleasedSafePays()

      expect(result).toEqual({ released: 0, failed: 0 })
    })
  })

  // ═══════════════════════════════════════════════════════
  // commissionRate — Prisma.Decimal handling
  // After the Float → Decimal(5,2) migration, OrganizerProfile.commissionRate
  // arrives as a Prisma.Decimal. The service calls Number() to convert it.
  // ═══════════════════════════════════════════════════════

  describe('releaseSafePayForTrip — Decimal commissionRate', () => {
    beforeEach(() => {
      mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set())
      mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
      mockPaymentTxRepo.create.mockResolvedValue({})
    })

    it('correctly converts Prisma.Decimal commissionRate when calculating transfer amount', async () => {
      const payment = createMockCapturedPayment({
        booking: {
          totalAmount: 10000,
          markupAmount: 0,
          tripId: 'trip-1',
          trip: {
            organizer: {
              // Simulate Prisma.Decimal as returned by the DB after Float→Decimal migration
              commissionRate: new Prisma.Decimal('20.00'),
            },
          },
        },
      })
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment])

      await service.releaseSafePayForTrip('trip-1')

      // 10000 * (1 - 20/100) = 8000
      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 8000 }),
      )
    })

    it('falls back to PLATFORM_COMMISSION_PERCENT (10%) when commissionRate is null', async () => {
      const payment = createMockCapturedPayment({
        booking: {
          totalAmount: 10000,
          markupAmount: 0,
          tripId: 'trip-1',
          trip: {
            organizer: { commissionRate: null },
          },
        },
      })
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment])

      await service.releaseSafePayForTrip('trip-1')

      // null → 10% default → 10000 * (1 - 0.10) = 9000
      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 9000 }),
      )
    })

    it('handles a Decimal with fractional precision without rounding errors', async () => {
      const payment = createMockCapturedPayment({
        booking: {
          totalAmount: 9999,
          markupAmount: 0,
          tripId: 'trip-1',
          trip: {
            organizer: { commissionRate: new Prisma.Decimal('12.50') },
          },
        },
      })
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment])

      await service.releaseSafePayForTrip('trip-1')

      // 9999 * (1 - 0.125) = 9999 * 0.875 = 8749.125 → Math.round → 8749
      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 8749 }),
      )
    })
  })

  // ═══════════════════════════════════════════════════
  // Auto-cashback — base-only (reseller markup must never fund cashback)
  // ═══════════════════════════════════════════════════
  describe('sendPostCompletionSideEffects — auto-cashback base-only', () => {
    const mockNotificationService = { send: vi.fn().mockResolvedValue(undefined) }
    const mockWalletService = { credit: vi.fn().mockResolvedValue(undefined) }
    const mockBookingRepo = { findConfirmedByTripForCashback: vi.fn() }

    let cashbackService: InstanceType<typeof TripLifecycleService>

    beforeEach(() => {
      vi.clearAllMocks()
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([])
      mockTripRepo.findTripsToComplete.mockResolvedValue([])
      cashbackService = new TripLifecycleService(
        mockTripRepo as any,
        mockPaymentTxRepo as any,
        mockPaymentService as any,
        logger as any,
        mockNotificationService as any,
        mockWalletService as any,
        mockBookingRepo as any,
      )
    })

    it('credits cashback from the base amount only when markupAmount > 0', async () => {
      mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue([
        {
          bookingId: 'booking-1',
          userId: 'user-1',
          totalAmount: 10000,
          markupAmount: 2000,
          cashbackIssued: null,
        },
      ])

      await (cashbackService as any).sendPostCompletionSideEffects('trip-1', 'goa-trip', 'Goa Trip')

      // base = 10000 - 2000 = 8000; 5% of 8000 = 400
      expect(mockWalletService.credit).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', amount: 400 }),
      )
    })

    it('is byte-identical to a non-reseller booking when markupAmount is 0', async () => {
      mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue([
        {
          bookingId: 'booking-2',
          userId: 'user-2',
          totalAmount: 10000,
          markupAmount: 0,
          cashbackIssued: null,
        },
      ])

      await (cashbackService as any).sendPostCompletionSideEffects('trip-1', 'goa-trip', 'Goa Trip')

      // totalAmount - 0 === totalAmount; 5% of 10000 = 500 — same as pre-markup calculation
      expect(mockWalletService.credit).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-2', amount: 500 }),
      )
    })
  })
})
