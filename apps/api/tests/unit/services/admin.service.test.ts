import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminService } from '../../../src/services/admin.service'
import { logger } from '../../../src/utils/logger'

// ─── Mock repositories ──────────────────────────────
const mockOrganizerProfileRepo = {
  findAllAdmin: vi.fn(),
  findByIdAdmin: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  countPending: vi.fn(),
}

const mockUserRepo = {
  countAll: vi.fn(),
  countByRole: vi.fn(),
  findByIds: vi.fn(),
}

const mockBookingRepo = {
  countByStatusAdmin: vi.fn(),
  getRevenueTrend: vi.fn(),
  findAllAdmin: vi.fn(),
  findByIdAdmin: vi.fn(),
  findConfirmedByTripForCashback: vi.fn(),
}

const mockTripRepo = {
  countByStatus: vi.fn(),
  countByType: vi.fn(),
  findById: vi.fn(),
  findCompletedTripsForCashback: vi.fn(),
}

const mockPaymentTxRepo = {
  getGlobalSummary: vi.fn(),
}

const mockMessageRepo = {
  countFlagged: vi.fn(),
}

const mockNotificationService = {
  send: vi.fn().mockResolvedValue([{ channel: 'IN_APP', success: true }]),
}

const mockWalletRepo = {
  getCashbackByUser: vi.fn(),
  getCashbackByTrip: vi.fn(),
  getCashbackForUserDetail: vi.fn(),
}

const mockWalletService = {
  credit: vi.fn(),
}

const mockDocReviewRepo = {
  upsert: vi.fn(),
  countApproved: vi.fn(),
  findComments: vi.fn(),
  addComment: vi.fn(),
  updateAllDocStatuses: vi.fn(),
  findByOrganizerId: vi.fn(),
}

let service: AdminService

beforeEach(() => {
  vi.clearAllMocks()
  service = new AdminService(
    mockOrganizerProfileRepo as any,
    mockUserRepo as any,
    mockBookingRepo as any,
    mockTripRepo as any,
    mockPaymentTxRepo as any,
    mockMessageRepo as any,
    mockWalletRepo as any,
    mockWalletService as any,
    logger as any,
    mockNotificationService as any,
    mockDocReviewRepo as any,
  )
})

