import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TripService } from '../../../src/services/trip.service'
import { logger } from '../../../src/utils/logger'

// ── Mock Repos ──────────────────────────────────────────

const mockTripRepo = {
  findById: vi.fn(),
  search: vi.fn(),
  findBySlug: vi.fn(),
  findByOrganizerId: vi.fn(),
  slugExists: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  withTransaction: vi.fn(),
  calculateOrganizerRevenue: vi.fn(),
  countPendingRequests: vi.fn(),
}

const mockDestinationRepo = {
  findById: vi.fn(),
  incrementTripCount: vi.fn(),
  decrementTripCount: vi.fn(),
}

const mockOrganizerProfileRepo = {
  findByUserId: vi.fn(),
}

const mockEditHistoryRepo = {
  create: vi.fn(),
  findByTripId: vi.fn(),
}

const mockBookingRepo = {
  findByTripId: vi.fn(),
  getTripBookingSummary: vi.fn(),
}

const mockTripRequestRepo = {
  findByTripId: vi.fn(),
  findById: vi.fn(),
  updateStatus: vi.fn(),
  findAllPendingForOrganizer: vi.fn(),
}

// ── Test Data Factories ─────────────────────────────────

const mockOrganizer = {
  id: 'org-1',
  userId: 'user-1',
  businessName: 'TripVibes',
  verificationStatus: 'APPROVED',
  rating: 4.5,
  totalReviews: 20,
}

const mockTrip = {
  id: 'trip-1',
  title: 'Goa Beach Getaway',
  slug: 'goa-beach-getaway-dec-2025',
  destinationId: 'dest-1',
  organizerId: 'org-1',
  tripType: 'BEACH',
  bookingMode: 'REQUEST_BASED',
  pricePerPerson: 4500,
  startDate: new Date('2025-12-06'),
  endDate: new Date('2025-12-08'),
  minGroupSize: 10,
  maxGroupSize: 20,
  currentBookings: 12,
  status: 'ACTIVE',
  photos: ['https://example.com/trip.jpg'],
}

function createMockBooking(overrides = {}) {
  return {
    id: 'booking-1',
    bookingRef: 'BK-ABC123',
    bookingStatus: 'CONFIRMED',
    numTravelers: 2,
    totalAmount: 9000,
    createdAt: new Date('2025-11-20'),
    user: { id: 'user-10', name: 'Rahul Sharma', email: 'rahul@test.com', avatarUrl: null },
    travelerDetails: [
      { id: 'td-1', name: 'Rahul Sharma', phone: '9876543210', age: 28, gender: 'MALE', isPrimary: true },
      { id: 'td-2', name: 'Priya Sharma', phone: '9876543211', age: 26, gender: 'FEMALE', isPrimary: false },
    ],
    ...overrides,
  }
}

function createMockRequest(overrides = {}) {
  return {
    id: 'req-1',
    tripId: 'trip-1',
    numTravelers: 3,
    message: 'We would love to join!',
    status: 'PENDING',
    createdAt: new Date('2025-11-21'),
    respondedAt: null,
    responseNote: null,
    approvalExpiresAt: null,
    user: { id: 'user-20', name: 'Amit Kumar', email: 'amit@test.com', avatarUrl: null },
    ...overrides,
  }
}

// ── Setup ───────────────────────────────────────────────

let service: TripService

beforeEach(() => {
  vi.clearAllMocks()
  service = new TripService(
    mockTripRepo as any,
    mockDestinationRepo as any,
    mockOrganizerProfileRepo as any,
    mockEditHistoryRepo as any,
    mockBookingRepo as any,
    mockTripRequestRepo as any,
    {} as any,
    logger as any,
    { send: vi.fn().mockResolvedValue([]) } as any,
  )
})

// ── Helper: sets up ownership verification to succeed ───
function setupOwnership() {
  mockTripRepo.findById.mockResolvedValue(mockTrip)
  mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
}

// ── Tests ───────────────────────────────────────────────

