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
}

const mockBookingRepo = {
  countByStatusAdmin: vi.fn(),
  getRevenueTrend: vi.fn(),
  findAllAdmin: vi.fn(),
  findByIdAdmin: vi.fn(),
}

const mockTripRepo = {
  countByStatus: vi.fn(),
  countByType: vi.fn(),
}

const mockPaymentTxRepo = {
  getGlobalSummary: vi.fn(),
}

const mockMessageRepo = {
  countFlagged: vi.fn(),
}

const mockNotificationRepo = {
  create: vi.fn(),
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
    mockNotificationRepo as any,
    logger as any,
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
    mockNotificationRepo.create.mockResolvedValue({})

    const result = await service.approveOrReject('org_1', { action: 'APPROVED' })

    expect(result.status).toBe('APPROVED')
    expect(mockOrganizerProfileRepo.update).toHaveBeenCalledWith('org_1', { verificationStatus: 'APPROVED' })
  })

  it('rejects PENDING organizer with reason', async () => {
    const profile = makeOrganizerProfile({ verificationStatus: 'PENDING' })
    mockOrganizerProfileRepo.findById.mockResolvedValue(profile)
    mockOrganizerProfileRepo.update.mockResolvedValue({ ...profile, verificationStatus: 'REJECTED' })
    mockNotificationRepo.create.mockResolvedValue({})

    const result = await service.approveOrReject('org_1', { action: 'REJECTED', reason: 'Incomplete docs' })

    expect(result.status).toBe('REJECTED')
    expect(mockOrganizerProfileRepo.update).toHaveBeenCalledWith('org_1', { verificationStatus: 'REJECTED' })
  })

  it('creates ORGANIZER_APPROVED notification on approve', async () => {
    const profile = makeOrganizerProfile({ verificationStatus: 'PENDING' })
    mockOrganizerProfileRepo.findById.mockResolvedValue(profile)
    mockOrganizerProfileRepo.update.mockResolvedValue({})
    mockNotificationRepo.create.mockResolvedValue({})

    await service.approveOrReject('org_1', { action: 'APPROVED' })

    expect(mockNotificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        type: 'ORGANIZER_APPROVED',
        channel: 'IN_APP',
      }),
    )
  })

  it('creates ORGANIZER_REJECTED notification on reject', async () => {
    const profile = makeOrganizerProfile({ verificationStatus: 'PENDING' })
    mockOrganizerProfileRepo.findById.mockResolvedValue(profile)
    mockOrganizerProfileRepo.update.mockResolvedValue({})
    mockNotificationRepo.create.mockResolvedValue({})

    await service.approveOrReject('org_1', { action: 'REJECTED', reason: 'Bad docs' })

    expect(mockNotificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        type: 'ORGANIZER_REJECTED',
        channel: 'IN_APP',
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