// ─── Test data factories ─────────────────────────────
function makeOrganizerProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org_1',
    userId: 'user_1',
    businessName: 'TripVibes Adventures',
    description: 'Amazing adventure company',
    documents: { aadhaar: 'doc_url_1', pan: 'doc_url_2' },
    verificationStatus: 'PENDING',
    createdAt: new Date('2026-05-05'),
    user: { id: 'user_1', name: 'Rahul Sharma', email: 'rahul@test.com', avatarUrl: null },
    ...overrides,
  }
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bk_1',
    bookingRef: 'TRP-2026-ABCD',
    totalAmount: 4500,
    bookingStatus: 'CONFIRMED',
    numTravelers: 2,
    createdAt: new Date('2026-05-03'),
    trip: { id: 'trip_1', title: 'Goa Beach Getaway', slug: 'goa-beach-getaway', startDate: new Date('2026-12-06'), endDate: new Date('2026-12-08') },
    user: { id: 'user_1', name: 'Rahul S', email: 'rahul@test.com' },
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════
// APPROVAL QUEUE
// ═══════════════════════════════════════════════════════
describe('AdminService — Approval Queue', () => {
  it('returns paginated organizer list with user details', async () => {
    const items = [makeOrganizerProfile(), makeOrganizerProfile({ id: 'org_2', userId: 'user_2' })]
    mockOrganizerProfileRepo.findAllAdmin.mockResolvedValue({ data: items, total: 2 })

    const result = await service.getApprovalQueue({ page: 1, limit: 20 })

    expect(mockOrganizerProfileRepo.findAllAdmin).toHaveBeenCalledWith(
      { status: undefined },
      { skip: 0, take: 20 },
    )
    expect(result.data).toHaveLength(2)
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 })
  })

  it('filters by PENDING status', async () => {
    mockOrganizerProfileRepo.findAllAdmin.mockResolvedValue({ data: [makeOrganizerProfile()], total: 1 })

    await service.getApprovalQueue({ status: 'PENDING', page: 1, limit: 10 })

    expect(mockOrganizerProfileRepo.findAllAdmin).toHaveBeenCalledWith(
      { status: 'PENDING' },
      { skip: 0, take: 10 },
    )
  })

  it('filters by APPROVED status', async () => {
    mockOrganizerProfileRepo.findAllAdmin.mockResolvedValue({ data: [], total: 0 })

    await service.getApprovalQueue({ status: 'APPROVED', page: 1, limit: 20 })

    expect(mockOrganizerProfileRepo.findAllAdmin).toHaveBeenCalledWith(
      { status: 'APPROVED' },
      { skip: 0, take: 20 },
    )
  })

  it('returns empty list when no organizers match', async () => {
    mockOrganizerProfileRepo.findAllAdmin.mockResolvedValue({ data: [], total: 0 })

    const result = await service.getApprovalQueue({ status: 'REJECTED' })

    expect(result.data).toHaveLength(0)
    expect(result.pagination.total).toBe(0)
    expect(result.pagination.totalPages).toBe(0)
  })

  it('respects pagination (page 2)', async () => {
    mockOrganizerProfileRepo.findAllAdmin.mockResolvedValue({ data: [], total: 25 })

    const result = await service.getApprovalQueue({ page: 2, limit: 10 })

    expect(mockOrganizerProfileRepo.findAllAdmin).toHaveBeenCalledWith(
      { status: undefined },
      { skip: 10, take: 10 },
    )
    expect(result.pagination.totalPages).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════
// ORGANIZER DETAIL
// ═══════════════════════════════════════════════════════
describe('AdminService — Organizer Detail', () => {
  it('returns organizer detail with full info', async () => {
    const profile = makeOrganizerProfile()
    mockOrganizerProfileRepo.findByIdAdmin.mockResolvedValue(profile)

    const result = await service.getOrganizerDetail('org_1')

    expect(mockOrganizerProfileRepo.findByIdAdmin).toHaveBeenCalledWith('org_1')
    expect(result.businessName).toBe('TripVibes Adventures')
  })

  it('throws NotFoundError for non-existent profile', async () => {
    mockOrganizerProfileRepo.findByIdAdmin.mockResolvedValue(null)

    await expect(service.getOrganizerDetail('nonexistent')).rejects.toThrow('OrganizerProfile not found')
  })
})

// ═══════════════════════════════════════════════════════
// APPROVE / REJECT
// ═══════════════════════════════════════════════════════
describe('AdminService — Approve/Reject', () => {
  it('approves PENDING organizer', async () => {
    const profile = makeOrganizerProfile({ verificationStatus: 'PENDING' })
    mockOrganizerProfileRepo.findById.mockResolvedValue(profile)
    mockOrganizerProfileRepo.update.mockResolvedValue({ ...profile, verificationStatus: 'APPROVED' })

    const result = await service.approveOrReject('org_1', { action: 'APPROVED' })

    expect(result.status).toBe('APPROVED')
    expect(mockOrganizerProfileRepo.update).toHaveBeenCalledWith('org_1', { verificationStatus: 'APPROVED' })
  })

  it('rejects PENDING organizer with reason', async () => {
    const profile = makeOrganizerProfile({ verificationStatus: 'PENDING' })
    mockOrganizerProfileRepo.findById.mockResolvedValue(profile)
    mockOrganizerProfileRepo.update.mockResolvedValue({ ...profile, verificationStatus: 'REJECTED' })

    const result = await service.approveOrReject('org_1', { action: 'REJECTED', reason: 'Incomplete docs' })

    expect(result.status).toBe('REJECTED')
    expect(mockOrganizerProfileRepo.update).toHaveBeenCalledWith('org_1', { verificationStatus: 'REJECTED' })
  })

  it('creates ORGANIZER_APPROVED notification on approve', async () => {
    const profile = makeOrganizerProfile({ verificationStatus: 'PENDING' })
    mockOrganizerProfileRepo.findById.mockResolvedValue(profile)
    mockOrganizerProfileRepo.update.mockResolvedValue({})
    await service.approveOrReject('org_1', { action: 'APPROVED' })

    expect(mockNotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        type: 'ORGANIZER_APPROVED',
      }),
    )
  })

  it('creates ORGANIZER_REJECTED notification on reject', async () => {
    const profile = makeOrganizerProfile({ verificationStatus: 'PENDING' })
    mockOrganizerProfileRepo.findById.mockResolvedValue(profile)
    mockOrganizerProfileRepo.update.mockResolvedValue({})
    await service.approveOrReject('org_1', { action: 'REJECTED', reason: 'Bad docs' })

    expect(mockNotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        type: 'ORGANIZER_REJECTED',
        body: expect.stringContaining('Bad docs'),
      }),
    )
  })

  it('throws NotFoundError for non-existent profile ID', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(null)

    await expect(service.approveOrReject('nonexistent', { action: 'APPROVED' })).rejects.toThrow('OrganizerProfile not found')
  })

  it('throws ValidationError when approving already-APPROVED profile', async () => {
    const profile = makeOrganizerProfile({ verificationStatus: 'APPROVED' })
    mockOrganizerProfileRepo.findById.mockResolvedValue(profile)

    await expect(service.approveOrReject('org_1', { action: 'APPROVED' })).rejects.toThrow('Profile is already APPROVED')
  })

  it('throws ValidationError when rejecting already-REJECTED profile', async () => {
    const profile = makeOrganizerProfile({ verificationStatus: 'REJECTED' })
    mockOrganizerProfileRepo.findById.mockResolvedValue(profile)

    await expect(service.approveOrReject('org_1', { action: 'REJECTED' })).rejects.toThrow('Profile is already REJECTED')
  })
})

