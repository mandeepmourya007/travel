/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TripLifecycleService } from '../../../src/services/trip-lifecycle.service'
import { logger } from '../../../src/utils/logger'

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
  findUnreleasedEscrows: vi.fn(),
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
      expect(result.escrowReleased).toBe(0)
      expect(result.escrowFailed).toBe(0)
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

    it('should not rollback trip completion when escrow release fails', async () => {
      mockTripRepo.findTripsToComplete.mockResolvedValue([createMockTrip()])
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([createMockCapturedPayment()])
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([]) // No existing releases
      mockPaymentService.releaseTransferHold.mockRejectedValue(new Error('Razorpay down'))

      const result = await service.completeEndedTrips()

      // Trip was completed even though escrow failed
      expect(result.completed).toBe(1)
      expect(result.escrowFailed).toBe(1)
      expect(mockTripRepo.withTransaction).toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // releaseEscrowForTrip
  // ═══════════════════════════════════════════════════
  describe('releaseEscrowForTrip', () => {
    it('should release escrow and record ESCROW_RELEASE transaction', async () => {
      const payment = createMockCapturedPayment()
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment])
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([]) // No existing releases
      mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
      mockPaymentTxRepo.create.mockResolvedValue({})

      const result = await service.releaseEscrowForTrip('trip-1')

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
      // Existing ESCROW_RELEASE for this booking
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([{ type: 'ESCROW_RELEASE' }])

      const result = await service.releaseEscrowForTrip('trip-1')

      expect(result.skipped).toBe(1)
      expect(result.released).toBe(0)
      expect(mockPaymentService.releaseTransferHold).not.toHaveBeenCalled()
    })

    it('should handle partial failures — continue releasing other bookings', async () => {
      const payment1 = createMockCapturedPayment({ id: 'ptx-1', bookingId: 'b1' })
      const payment2 = createMockCapturedPayment({ id: 'ptx-2', bookingId: 'b2', razorpayTransferId: 'trf_def456' })
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment1, payment2])
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([]) // No releases
      mockPaymentService.releaseTransferHold
        .mockRejectedValueOnce(new Error('Razorpay error'))
        .mockResolvedValueOnce(undefined)
      mockPaymentTxRepo.create.mockResolvedValue({})

      const result = await service.releaseEscrowForTrip('trip-1')

      expect(result.released).toBe(1)
      expect(result.failed).toBe(1)
    })

    it('should return no-op when no captured transfers found', async () => {
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([])

      const result = await service.releaseEscrowForTrip('trip-1')

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

      const result = await serviceNoPayment.releaseEscrowForTrip('trip-1')

      expect(result).toEqual({ released: 0, failed: 0, skipped: 0 })
    })

    it('should lazy-fetch transfer ID when missing', async () => {
      const payment = createMockCapturedPayment({ razorpayTransferId: null })
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment])
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([])
      mockPaymentService.fetchTransferId.mockResolvedValue('trf_lazy_123')
      mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
      mockPaymentTxRepo.create.mockResolvedValue({})

      const result = await service.releaseEscrowForTrip('trip-1')

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
          tripId: 'trip-1',
          trip: { organizer: { commissionRate: 15 } },
        },
      })
      mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment])
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([])
      mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
      mockPaymentTxRepo.create.mockResolvedValue({})

      await service.releaseEscrowForTrip('trip-1')

      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        amount: 8500, // 10000 * (1 - 15/100) = 8500
      }))
    })
  })

  // ═══════════════════════════════════════════════════
  // releaseUnreleasedEscrows (crash recovery)
  // ═══════════════════════════════════════════════════
  describe('releaseUnreleasedEscrows', () => {
    it('should pick up previously-failed escrow releases', async () => {
      const unreleased = createMockCapturedPayment({ booking: { ...createMockCapturedPayment().booking, tripId: 'trip-1' } })
      mockPaymentTxRepo.findUnreleasedEscrows.mockResolvedValue([unreleased])
      mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
      mockPaymentTxRepo.create.mockResolvedValue({})

      const result = await service.releaseUnreleasedEscrows()

      expect(result.released).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockPaymentService.releaseTransferHold).toHaveBeenCalledWith('trf_abc123')
      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ESCROW_RELEASE',
        metadata: expect.objectContaining({ crashRecovery: true }),
      }))
    })

    it('should return no-op when no unreleased escrows exist', async () => {
      mockPaymentTxRepo.findUnreleasedEscrows.mockResolvedValue([])

      const result = await service.releaseUnreleasedEscrows()

      expect(result).toEqual({ released: 0, failed: 0 })
    })

    it('should return no-op when payment service is null', async () => {
      const serviceNoPayment = new TripLifecycleService(
        mockTripRepo as any,
        mockPaymentTxRepo as any,
        null,
        logger as any,
      )

      const result = await serviceNoPayment.releaseUnreleasedEscrows()

      expect(result).toEqual({ released: 0, failed: 0 })
    })
  })
})
