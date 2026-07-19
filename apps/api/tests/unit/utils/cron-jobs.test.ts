import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startCronJobs } from '../../../src/utils/cron-jobs'

// ── Mock logger (suppress output) ────────────────────
vi.mock('../../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ── Mock Repositories ─────────────────────────────────
const mockBookingRepo = {
  findExpiredPendingBookings: vi.fn(),
  updateStatus: vi.fn(),
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const mockTripRequestRepo = {
  expireApprovedRequests: vi.fn(),
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const mockVerifCodeRepo = {
  deleteExpired: vi.fn(),
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const mockRefreshTokenRepo = {
  deleteExpired: vi.fn(),
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const mockPaymentService = {
  checkOrderStatus: vi.fn(),
  resolveProviderFromTx: vi.fn().mockReturnValue('razorpay'),
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const mockTripLifecycleService = {
  completeEndedTrips: vi.fn().mockResolvedValue({ completed: 0, safePayReleased: 0, safePayFailed: 0 }),
  releaseUnreleasedSafePays: vi.fn().mockResolvedValue({ released: 0, failed: 0 }),
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const mockWebhookEventRepo = {
  deleteOldTerminalEvents: vi.fn().mockResolvedValue(0),
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const mockVehicleService = {
  releaseSeats: vi.fn().mockResolvedValue(undefined),
  expireHeldSeats: vi.fn().mockResolvedValue(0),
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const mockWalletService = {
  reconcile: vi.fn().mockResolvedValue({ checked: 0, drifted: 0 }),
  expireCredits: vi.fn().mockResolvedValue({ voided: 0, skipped: 0 }),
  findCreditsNeedingExpiryReminder: vi.fn().mockResolvedValue([]),
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const mockNotificationService = {
  send: vi.fn().mockResolvedValue(undefined),
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const mockBookingService = {
  recoverPaidBooking: vi.fn().mockResolvedValue(undefined),
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const mockPaymentTxRepo = {
  findBalanceReleaseEligibleBookings: vi.fn().mockResolvedValue([]),
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const mockPayoutService = {
  releaseBalance: vi.fn().mockResolvedValue('skipped'),
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const FIVE_MINUTES = 5 * 60 * 1000
const ONE_DAY = 24 * 60 * 60 * 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createDeps(paymentService = mockPaymentService as any) {
  return {
    bookingRepo: mockBookingRepo,
    tripRequestRepo: mockTripRequestRepo,
    refreshTokenRepo: mockRefreshTokenRepo,
    verifCodeRepo: mockVerifCodeRepo,
    webhookEventRepo: mockWebhookEventRepo,
    paymentTxRepo: mockPaymentTxRepo,
    paymentService,
    bookingService: mockBookingService,
    tripLifecycleService: mockTripLifecycleService,
    payoutService: mockPayoutService,
    vehicleService: mockVehicleService,
    walletService: mockWalletService,
    notificationService: mockNotificationService,
  }
}

let stopCrons: () => void

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  mockBookingRepo.findExpiredPendingBookings.mockResolvedValue([])
  mockTripRequestRepo.expireApprovedRequests.mockResolvedValue({ count: 0 })
  mockVerifCodeRepo.deleteExpired.mockResolvedValue({ count: 0 })
  mockRefreshTokenRepo.deleteExpired.mockResolvedValue({ count: 0 })
  mockPaymentTxRepo.findBalanceReleaseEligibleBookings.mockResolvedValue([])
  mockPayoutService.releaseBalance.mockResolvedValue('skipped')
})

afterEach(() => {
  stopCrons?.()
  vi.useRealTimers()
})

// ── expireStaleBookings (tested via startCronJobs + fake timer) ──

describe('expireStaleBookings (via cron)', () => {
  it('should do nothing when no expired bookings exist', async () => {
    mockBookingRepo.findExpiredPendingBookings.mockResolvedValue([])
    stopCrons = startCronJobs(createDeps())

    await vi.advanceTimersByTimeAsync(FIVE_MINUTES)

    expect(mockBookingRepo.updateStatus).not.toHaveBeenCalled()
  })

  it('should expire a booking when Razorpay order is not paid', async () => {
    mockBookingRepo.findExpiredPendingBookings.mockResolvedValue([
      { id: 'b1', paymentTransactions: [{ razorpayOrderId: 'order_1' }] },
    ])
    mockPaymentService.checkOrderStatus.mockResolvedValue('created')
    stopCrons = startCronJobs(createDeps())

    await vi.advanceTimersByTimeAsync(FIVE_MINUTES)

    expect(mockBookingRepo.updateStatus).toHaveBeenCalledWith('b1', 'EXPIRED')
  })

  it('should skip expiry if Razorpay says order is paid (webhook missed)', async () => {
    mockBookingRepo.findExpiredPendingBookings.mockResolvedValue([
      { id: 'b2', paymentTransactions: [{ razorpayOrderId: 'order_2' }] },
    ])
    mockPaymentService.checkOrderStatus.mockResolvedValue('paid')
    stopCrons = startCronJobs(createDeps())

    await vi.advanceTimersByTimeAsync(FIVE_MINUTES)

    expect(mockBookingRepo.updateStatus).not.toHaveBeenCalled()
  })

  it('should expire booking even when paymentService is null (mock mode)', async () => {
    mockBookingRepo.findExpiredPendingBookings.mockResolvedValue([
      { id: 'b3', paymentTransactions: [] },
    ])
    stopCrons = startCronJobs(createDeps(null))

    await vi.advanceTimersByTimeAsync(FIVE_MINUTES)

    expect(mockBookingRepo.updateStatus).toHaveBeenCalledWith('b3', 'EXPIRED')
  })

  it('should continue processing remaining bookings when one fails', async () => {
    mockBookingRepo.findExpiredPendingBookings.mockResolvedValue([
      { id: 'b4', paymentTransactions: [] },
      { id: 'b5', paymentTransactions: [] },
    ])
    mockBookingRepo.updateStatus
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce(undefined)
    stopCrons = startCronJobs(createDeps(null))

    await vi.advanceTimersByTimeAsync(FIVE_MINUTES)

    expect(mockBookingRepo.updateStatus).toHaveBeenCalledTimes(2)
    expect(mockBookingRepo.updateStatus).toHaveBeenCalledWith('b5', 'EXPIRED')
  })
})

// ── startCronJobs ────────────────────────────────────

describe('startCronJobs', () => {
  it('should return a cleanup function that clears intervals', async () => {
    stopCrons = startCronJobs(createDeps(null))

    expect(typeof stopCrons).toBe('function')

    // Should not have run yet (no tick)
    expect(mockBookingRepo.findExpiredPendingBookings).not.toHaveBeenCalled()

    // Advance 5 minutes — booking + request crons fire
    await vi.advanceTimersByTimeAsync(FIVE_MINUTES)

    expect(mockBookingRepo.findExpiredPendingBookings).toHaveBeenCalled()
    expect(mockTripRequestRepo.expireApprovedRequests).toHaveBeenCalled()

    // Cleanup should stop further execution
    stopCrons()
    vi.clearAllMocks()
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)

    expect(mockBookingRepo.findExpiredPendingBookings).not.toHaveBeenCalled()
    expect(mockTripRequestRepo.expireApprovedRequests).not.toHaveBeenCalled()
  })

  it('should fire verification code and refresh token cleanup after 1 hour', async () => {
    stopCrons = startCronJobs(createDeps(null))

    // 5 min — hourly cleanups not yet called
    await vi.advanceTimersByTimeAsync(FIVE_MINUTES)
    expect(mockVerifCodeRepo.deleteExpired).not.toHaveBeenCalled()
    expect(mockRefreshTokenRepo.deleteExpired).not.toHaveBeenCalled()

    // 1 hour — both hourly cleanups fire
    await vi.advanceTimersByTimeAsync(55 * 60 * 1000)
    expect(mockVerifCodeRepo.deleteExpired).toHaveBeenCalledTimes(1)
    expect(mockRefreshTokenRepo.deleteExpired).toHaveBeenCalledTimes(1)
  })

  it('should fire trip completion cron after 30 minutes', async () => {
    stopCrons = startCronJobs(createDeps(null))

    // 5 min — trip completion not yet called
    await vi.advanceTimersByTimeAsync(FIVE_MINUTES)
    expect(mockTripLifecycleService.completeEndedTrips).not.toHaveBeenCalled()

    // 30 min — trip completion fires
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    expect(mockTripLifecycleService.completeEndedTrips).toHaveBeenCalledTimes(1)
    expect(mockTripLifecycleService.releaseUnreleasedSafePays).toHaveBeenCalledTimes(1)
  })

  it('should NOT fire webhook event cleanup before 24 hours', async () => {
    stopCrons = startCronJobs(createDeps(null))

    // 1 hour — cleanup has not fired yet
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(mockWebhookEventRepo.deleteOldTerminalEvents).not.toHaveBeenCalled()
  })

  it('should fire webhook event cleanup cron after 24 hours', async () => {
    stopCrons = startCronJobs(createDeps(null))

    // Advance to just before 24 h — must not fire yet
    await vi.advanceTimersByTimeAsync(ONE_DAY - 1)
    expect(mockWebhookEventRepo.deleteOldTerminalEvents).not.toHaveBeenCalled()

    // Tick past the 24-hour mark — cleanup fires once
    await vi.advanceTimersByTimeAsync(2)
    expect(mockWebhookEventRepo.deleteOldTerminalEvents).toHaveBeenCalledTimes(1)
  })
})

// ── releaseCashfreeBalances (S3-S5: balance-release cron) ──

describe('releaseCashfreeBalances (via cron)', () => {
  it('S5: should do nothing when no eligible bookings exist', async () => {
    mockPaymentTxRepo.findBalanceReleaseEligibleBookings.mockResolvedValue([])
    stopCrons = startCronJobs(createDeps(null))

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)

    expect(mockPayoutService.releaseBalance).not.toHaveBeenCalled()
  })

  it('S3: should call payoutService.releaseBalance for each eligible booking', async () => {
    mockPaymentTxRepo.findBalanceReleaseEligibleBookings.mockResolvedValue([
      { bookingId: 'booking-1' },
      { bookingId: 'booking-2' },
    ])
    mockPayoutService.releaseBalance.mockResolvedValue('transferred')
    stopCrons = startCronJobs(createDeps(null))

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)

    expect(mockPayoutService.releaseBalance).toHaveBeenCalledWith('booking-1')
    expect(mockPayoutService.releaseBalance).toHaveBeenCalledWith('booking-2')
    expect(mockPayoutService.releaseBalance).toHaveBeenCalledTimes(2)
  })

  it('S4: should not stop the batch when one booking release throws unexpectedly', async () => {
    mockPaymentTxRepo.findBalanceReleaseEligibleBookings.mockResolvedValue([
      { bookingId: 'booking-1' },
      { bookingId: 'booking-2' },
    ])
    mockPayoutService.releaseBalance
      .mockRejectedValueOnce(new Error('unexpected gateway error'))
      .mockResolvedValueOnce('transferred')
    stopCrons = startCronJobs(createDeps(null))

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)

    // Second booking is still processed despite the first one throwing —
    // per-booking try/catch isolation (releaseBalance is documented never to throw,
    // but this is the last-resort guard for an unexpected error).
    expect(mockPayoutService.releaseBalance).toHaveBeenCalledTimes(2)
    expect(mockPayoutService.releaseBalance).toHaveBeenCalledWith('booking-2')
  })

  it('S5: should query with a cutoff date REFUND_CLIFF_DAYS ahead of now', async () => {
    mockPaymentTxRepo.findBalanceReleaseEligibleBookings.mockResolvedValue([])
    const before = Date.now()
    stopCrons = startCronJobs(createDeps(null))

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)

    expect(mockPaymentTxRepo.findBalanceReleaseEligibleBookings).toHaveBeenCalledTimes(1)
    const cutoffArg: Date = mockPaymentTxRepo.findBalanceReleaseEligibleBookings.mock.calls[0][0]
    const REFUND_CLIFF_DAYS = 7
    const expectedCutoff = before + REFUND_CLIFF_DAYS * 24 * 60 * 60 * 1000
    // Allow small slack for the fake-timer advance + a fresh Date.now() call inside the cron.
    expect(cutoffArg.getTime()).toBeGreaterThanOrEqual(expectedCutoff)
    expect(cutoffArg.getTime()).toBeLessThan(expectedCutoff + 30 * 60 * 1000 + 5000)
  })
})