// ═══════════════════════════════════════════════════════
// PLATFORM STATS
// ═══════════════════════════════════════════════════════
describe('AdminService — Platform Stats', () => {
  const setupStatsDefaults = () => {
    mockUserRepo.countAll.mockResolvedValue(1000)
    mockUserRepo.countByRole.mockResolvedValue(50)
    mockOrganizerProfileRepo.countPending.mockResolvedValue(3)
    mockTripRepo.countByStatus.mockResolvedValue([
      { status: 'ACTIVE', count: 30 },
      { status: 'FULL', count: 5 },
      { status: 'COMPLETED', count: 100 },
      { status: 'DRAFT', count: 10 },
    ])
    mockTripRepo.countByType.mockResolvedValue([
      { type: 'ADVENTURE', count: 50 },
      { type: 'TREK', count: 30 },
      { type: 'BEACH', count: 20 },
    ])
    mockBookingRepo.countByStatusAdmin.mockResolvedValue([
      { status: 'CONFIRMED', count: 400 },
      { status: 'COMPLETED', count: 300 },
      { status: 'CANCELLED', count: 50 },
    ])
    mockBookingRepo.getRevenueTrend.mockResolvedValue([
      { month: '2026-01', revenue: 100000 },
      { month: '2026-02', revenue: 150000 },
    ])
    mockMessageRepo.countFlagged.mockResolvedValue(7)
    mockPaymentTxRepo.getGlobalSummary.mockResolvedValue({
      totalRevenue: 5000000,
      totalRefunded: 200000,
      transactionCount: 800,
      failedCount: 15,
    })
  }

  it('returns correct overview counts', async () => {
    setupStatsDefaults()

    const result = await service.getPlatformStats()

    expect(result.overview.totalUsers).toBe(1000)
    expect(result.overview.totalOrganizers).toBe(50)
    expect(result.overview.pendingApprovals).toBe(3)
    expect(result.overview.activeTrips).toBe(35) // 30 ACTIVE + 5 FULL
    expect(result.overview.totalTrips).toBe(145) // 30 + 5 + 100 + 10
    expect(result.overview.totalBookings).toBe(750) // 400 + 300 + 50
    expect(result.overview.totalRevenue).toBe(4800000) // 5M - 200K
    expect(result.overview.flaggedMessages).toBe(7)
  })

  it('returns revenue trend for last 6 months', async () => {
    setupStatsDefaults()

    const result = await service.getPlatformStats()

    expect(result.revenueTrend).toHaveLength(2)
    expect(result.revenueTrend[0]).toEqual({ month: '2026-01', revenue: 100000 })
  })

  it('returns bookings grouped by status', async () => {
    setupStatsDefaults()

    const result = await service.getPlatformStats()

    expect(result.bookingsByStatus).toHaveLength(3)
    expect(result.bookingsByStatus[0].status).toBe('CONFIRMED')
  })

  it('returns trips grouped by type', async () => {
    setupStatsDefaults()

    const result = await service.getPlatformStats()

    expect(result.tripsByType).toHaveLength(3)
  })

  it('handles zero data gracefully', async () => {
    mockUserRepo.countAll.mockResolvedValue(0)
    mockUserRepo.countByRole.mockResolvedValue(0)
    mockOrganizerProfileRepo.countPending.mockResolvedValue(0)
    mockTripRepo.countByStatus.mockResolvedValue([])
    mockTripRepo.countByType.mockResolvedValue([])
    mockBookingRepo.countByStatusAdmin.mockResolvedValue([])
    mockBookingRepo.getRevenueTrend.mockResolvedValue([])
    mockMessageRepo.countFlagged.mockResolvedValue(0)
    mockPaymentTxRepo.getGlobalSummary.mockResolvedValue({
      totalRevenue: 0, totalRefunded: 0, transactionCount: 0, failedCount: 0,
    })

    const result = await service.getPlatformStats()

    expect(result.overview.totalUsers).toBe(0)
    expect(result.overview.totalTrips).toBe(0)
    expect(result.overview.totalBookings).toBe(0)
    expect(result.overview.totalRevenue).toBe(0)
    expect(result.revenueTrend).toHaveLength(0)
    expect(result.bookingsByStatus).toHaveLength(0)
    expect(result.tripsByType).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════
// ADMIN BOOKINGS
// ═══════════════════════════════════════════════════════
describe('AdminService — Admin Bookings', () => {
  it('returns paginated booking list with trip + user', async () => {
    const bookings = [makeBooking(), makeBooking({ id: 'bk_2', bookingRef: 'TRP-2026-EFGH' })]
    mockBookingRepo.findAllAdmin.mockResolvedValue({ data: bookings, total: 2 })

    const result = await service.getBookings({ page: 1, limit: 20 })

    expect(result.data).toHaveLength(2)
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 })
  })

  it('filters by bookingStatus', async () => {
    mockBookingRepo.findAllAdmin.mockResolvedValue({ data: [], total: 0 })

    await service.getBookings({ status: 'CANCELLED', page: 1, limit: 20 })

    expect(mockBookingRepo.findAllAdmin).toHaveBeenCalledWith(
      { status: 'CANCELLED', search: undefined },
      { skip: 0, take: 20 },
    )
  })

  it('searches by bookingRef (case-insensitive)', async () => {
    mockBookingRepo.findAllAdmin.mockResolvedValue({ data: [makeBooking()], total: 1 })

    await service.getBookings({ search: 'TRP-2026', page: 1, limit: 20 })

    expect(mockBookingRepo.findAllAdmin).toHaveBeenCalledWith(
      { status: undefined, search: 'TRP-2026' },
      { skip: 0, take: 20 },
    )
  })

  it('returns booking detail with traveler details + payments', async () => {
    const detail = {
      ...makeBooking(),
      walletAmount: 500,
      cancellationReason: null,
      cancelledAt: null,
      travelerDetails: [{ id: 'td_1', name: 'Rahul', phone: '9876543210', age: 28, gender: 'MALE', isPrimary: true }],
      paymentTransactions: [{ id: 'pt_1', type: 'PAYMENT', status: 'CAPTURED', amount: 4500, createdAt: new Date(), razorpayPaymentId: 'pay_123', razorpayRefundId: null }],
    }
    mockBookingRepo.findByIdAdmin.mockResolvedValue(detail)

    const result = await service.getBookingDetail('bk_1')

    expect(result.travelerDetails).toHaveLength(1)
    expect(result.paymentTransactions).toHaveLength(1)
  })

  it('throws NotFoundError for non-existent booking ID', async () => {
    mockBookingRepo.findByIdAdmin.mockResolvedValue(null)

    await expect(service.getBookingDetail('nonexistent')).rejects.toThrow('Booking not found')
  })
})

// ═══════════════════════════════════════════════════════
// CASHBACK
// ═══════════════════════════════════════════════════════

function makeTravelerItem(overrides: Record<string, unknown> = {}) {
  return {
    bookingId: 'bk_1',
    userId: 'user_1',
    userName: 'Priya Sharma',
    email: 'priya@test.com',
    totalAmount: 4500,
    numTravelers: 1,
    cashbackIssued: null,
    issuedAt: null,
    ...overrides,
  }
}

describe('AdminService — getCompletedTripsForCashback', () => {
  it('returns paginated completed trips with cashback stats', async () => {
    const trips = [
      { id: 'trip_1', title: 'Goa Beach', slug: 'goa', startDate: '2026-12-06', endDate: '2026-12-08', currentBookings: 18, cashbackStats: { issuedCount: 10, totalAmount: 2000 } },
    ]
    mockTripRepo.findCompletedTripsForCashback.mockResolvedValue({ data: trips, total: 1 })

    const result = await service.getCompletedTripsForCashback({ page: 1, limit: 20 })

    expect(mockTripRepo.findCompletedTripsForCashback).toHaveBeenCalledWith({ search: undefined }, { skip: 0, take: 20 })
    expect(result.data).toHaveLength(1)
    expect(result.pagination.total).toBe(1)
  })

  it('passes search filter through', async () => {
    mockTripRepo.findCompletedTripsForCashback.mockResolvedValue({ data: [], total: 0 })

    await service.getCompletedTripsForCashback({ search: 'goa', page: 1, limit: 10 })

    expect(mockTripRepo.findCompletedTripsForCashback).toHaveBeenCalledWith({ search: 'goa' }, { skip: 0, take: 10 })
  })
})

describe('AdminService — getTripCashbackDetail', () => {
  it('returns travelers with cashback status for a completed trip', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'COMPLETED', title: 'Goa Beach' })
    const travelers = [makeTravelerItem(), makeTravelerItem({ bookingId: 'bk_2', userId: 'user_2', userName: 'Rahul' })]
    mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue(travelers)

    const result = await service.getTripCashbackDetail('trip_1')

    expect(result).toHaveLength(2)
    expect(mockBookingRepo.findConfirmedByTripForCashback).toHaveBeenCalledWith('trip_1')
  })

  it('throws NotFoundError for non-existent trip', async () => {
    mockTripRepo.findById.mockResolvedValue(null)

    await expect(service.getTripCashbackDetail('nonexistent')).rejects.toThrow('Trip not found')
  })

  it('throws ValidationError if trip is not COMPLETED', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'ACTIVE' })

    await expect(service.getTripCashbackDetail('trip_1')).rejects.toThrow('Cashback can only be issued for completed trips')
  })
})