describe('TripService — Trip Participants Dashboard', () => {
  // ─── getTripBookings ──────────────────────────────────

  describe('getTripBookings', () => {
    it('should return paginated booking list with user and traveler details', async () => {
      setupOwnership()
      const booking = createMockBooking()
      mockBookingRepo.findByTripId.mockResolvedValue({ data: [booking], total: 1 })

      const result = await service.getTripBookings('user-1', 'trip-1', { page: 1, limit: 10 })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].bookingRef).toBe('BK-ABC123')
      expect(result.data[0].user.name).toBe('Rahul Sharma')
      expect(result.data[0].travelerDetails).toHaveLength(2)
      expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 })
      expect(mockBookingRepo.findByTripId).toHaveBeenCalledWith(
        'trip-1',
        expect.anything(),
        { offset: 0, limit: 10 },
      )
    })

    it('should throw NotFoundError when trip does not exist', async () => {
      mockTripRepo.findById.mockResolvedValue(null)

      await expect(
        service.getTripBookings('user-1', 'trip-999', {}),
      ).rejects.toThrow('not found')
    })

    it('should throw ForbiddenError when user does not own the trip', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({
        ...mockOrganizer,
        id: 'org-other',
      })

      await expect(
        service.getTripBookings('user-2', 'trip-1', {}),
      ).rejects.toThrow('your own trips')
    })

    it('should return empty array and total=0 when no bookings exist', async () => {
      setupOwnership()
      mockBookingRepo.findByTripId.mockResolvedValue({ data: [], total: 0 })

      const result = await service.getTripBookings('user-1', 'trip-1', {})

      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
      expect(result.pagination.totalPages).toBe(0)
    })

    it('should pass bookingStatus filter to repository', async () => {
      setupOwnership()
      mockBookingRepo.findByTripId.mockResolvedValue({ data: [], total: 0 })

      await service.getTripBookings('user-1', 'trip-1', { bookingStatus: 'CONFIRMED' })

      expect(mockBookingRepo.findByTripId).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({ bookingStatus: 'CONFIRMED' }),
        expect.anything(),
      )
    })

    it('should pass search filter to repository', async () => {
      setupOwnership()
      mockBookingRepo.findByTripId.mockResolvedValue({ data: [], total: 0 })

      await service.getTripBookings('user-1', 'trip-1', { search: 'Rahul' })

      expect(mockBookingRepo.findByTripId).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({ search: 'Rahul' }),
        expect.anything(),
      )
    })

    it('should apply correct pagination offset and cap limit', async () => {
      setupOwnership()
      mockBookingRepo.findByTripId.mockResolvedValue({ data: [], total: 0 })

      await service.getTripBookings('user-1', 'trip-1', { page: 3, limit: 100 })

      expect(mockBookingRepo.findByTripId).toHaveBeenCalledWith(
        'trip-1',
        expect.anything(),
        { offset: 100, limit: 50 },
      )
    })
  })

  // ─── getTripRequests ──────────────────────────────────

  describe('getTripRequests', () => {
    it('should return paginated request list with user details', async () => {
      setupOwnership()
      const request = createMockRequest()
      mockTripRequestRepo.findByTripId.mockResolvedValue({ data: [request], total: 1 })

      const result = await service.getTripRequests('user-1', 'trip-1', { page: 1, limit: 10 })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].user.name).toBe('Amit Kumar')
      expect(result.data[0].status).toBe('PENDING')
      expect(result.data[0].message).toBe('We would love to join!')
      expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 })
    })

    it('should throw NotFoundError when trip does not exist', async () => {
      mockTripRepo.findById.mockResolvedValue(null)

      await expect(
        service.getTripRequests('user-1', 'trip-999', {}),
      ).rejects.toThrow('not found')
    })

    it('should throw ForbiddenError when user does not own the trip', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({
        ...mockOrganizer,
        id: 'org-other',
      })

      await expect(
        service.getTripRequests('user-2', 'trip-1', {}),
      ).rejects.toThrow('your own trips')
    })

    it('should return empty array when no requests exist', async () => {
      setupOwnership()
      mockTripRequestRepo.findByTripId.mockResolvedValue({ data: [], total: 0 })

      const result = await service.getTripRequests('user-1', 'trip-1', {})

      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
    })

    it('should pass status filter to repository', async () => {
      setupOwnership()
      mockTripRequestRepo.findByTripId.mockResolvedValue({ data: [], total: 0 })

      await service.getTripRequests('user-1', 'trip-1', { status: 'PENDING' })

      expect(mockTripRequestRepo.findByTripId).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({ status: 'PENDING' }),
        expect.anything(),
      )
    })

    it('should pass search filter to repository', async () => {
      setupOwnership()
      mockTripRequestRepo.findByTripId.mockResolvedValue({ data: [], total: 0 })

      await service.getTripRequests('user-1', 'trip-1', { search: 'Amit' })

      expect(mockTripRequestRepo.findByTripId).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({ search: 'Amit' }),
        expect.anything(),
      )
    })
  })

  // ─── getTripBookingSummary ────────────────────────────

  describe('getTripBookingSummary', () => {
    it('should return correct summary stats', async () => {
      setupOwnership()
      mockBookingRepo.getTripBookingSummary.mockResolvedValue({
        confirmedCount: 6,
        totalTravelers: 12,
        revenue: 54000,
        pendingRequestsCount: 3,
      })

      const result = await service.getTripBookingSummary('user-1', 'trip-1')

      expect(result.confirmedCount).toBe(6)
      expect(result.totalTravelers).toBe(12)
      expect(result.revenue).toBe(54000)
      expect(result.pendingRequestsCount).toBe(3)
      expect(result.maxGroupSize).toBe(20)
      expect(result.seatsLeft).toBe(8)
    })

    it('should throw NotFoundError when trip does not exist', async () => {
      mockTripRepo.findById.mockResolvedValue(null)

      await expect(
        service.getTripBookingSummary('user-1', 'trip-999'),
      ).rejects.toThrow('not found')
    })

    it('should throw ForbiddenError when user does not own the trip', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({
        ...mockOrganizer,
        id: 'org-other',
      })

      await expect(
        service.getTripBookingSummary('user-2', 'trip-1'),
      ).rejects.toThrow('your own trips')
    })

    it('should return zero stats when no bookings exist', async () => {
      setupOwnership()
      mockBookingRepo.getTripBookingSummary.mockResolvedValue({
        confirmedCount: 0,
        totalTravelers: 0,
        revenue: 0,
        pendingRequestsCount: 0,
      })

      const result = await service.getTripBookingSummary('user-1', 'trip-1')

      expect(result.confirmedCount).toBe(0)
      expect(result.totalTravelers).toBe(0)
      expect(result.revenue).toBe(0)
      expect(result.seatsLeft).toBe(8)
    })
  })

  // ─── respondToTripRequest ─────────────────────────────

  describe('respondToTripRequest', () => {
    it('should approve a pending request and set approvalExpiresAt', async () => {
      setupOwnership()
      const request = createMockRequest()
      mockTripRequestRepo.findById.mockResolvedValue(request)
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      const updatedRequest = { ...request, status: 'APPROVED', respondedAt: new Date(), approvalExpiresAt: new Date() }
      mockTripRequestRepo.updateStatus.mockResolvedValue(updatedRequest)

      const result = await service.respondToTripRequest('user-1', 'trip-1', 'req-1', 'APPROVED')

      expect(mockTripRequestRepo.updateStatus).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({
          status: 'APPROVED',
          approvalExpiresAt: expect.any(Date),
        }),
      )
      expect(result.status).toBe('APPROVED')
    })

    it('should reject a pending request with responseNote', async () => {
      setupOwnership()
      const request = createMockRequest()
      mockTripRequestRepo.findById.mockResolvedValue(request)
      const updatedRequest = { ...request, status: 'REJECTED', responseNote: 'Group is full', respondedAt: new Date() }
      mockTripRequestRepo.updateStatus.mockResolvedValue(updatedRequest)

      const result = await service.respondToTripRequest('user-1', 'trip-1', 'req-1', 'REJECTED', 'Group is full')

      expect(mockTripRequestRepo.updateStatus).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({
          status: 'REJECTED',
          responseNote: 'Group is full',
        }),
      )
      expect(result.status).toBe('REJECTED')
      expect(result.responseNote).toBe('Group is full')
    })

    it('should throw NotFoundError when trip does not exist', async () => {
      mockTripRepo.findById.mockResolvedValue(null)

      await expect(
        service.respondToTripRequest('user-1', 'trip-999', 'req-1', 'APPROVED'),
      ).rejects.toThrow('not found')
    })

    it('should throw NotFoundError when request does not exist', async () => {
      setupOwnership()
      mockTripRequestRepo.findById.mockResolvedValue(null)

      await expect(
        service.respondToTripRequest('user-1', 'trip-1', 'req-999', 'APPROVED'),
      ).rejects.toThrow('not found')
    })

    it('should throw ForbiddenError when user does not own the trip', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({
        ...mockOrganizer,
        id: 'org-other',
      })

      await expect(
        service.respondToTripRequest('user-2', 'trip-1', 'req-1', 'APPROVED'),
      ).rejects.toThrow('your own trips')
    })

    it('should throw ValidationError when request is not PENDING', async () => {
      setupOwnership()
      const request = createMockRequest({ status: 'APPROVED' })
      mockTripRequestRepo.findById.mockResolvedValue(request)

      await expect(
        service.respondToTripRequest('user-1', 'trip-1', 'req-1', 'REJECTED'),
      ).rejects.toThrow('Only PENDING')
    })

    it('should throw ValidationError when approving with no seats left', async () => {
      setupOwnership()
      const request = createMockRequest({ numTravelers: 10 })
      mockTripRequestRepo.findById.mockResolvedValue(request)
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, currentBookings: 18 })

      await expect(
        service.respondToTripRequest('user-1', 'trip-1', 'req-1', 'APPROVED'),
      ).rejects.toThrow('Not enough seats')
    })
  })

  // ─── getAllPendingRequests ─────────────────────────────

  describe('getAllPendingRequests', () => {
    it('should return pending requests with trip context when organizer has pending requests', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      const request = createMockRequest({
        trip: { id: 'trip-1', title: 'Goa Beach Getaway', slug: 'goa-beach-getaway-dec-2025' },
      })
      mockTripRequestRepo.findAllPendingForOrganizer.mockResolvedValue([request])

      const result = await service.getAllPendingRequests('user-1')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('req-1')
      expect(result[0].numTravelers).toBe(3)
      expect(result[0].user.name).toBe('Amit Kumar')
      expect(result[0].trip).toEqual({ id: 'trip-1', title: 'Goa Beach Getaway', slug: 'goa-beach-getaway-dec-2025' })
      expect(mockTripRequestRepo.findAllPendingForOrganizer).toHaveBeenCalledWith('org-1')
    })

    it('should return empty array when no pending requests exist', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRequestRepo.findAllPendingForOrganizer.mockResolvedValue([])

      const result = await service.getAllPendingRequests('user-1')

      expect(result).toEqual([])
    })

    it('should throw ForbiddenError when organizer profile not found', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(null)

      await expect(
        service.getAllPendingRequests('user-1'),
      ).rejects.toThrow('Organizer profile not found')
    })
  })
})
