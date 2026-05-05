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
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const FIVE_MINUTES = 5 * 60 * 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createDeps(paymentService = mockPaymentService as any) {
  return {
    bookingRepo: mockBookingRepo,
    tripRequestRepo: mockTripRequestRepo,
    refreshTokenRepo: mockRefreshTokenRepo,
    verifCodeRepo: mockVerifCodeRepo,
    paymentService,
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
})