describe('AdminService — issueCashback', () => {
  const adminUserId = 'admin_1'

  it('issues cashback to selected travelers', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'COMPLETED', title: 'Goa Beach' })
    mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue([
      makeTravelerItem({ bookingId: 'bk_1', userId: 'user_1' }),
      makeTravelerItem({ bookingId: 'bk_2', userId: 'user_2' }),
    ])
    mockWalletService.credit.mockResolvedValue({})

    const result = await service.issueCashback(adminUserId, {
      tripId: 'trip_1',
      items: [
        { bookingId: 'bk_1', userId: 'user_1', amount: 200 },
        { bookingId: 'bk_2', userId: 'user_2', amount: 300 },
      ],
    })

    expect(result).toEqual({ issued: 2, totalAmount: 500 })
    expect(mockWalletService.credit).toHaveBeenCalledTimes(2)
    expect(mockWalletService.credit).toHaveBeenCalledWith({
      userId: 'user_1',
      amount: 200,
      type: 'CASHBACK',
      referenceModel: 'Booking',
      referenceId: 'bk_1',
      description: 'Cashback for trip: Goa Beach',
    })
  })

  it('throws NotFoundError if trip does not exist', async () => {
    mockTripRepo.findById.mockResolvedValue(null)

    await expect(service.issueCashback(adminUserId, { tripId: 'bad', items: [{ bookingId: 'bk_1', userId: 'u1', amount: 100 }] })).rejects.toThrow('Trip not found')
  })

  it('throws ValidationError if trip is not COMPLETED', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'ACTIVE' })

    await expect(service.issueCashback(adminUserId, { tripId: 'trip_1', items: [{ bookingId: 'bk_1', userId: 'u1', amount: 100 }] })).rejects.toThrow('completed trips')
  })

  it('throws ValidationError if booking not found in trip', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'COMPLETED', title: 'Goa' })
    mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue([])

    await expect(service.issueCashback(adminUserId, { tripId: 'trip_1', items: [{ bookingId: 'bk_bad', userId: 'u1', amount: 100 }] })).rejects.toThrow('not found in trip')
  })

  it('throws ValidationError if userId does not match booking', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'COMPLETED', title: 'Goa' })
    mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue([
      makeTravelerItem({ bookingId: 'bk_1', userId: 'user_1' }),
    ])

    await expect(service.issueCashback(adminUserId, { tripId: 'trip_1', items: [{ bookingId: 'bk_1', userId: 'wrong_user', amount: 100 }] })).rejects.toThrow('User mismatch')
  })

  it('throws ValidationError if amount exceeds booking total', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'COMPLETED', title: 'Goa' })
    mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue([
      makeTravelerItem({ bookingId: 'bk_1', userId: 'user_1', totalAmount: 4500 }),
    ])

    await expect(service.issueCashback(adminUserId, { tripId: 'trip_1', items: [{ bookingId: 'bk_1', userId: 'user_1', amount: 9999 }] })).rejects.toThrow('exceeds booking amount')
  })

  it('throws ValidationError if cashback already issued for booking', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'COMPLETED', title: 'Goa' })
    mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue([
      makeTravelerItem({ bookingId: 'bk_1', userId: 'user_1', cashbackIssued: 200, issuedAt: '2026-01-05' }),
    ])

    await expect(service.issueCashback(adminUserId, { tripId: 'trip_1', items: [{ bookingId: 'bk_1', userId: 'user_1', amount: 100 }] })).rejects.toThrow('already issued')
  })
})

describe('AdminService — getCashbackHistoryByUser', () => {
  it('returns paginated cashback grouped by user', async () => {
    const data = [{ userId: 'u1', userName: 'Priya', email: 'p@t.com', totalCashback: 1200, count: 3, latestIssuedAt: '2026-01-05' }]
    mockWalletRepo.getCashbackByUser.mockResolvedValue({ data, total: 1 })

    const result = await service.getCashbackHistoryByUser({ page: 1, limit: 20 })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].totalCashback).toBe(1200)
  })
})

describe('AdminService — getCashbackHistoryByTrip', () => {
  it('returns paginated cashback grouped by trip', async () => {
    const data = [{ tripId: 't1', tripTitle: 'Goa', startDate: '2026-12-06', endDate: '2026-12-08', totalCashback: 3600, travelerCount: 18 }]
    mockWalletRepo.getCashbackByTrip.mockResolvedValue({ data, total: 1 })

    const result = await service.getCashbackHistoryByTrip({ page: 1, limit: 20 })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].travelerCount).toBe(18)
  })
})

describe('AdminService — getCashbackUserDetail', () => {
  it('returns per-user cashback breakdown', async () => {
    const data = [{ bookingId: 'bk_1', tripTitle: 'Goa Beach', bookingAmount: 4500, amount: 200, issuedAt: '2026-01-05' }]
    mockWalletRepo.getCashbackForUserDetail.mockResolvedValue({ data, total: 1 })

    const result = await service.getCashbackUserDetail('user_1', { page: 1, limit: 20 })

    expect(mockWalletRepo.getCashbackForUserDetail).toHaveBeenCalledWith('user_1', { skip: 0, take: 20 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].amount).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════
// CASHBACK — SENIOR EDGE CASES
// ═══════════════════════════════════════════════════════

describe('AdminService — getCompletedTripsForCashback (edge cases)', () => {
  it('uses default page=1, limit=20 when filters omitted', async () => {
    mockTripRepo.findCompletedTripsForCashback.mockResolvedValue({ data: [], total: 0 })

    const result = await service.getCompletedTripsForCashback({})

    expect(mockTripRepo.findCompletedTripsForCashback).toHaveBeenCalledWith(
      { search: undefined },
      { skip: 0, take: 20 },
    )
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 })
  })

  it('computes correct skip for page 3', async () => {
    mockTripRepo.findCompletedTripsForCashback.mockResolvedValue({ data: [], total: 55 })

    const result = await service.getCompletedTripsForCashback({ page: 3, limit: 10 })

    expect(mockTripRepo.findCompletedTripsForCashback).toHaveBeenCalledWith(
      { search: undefined },
      { skip: 20, take: 10 },
    )
    expect(result.pagination.totalPages).toBe(6)
  })

  it('returns totalPages=1 when total equals limit', async () => {
    mockTripRepo.findCompletedTripsForCashback.mockResolvedValue({ data: [{}], total: 20 })

    const result = await service.getCompletedTripsForCashback({ page: 1, limit: 20 })

    expect(result.pagination.totalPages).toBe(1)
  })
})

describe('AdminService — issueCashback (edge cases)', () => {
  const adminUserId = 'admin_1'

  it('issues cashback with amount exactly equal to booking total (boundary)', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'COMPLETED', title: 'Goa' })
    mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue([
      makeTravelerItem({ bookingId: 'bk_1', userId: 'user_1', totalAmount: 4500 }),
    ])
    mockWalletService.credit.mockResolvedValue({})

    const result = await service.issueCashback(adminUserId, {
      tripId: 'trip_1',
      items: [{ bookingId: 'bk_1', userId: 'user_1', amount: 4500 }],
    })

    expect(result).toEqual({ issued: 1, totalAmount: 4500 })
    expect(mockWalletService.credit).toHaveBeenCalledTimes(1)
  })

  it('issues single-item cashback and verifies correct walletService.credit args', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'COMPLETED', title: 'Kerala Backwaters' })
    mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue([
      makeTravelerItem({ bookingId: 'bk_5', userId: 'user_5', totalAmount: 8000 }),
    ])
    mockWalletService.credit.mockResolvedValue({})

    await service.issueCashback(adminUserId, {
      tripId: 'trip_1',
      items: [{ bookingId: 'bk_5', userId: 'user_5', amount: 500 }],
    })

    expect(mockWalletService.credit).toHaveBeenCalledWith({
      userId: 'user_5',
      amount: 500,
      type: 'CASHBACK',
      referenceModel: 'Booking',
      referenceId: 'bk_5',
      description: 'Cashback for trip: Kerala Backwaters',
    })
  })

  it('does not call walletService.credit when first item fails validation', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'COMPLETED', title: 'Goa' })
    mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue([
      makeTravelerItem({ bookingId: 'bk_1', userId: 'user_1', cashbackIssued: 200 }),
      makeTravelerItem({ bookingId: 'bk_2', userId: 'user_2' }),
    ])

    await expect(
      service.issueCashback(adminUserId, {
        tripId: 'trip_1',
        items: [
          { bookingId: 'bk_1', userId: 'user_1', amount: 100 },
          { bookingId: 'bk_2', userId: 'user_2', amount: 200 },
        ],
      }),
    ).rejects.toThrow('already issued')

    expect(mockWalletService.credit).not.toHaveBeenCalled()
  })

  it('second item fails → first was already credited (no rollback)', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'COMPLETED', title: 'Goa' })
    mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue([
      makeTravelerItem({ bookingId: 'bk_1', userId: 'user_1', totalAmount: 4500 }),
      makeTravelerItem({ bookingId: 'bk_2', userId: 'user_2', totalAmount: 3000, cashbackIssued: 100 }),
    ])
    mockWalletService.credit.mockResolvedValue({})

    await expect(
      service.issueCashback(adminUserId, {
        tripId: 'trip_1',
        items: [
          { bookingId: 'bk_1', userId: 'user_1', amount: 200 },
          { bookingId: 'bk_2', userId: 'user_2', amount: 100 },
        ],
      }),
    ).rejects.toThrow('already issued')

    // First credit went through before second item validation failed
    expect(mockWalletService.credit).toHaveBeenCalledTimes(1)
  })

  it('logs issuance with correct admin userId and totals', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'COMPLETED', title: 'Goa' })
    mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue([
      makeTravelerItem({ bookingId: 'bk_1', userId: 'user_1' }),
    ])
    mockWalletService.credit.mockResolvedValue({})
    const logSpy = vi.spyOn(logger, 'info')

    await service.issueCashback(adminUserId, {
      tripId: 'trip_1',
      items: [{ bookingId: 'bk_1', userId: 'user_1', amount: 200 }],
    })

    expect(logSpy).toHaveBeenCalledWith(
      { adminUserId: 'admin_1', tripId: 'trip_1', issued: 1, totalAmount: 200 },
      'Cashback issued',
    )
  })

  it('propagates error when walletService.credit throws', async () => {
    mockTripRepo.findById.mockResolvedValue({ id: 'trip_1', status: 'COMPLETED', title: 'Goa' })
    mockBookingRepo.findConfirmedByTripForCashback.mockResolvedValue([
      makeTravelerItem({ bookingId: 'bk_1', userId: 'user_1' }),
    ])
    mockWalletService.credit.mockRejectedValue(new Error('Wallet not found'))

    await expect(
      service.issueCashback(adminUserId, {
        tripId: 'trip_1',
        items: [{ bookingId: 'bk_1', userId: 'user_1', amount: 200 }],
      }),
    ).rejects.toThrow('Wallet not found')
  })
})

describe('AdminService — getCashbackHistoryByUser (edge cases)', () => {
  it('returns empty data with correct pagination when no cashback exists', async () => {
    mockWalletRepo.getCashbackByUser.mockResolvedValue({ data: [], total: 0 })

    const result = await service.getCashbackHistoryByUser({ page: 1, limit: 20 })

    expect(result.data).toEqual([])
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 })
  })

  it('uses default page=1, limit=20 when not provided', async () => {
    mockWalletRepo.getCashbackByUser.mockResolvedValue({ data: [], total: 0 })

    await service.getCashbackHistoryByUser({})

    expect(mockWalletRepo.getCashbackByUser).toHaveBeenCalledWith({ skip: 0, take: 20 })
  })

  it('computes correct skip for page 2 with limit 5', async () => {
    mockWalletRepo.getCashbackByUser.mockResolvedValue({ data: [], total: 12 })

    const result = await service.getCashbackHistoryByUser({ page: 2, limit: 5 })

    expect(mockWalletRepo.getCashbackByUser).toHaveBeenCalledWith({ skip: 5, take: 5 })
    expect(result.pagination.totalPages).toBe(3)
  })
})

describe('AdminService — getCashbackHistoryByTrip (edge cases)', () => {
  it('returns empty data when no trips have cashback', async () => {
    mockWalletRepo.getCashbackByTrip.mockResolvedValue({ data: [], total: 0 })

    const result = await service.getCashbackHistoryByTrip({ page: 1, limit: 20 })

    expect(result.data).toEqual([])
    expect(result.pagination.totalPages).toBe(0)
  })

  it('defaults page and limit when filter is empty', async () => {
    mockWalletRepo.getCashbackByTrip.mockResolvedValue({ data: [], total: 0 })

    await service.getCashbackHistoryByTrip({})

    expect(mockWalletRepo.getCashbackByTrip).toHaveBeenCalledWith({ skip: 0, take: 20 })
  })
})

describe('AdminService — getCashbackUserDetail (edge cases)', () => {
  it('returns empty when user has no cashback', async () => {
    mockWalletRepo.getCashbackForUserDetail.mockResolvedValue({ data: [], total: 0 })

    const result = await service.getCashbackUserDetail('user_99', { page: 1, limit: 20 })

    expect(result.data).toEqual([])
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 })
  })

  it('computes correct skip and totalPages for large dataset', async () => {
    mockWalletRepo.getCashbackForUserDetail.mockResolvedValue({ data: [], total: 47 })

    const result = await service.getCashbackUserDetail('user_1', { page: 3, limit: 10 })

    expect(mockWalletRepo.getCashbackForUserDetail).toHaveBeenCalledWith('user_1', { skip: 20, take: 10 })
    expect(result.pagination.totalPages).toBe(5)
  })

  it('defaults to page=1, limit=20 when filters empty', async () => {
    mockWalletRepo.getCashbackForUserDetail.mockResolvedValue({ data: [], total: 0 })

    await service.getCashbackUserDetail('user_1', {})

    expect(mockWalletRepo.getCashbackForUserDetail).toHaveBeenCalledWith('user_1', { skip: 0, take: 20 })
  })
})

// ═══════════════════════════════════════════════════════
// Document Review
// ═══════════════════════════════════════════════════════

describe('AdminService — reviewDocument', () => {
  it('approves a document and auto-approves organizer when all 3 docs are approved', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(makeOrganizerProfile())
    mockDocReviewRepo.upsert.mockResolvedValue({})
    mockDocReviewRepo.countApproved.mockResolvedValue(3)
    mockOrganizerProfileRepo.update.mockResolvedValue({})

    const result = await service.reviewDocument('admin_1', 'org_1', 'aadhaarFront', { action: 'APPROVED' })

    expect(result).toEqual({ organizerId: 'org_1', docType: 'aadhaarFront', status: 'APPROVED' })
    expect(mockDocReviewRepo.upsert).toHaveBeenCalledWith('org_1', 'aadhaarFront', expect.objectContaining({ status: 'APPROVED', reviewedBy: 'admin_1' }))
    expect(mockOrganizerProfileRepo.update).toHaveBeenCalledWith('org_1', { verificationStatus: 'APPROVED' })
    expect(mockNotificationService.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'ORGANIZER_APPROVED' }))
  })

  it('approves a document but does NOT auto-approve when fewer than 3 approved', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(makeOrganizerProfile())
    mockDocReviewRepo.upsert.mockResolvedValue({})
    mockDocReviewRepo.countApproved.mockResolvedValue(2)

    await service.reviewDocument('admin_1', 'org_1', 'aadhaarFront', { action: 'APPROVED' })

    expect(mockOrganizerProfileRepo.update).not.toHaveBeenCalled()
    expect(mockNotificationService.send).not.toHaveBeenCalled()
  })

  it('rejects a document and sets REVISION_REQUIRED + sends notification', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(makeOrganizerProfile())
    mockDocReviewRepo.upsert.mockResolvedValue({})
    mockOrganizerProfileRepo.update.mockResolvedValue({})

    const result = await service.reviewDocument('admin_1', 'org_1', 'panCard', {
      action: 'REJECTED',
      comment: 'Blurry image',
    })

    expect(result.status).toBe('REJECTED')
    expect(mockOrganizerProfileRepo.update).toHaveBeenCalledWith('org_1', { verificationStatus: 'REVISION_REQUIRED' })
    expect(mockDocReviewRepo.addComment).toHaveBeenCalledWith(expect.objectContaining({
      organizerId: 'org_1',
      authorRole: 'ADMIN',
      docType: 'panCard',
      comment: 'Blurry image',
    }))
    expect(mockNotificationService.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'DOCUMENT_REUPLOAD_REQUIRED' }))
  })

  it('throws NotFoundError for unknown organizer', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(null)

    await expect(service.reviewDocument('admin_1', 'org_99', 'aadhaarFront', { action: 'APPROVED' }))
      .rejects.toThrow('not found')
  })
})

describe('AdminService — addDocComment', () => {
  it('adds a comment to the organizer review thread and notifies', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(makeOrganizerProfile())
    mockDocReviewRepo.addComment.mockResolvedValue({ id: 'comment_1', comment: 'Looks good' })
    mockNotificationService.send.mockResolvedValue(undefined)

    const result = await service.addDocComment('admin_1', 'ADMIN', 'org_1', { comment: 'Looks good' })

    expect(result.id).toBe('comment_1')
    expect(mockDocReviewRepo.addComment).toHaveBeenCalledWith(expect.objectContaining({
      organizerId: 'org_1',
      authorId: 'admin_1',
      authorRole: 'ADMIN',
      comment: 'Looks good',
    }))
    expect(mockNotificationService.send).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      type: 'ADMIN_SUPPORT_MESSAGE',
      title: 'New comment on your document review',
    }))
  })

  it('throws NotFoundError for unknown organizer', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(null)

    await expect(service.addDocComment('admin_1', 'ADMIN', 'org_99', { comment: 'test' }))
      .rejects.toThrow('not found')
  })
})

describe('AdminService — reviewDocument (edge cases)', () => {
  it('rejects a document without comment — does NOT call addComment', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(makeOrganizerProfile())
    mockDocReviewRepo.upsert.mockResolvedValue({})
    mockOrganizerProfileRepo.update.mockResolvedValue({})

    await service.reviewDocument('admin_1', 'org_1', 'aadhaarBack', { action: 'REJECTED' })

    expect(mockDocReviewRepo.addComment).not.toHaveBeenCalled()
    expect(mockOrganizerProfileRepo.update).toHaveBeenCalledWith('org_1', { verificationStatus: 'REVISION_REQUIRED' })
    expect(mockNotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DOCUMENT_REUPLOAD_REQUIRED',
        body: expect.stringContaining('Please re-upload a clearer document'),
      }),
    )
  })

  it('approves a document and adds comment when provided', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(makeOrganizerProfile())
    mockDocReviewRepo.upsert.mockResolvedValue({})
    mockDocReviewRepo.countApproved.mockResolvedValue(1)

    await service.reviewDocument('admin_1', 'org_1', 'aadhaarFront', {
      action: 'APPROVED',
      comment: 'Clear document',
    })

    expect(mockDocReviewRepo.addComment).toHaveBeenCalledWith(expect.objectContaining({
      organizerId: 'org_1',
      authorRole: 'ADMIN',
      comment: 'Clear document',
    }))
  })
})

describe('AdminService — addDocComment (edge cases)', () => {
  it('does NOT notify when comment is from ORGANIZER role', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(makeOrganizerProfile())
    mockDocReviewRepo.addComment.mockResolvedValue({ id: 'c_2', comment: 'Updated doc' })

    await service.addDocComment('user_1', 'ORGANIZER', 'org_1', { comment: 'Updated doc' })

    expect(mockNotificationService.send).not.toHaveBeenCalled()
  })

  it('passes docType and attachmentUrl through to repo', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(makeOrganizerProfile())
    mockDocReviewRepo.addComment.mockResolvedValue({ id: 'c_3' })

    await service.addDocComment('admin_1', 'ADMIN', 'org_1', {
      comment: 'See attachment',
      docType: 'panCard',
      attachmentUrl: 'https://example.com/ref.jpg',
    })

    expect(mockDocReviewRepo.addComment).toHaveBeenCalledWith(expect.objectContaining({
      docType: 'panCard',
      attachmentUrl: 'https://example.com/ref.jpg',
    }))
  })
})

describe('AdminService — approveOrReject doc status sync', () => {
  it('bulk-approves all doc reviews when organizer is approved', async () => {
    const profile = makeOrganizerProfile({ verificationStatus: 'PENDING' })
    mockOrganizerProfileRepo.findById.mockResolvedValue(profile)
    mockOrganizerProfileRepo.update.mockResolvedValue({})

    await service.approveOrReject('org_1', { action: 'APPROVED' })

    expect(mockDocReviewRepo.updateAllDocStatuses).toHaveBeenCalledWith('org_1', 'APPROVED')
  })

  it('bulk-rejects all doc reviews when organizer is rejected', async () => {
    const profile = makeOrganizerProfile({ verificationStatus: 'PENDING' })
    mockOrganizerProfileRepo.findById.mockResolvedValue(profile)
    mockOrganizerProfileRepo.update.mockResolvedValue({})

    await service.approveOrReject('org_1', { action: 'REJECTED', reason: 'Fake docs' })

    expect(mockDocReviewRepo.updateAllDocStatuses).toHaveBeenCalledWith('org_1', 'REJECTED')
  })
})

describe('AdminService — getDocReviewDetail', () => {
  it('returns organizer profile with doc reviews and resolved author names', async () => {
    const profile = makeOrganizerProfile({
      documentReviews: [
        { id: 'dr_1', docType: 'aadhaarFront', status: 'APPROVED', currentUrl: 'url1', reviewedAt: new Date(), reviewedBy: 'admin_1' },
      ],
    })
    mockOrganizerProfileRepo.findByIdAdmin.mockResolvedValue(profile)
    mockDocReviewRepo.findComments.mockResolvedValue({
      data: [{
        id: 'c_1', authorId: 'admin_1', authorRole: 'ADMIN', docType: 'aadhaarFront',
        comment: 'Verified', attachmentUrl: null, createdAt: new Date('2026-05-10'),
      }],
      total: 1,
    })
    mockUserRepo.findByIds.mockResolvedValue([{ id: 'admin_1', name: 'Super Admin' }])

    const result = await service.getDocReviewDetail('org_1')

    expect(result.reviewComments).toHaveLength(1)
    expect(result.reviewComments[0].comment).toBe('Verified')
    expect(result.reviewComments[0].authorName).toBe('Super Admin')
    expect(result.reviewComments[0].createdAt).toBe('2026-05-10T00:00:00.000Z')
    expect(mockUserRepo.findByIds).toHaveBeenCalledWith(['admin_1'])
  })

  it('falls back to role-based author name when user not found in DB', async () => {
    const profile = makeOrganizerProfile()
    mockOrganizerProfileRepo.findByIdAdmin.mockResolvedValue(profile)
    mockDocReviewRepo.findComments.mockResolvedValue({
      data: [
        { id: 'c_1', organizerId: 'org_1', authorId: 'unknown_admin', authorRole: 'ADMIN', docType: null, comment: 'Check', attachmentUrl: null, createdAt: new Date('2026-05-10') },
        { id: 'c_2', organizerId: 'org_1', authorId: 'unknown_org', authorRole: 'ORGANIZER', docType: null, comment: 'Done', attachmentUrl: null, createdAt: new Date('2026-05-11') },
      ],
      total: 2,
    })
    mockUserRepo.findByIds.mockResolvedValue([])

    const result = await service.getDocReviewDetail('org_1')

    expect(result.reviewComments[0].authorName).toBe('Admin')
    expect(result.reviewComments[1].authorName).toBe('Organizer')
  })

  it('returns empty reviewComments when no comments exist', async () => {
    mockOrganizerProfileRepo.findByIdAdmin.mockResolvedValue(makeOrganizerProfile())
    mockDocReviewRepo.findComments.mockResolvedValue({ data: [], total: 0 })
    mockUserRepo.findByIds.mockResolvedValue([])

    const result = await service.getDocReviewDetail('org_1')

    expect(result.reviewComments).toEqual([])
    expect(mockUserRepo.findByIds).toHaveBeenCalledWith([])
  })

  it('throws NotFoundError for unknown organizer', async () => {
    mockOrganizerProfileRepo.findByIdAdmin.mockResolvedValue(null)

    await expect(service.getDocReviewDetail('org_99')).rejects.toThrow('not found')
  })
})
