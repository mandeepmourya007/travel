import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TripService } from '../../../src/services/trip.service'
import { logger } from '../../../src/utils/logger'

const mockTx = {
  trip: { update: vi.fn() },
  destination: { update: vi.fn() },
  tripTransferPoint: { updateMany: vi.fn(), createMany: vi.fn() },
}

const mockTripRepo = {
  search: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findByOrganizerId: vi.fn(),
  findByIdLite: vi.fn(),
  slugExists: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  withTransaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  calculateOrganizerRevenue: vi.fn(),
  countPendingRequests: vi.fn(),
  countByOrganizerId: vi.fn(),
  sumBookingsByOrganizerId: vi.fn(),
  findByOrganizerIdPaginated: vi.fn(),
}

const mockDestinationRepo = {
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findByName: vi.fn(),
  create: vi.fn(),
  incrementTripCount: vi.fn(),
  decrementTripCount: vi.fn(),
}

const mockOrganizerProfileRepo = {
  findByUserId: vi.fn(),
  findByIdPublic: vi.fn(),
  findBySlugPublic: vi.fn(),
}

const mockReviewRepo = {
  findByOrganizerId: vi.fn(),
  getOrganizerRatingStats: vi.fn(),
  getRatingDistributionByOrganizer: vi.fn(),
}

const mockEditHistoryRepo = {
  create: vi.fn(),
  findByTripId: vi.fn(),
}

let service: TripService

const mockOrganizer = {
  id: 'org-1',
  userId: 'user-1',
  businessName: 'TripVibes',
  verificationStatus: 'APPROVED',
  rating: 4.5,
  totalReviews: 20,
  documents: { aadhaarFront: 'https://example.com/front.jpg', aadhaarBack: 'https://example.com/back.jpg', panCard: 'https://example.com/pan.jpg' },
  bankAccountLinked: true,
}

const MOCK_DEST_ID = 'clh1234567890abcdefghijkl'

const mockDestination = {
  id: MOCK_DEST_ID,
  name: 'Goa',
  slug: 'goa',
}

const mockTrip = {
  id: 'trip-1',
  title: 'Goa Beach Getaway',
  slug: 'goa-beach-getaway-dec-2025',
  destinationId: MOCK_DEST_ID,
  organizerId: 'org-1',
  tripType: 'BEACH',
  bookingMode: 'INSTANT',
  description: 'An amazing beach trip to Goa with water sports and parties.',
  pricePerPerson: 4500,
  startDate: new Date('2025-12-06'),
  endDate: new Date('2025-12-08'),
  minGroupSize: 10,
  maxGroupSize: 20,
  currentBookings: 5,
  status: 'DRAFT',
  photos: [],
  inclusions: ['transport', 'stay'],
  exclusions: ['insurance'],
  itinerary: [],
  cancellationPolicy: 'FLEXIBLE',
  transferPoints: [
    { id: 'tp-1', type: 'PICKUP', label: 'Pune Station', address: null, time: '06:00 AM', extraCharge: 0, sortOrder: 0 },
    { id: 'tp-2', type: 'DROP', label: 'Pune Station', address: null, time: '08:00 PM', extraCharge: 0, sortOrder: 0 },
  ],
  destination: mockDestination,
  organizer: { ...mockOrganizer, verificationStatus: 'APPROVED' },
}

beforeEach(() => {
  vi.clearAllMocks()
  service = new TripService(
    mockTripRepo as any,
    mockDestinationRepo as any,
    mockOrganizerProfileRepo as any,
    mockEditHistoryRepo as any,
    {} as any,
    {} as any,
    mockReviewRepo as any,
    logger as any,
    { send: vi.fn().mockResolvedValue([]) } as any,
  )
})

describe('TripService', () => {
  describe('searchTrips', () => {
    it('should return paginated trips', async () => {
      mockTripRepo.search.mockResolvedValue({
        data: [mockTrip],
        total: 1,
      })

      const result = await service.searchTrips({ page: 1, limit: 10 })

      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
      expect(result.pagination.totalPages).toBe(1)
      expect(mockTripRepo.search).toHaveBeenCalledWith(
        expect.anything(),
        { offset: 0, limit: 10 },
      )
    })

    it('should cap limit to maxLimit', async () => {
      mockTripRepo.search.mockResolvedValue({ data: [], total: 0 })

      await service.searchTrips({ limit: 100 })

      expect(mockTripRepo.search).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: 50 }),
      )
    })
  })

  describe('getTripBySlug', () => {
    it('should return trip detail by slug', async () => {
      mockTripRepo.findBySlug.mockResolvedValue(mockTrip)

      const result = await service.getTripBySlug('goa-beach-getaway-dec-2025')

      expect(result.title).toBe('Goa Beach Getaway')
      expect(result.destination.name).toBe('Goa')
    })

    it('should split transfer points into pickupPoints and dropPoints', async () => {
      mockTripRepo.findBySlug.mockResolvedValue(mockTrip)

      const result = await service.getTripBySlug('goa-beach-getaway-dec-2025')

      expect(result.pickupPoints).toHaveLength(1)
      expect(result.pickupPoints[0].label).toBe('Pune Station')
      expect(result.dropPoints).toHaveLength(1)
      expect(result.dropPoints[0].type).toBe('DROP')
    })

    it('should throw NotFoundError for non-existent slug', async () => {
      mockTripRepo.findBySlug.mockResolvedValue(null)

      await expect(service.getTripBySlug('nonexistent')).rejects.toThrow('Trip not found')
    })
  })

  describe('createTrip', () => {
    const createInput = {
      title: 'Goa Beach Getaway',
      destinationId: MOCK_DEST_ID,
      tripType: 'BEACH',
      bookingMode: 'INSTANT',
      description: 'An amazing beach trip to Goa with water sports and parties.',
      startDate: '2026-12-06T00:00:00.000Z',
      endDate: '2026-12-08T00:00:00.000Z',
      pricePerPerson: 4500,
      minGroupSize: 10,
      maxGroupSize: 20,
      cancellationPolicy: 'FLEXIBLE',
      inclusions: ['transport', 'stay'],
      exclusions: ['insurance'],
      itinerary: [],
      photos: [],
      pickupPoints: [{ label: 'Pune Station', time: '06:00 AM' }],
      dropPoints: [{ label: 'Pune Station', time: '08:00 PM' }],
    }

    it('should create a trip for an approved organizer', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockDestinationRepo.findBySlug.mockResolvedValue(mockDestination)
      mockTripRepo.slugExists.mockResolvedValue(false)
      mockTripRepo.create.mockResolvedValue(mockTrip)

      const result = await service.createTrip('user-1', createInput)

      expect(result.title).toBe('Goa Beach Getaway')
      expect(mockTripRepo.create).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalled()
    })

    it('should throw ForbiddenError if organizer profile not found', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(null)

      await expect(service.createTrip('user-99', createInput)).rejects.toThrow(
        'Organizer profile not found',
      )
    })

    it('should throw ForbiddenError if organizer not approved', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({
        ...mockOrganizer,
        verificationStatus: 'PENDING',
      })

      await expect(service.createTrip('user-1', createInput)).rejects.toThrow(
        'must be approved',
      )
    })

    it('should throw ForbiddenError if verification documents are incomplete', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({
        ...mockOrganizer,
        documents: { aadhaarFront: 'https://example.com/front.jpg' },
      })

      await expect(service.createTrip('user-1', createInput)).rejects.toThrow(
        'verification documents',
      )
    })

    it('should throw ForbiddenError if documents are null', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({
        ...mockOrganizer,
        documents: null,
      })

      await expect(service.createTrip('user-1', createInput)).rejects.toThrow(
        'verification documents',
      )
    })

    it('should throw ForbiddenError if bank account is not linked', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({
        ...mockOrganizer,
        bankAccountLinked: false,
      })

      await expect(service.createTrip('user-1', createInput)).rejects.toThrow(
        'Bank account must be linked',
      )
    })

    it('should throw ValidationError for invalid destination', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockDestinationRepo.findBySlug.mockResolvedValue(null)
      mockDestinationRepo.findByName.mockResolvedValue(null)
      // resolveDestination auto-creates, so this test needs create to return null
      mockDestinationRepo.create.mockResolvedValue(null)

      await expect(service.createTrip('user-1', createInput)).rejects.toThrow(
        'Invalid destination',
      )
    })

    it('should include transfer points as nested create', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockDestinationRepo.findBySlug.mockResolvedValue(mockDestination)
      mockTripRepo.slugExists.mockResolvedValue(false)
      mockTripRepo.create.mockResolvedValue(mockTrip)

      await service.createTrip('user-1', createInput)

      expect(mockTripRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transferPoints: {
            create: expect.arrayContaining([
              expect.objectContaining({ type: 'PICKUP', label: 'Pune Station', sortOrder: 0 }),
              expect.objectContaining({ type: 'DROP', label: 'Pune Station', sortOrder: 0 }),
            ]),
          },
        }),
      )
    })

    it('should generate unique slug with suffix if slug exists', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockDestinationRepo.findBySlug.mockResolvedValue(mockDestination)
      mockTripRepo.slugExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
      mockTripRepo.create.mockResolvedValue(mockTrip)

      await service.createTrip('user-1', createInput)

      expect(mockTripRepo.slugExists).toHaveBeenCalledTimes(2)
    })

    it('should resolve destination by slug when name is provided', async () => {
      const existingBySlug = { id: 'dest-manali', name: 'Manali', slug: 'manali' }
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockDestinationRepo.findBySlug.mockResolvedValue(existingBySlug)
      mockTripRepo.slugExists.mockResolvedValue(false)
      mockTripRepo.create.mockResolvedValue(mockTrip)

      await service.createTrip('user-1', { ...createInput, destinationId: 'Manali' })

      expect(mockDestinationRepo.findBySlug).toHaveBeenCalledWith('manali')
      expect(mockTripRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ destination: { connect: { id: 'dest-manali' } } }),
      )
    })

    it('should create new destination when slug and name both miss', async () => {
      const newDest = { id: 'dest-new', name: 'Spiti Valley', slug: 'spiti-valley' }
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockDestinationRepo.findBySlug.mockResolvedValue(null)
      mockDestinationRepo.findByName.mockResolvedValue(null)
      mockDestinationRepo.create.mockResolvedValue(newDest)
      mockTripRepo.slugExists.mockResolvedValue(false)
      mockTripRepo.create.mockResolvedValue(mockTrip)

      await service.createTrip('user-1', { ...createInput, destinationId: 'Spiti Valley' })

      expect(mockDestinationRepo.findBySlug).toHaveBeenCalledWith('spiti-valley')
      expect(mockDestinationRepo.findByName).toHaveBeenCalledWith('Spiti Valley')
      expect(mockDestinationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Spiti Valley', slug: 'spiti-valley', state: 'Spiti Valley' }),
      )
      expect(mockTripRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ destination: { connect: { id: 'dest-new' } } }),
      )
    })
  })

  describe('updateTrip', () => {
    it('should update a trip owned by the organizer', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTx.trip.update.mockResolvedValue({ ...mockTrip, title: 'Updated Title' })

      const result = await service.updateTrip('user-1', 'trip-1', { title: 'Updated Title' })

      expect(result.title).toBe('Updated Title')
    })

    it('should throw ForbiddenError when editing another organizer trip', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ ...mockOrganizer, id: 'org-other' })

      await expect(
        service.updateTrip('user-2', 'trip-1', { title: 'X' }),
      ).rejects.toThrow('only manage your own')
    })

    it('should replace pickup points inside a transaction', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTx.trip.update.mockResolvedValue(mockTrip)
      mockTx.tripTransferPoint.updateMany.mockResolvedValue({ count: 1 })
      mockTx.tripTransferPoint.createMany.mockResolvedValue({ count: 1 })

      await service.updateTrip('user-1', 'trip-1', {
        pickupPoints: [{ label: 'Delhi Airport T3', time: '05:00 AM', extraCharge: 500 }],
      })

      expect(mockTripRepo.withTransaction).toHaveBeenCalled()
      expect(mockTx.tripTransferPoint.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tripId: 'trip-1', type: 'PICKUP' }),
        }),
      )
      expect(mockTx.tripTransferPoint.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [expect.objectContaining({ type: 'PICKUP', label: 'Delhi Airport T3', sortOrder: 0 })],
        }),
      )
    })

    it('should not touch transfer points when arrays not provided', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTx.trip.update.mockResolvedValue({ ...mockTrip, title: 'New Title' })

      await service.updateTrip('user-1', 'trip-1', { title: 'New Title' })

      expect(mockTx.tripTransferPoint.updateMany).not.toHaveBeenCalled()
      expect(mockTx.tripTransferPoint.createMany).not.toHaveBeenCalled()
    })

    it('should throw ValidationError for completed trips', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'COMPLETED' })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)

      await expect(
        service.updateTrip('user-1', 'trip-1', { title: 'X' }),
      ).rejects.toThrow('Only DRAFT or ACTIVE')
    })
  })

  describe('publishTrip', () => {
    it('should publish a DRAFT trip within a transaction', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTx.trip.update.mockResolvedValue({ ...mockTrip, status: 'ACTIVE' })
      mockTx.destination.update.mockResolvedValue(undefined)

      const result = await service.publishTrip('user-1', 'trip-1')

      expect(result.status).toBe('ACTIVE')
      expect(mockTripRepo.withTransaction).toHaveBeenCalled()
      expect(mockTx.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'trip-1' }, data: { status: 'ACTIVE' } }),
      )
      expect(mockTx.destination.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: MOCK_DEST_ID }, data: { tripCount: { increment: 1 } } }),
      )
    })

    it('should throw ValidationError when trip has no pickup points', async () => {
      mockTripRepo.findById.mockResolvedValue({
        ...mockTrip,
        transferPoints: [{ id: 'tp-2', type: 'DROP', label: 'X', sortOrder: 0 }],
      })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)

      await expect(service.publishTrip('user-1', 'trip-1')).rejects.toThrow('pickup point')
    })

    it('should throw ValidationError when trip has no drop points', async () => {
      mockTripRepo.findById.mockResolvedValue({
        ...mockTrip,
        transferPoints: [{ id: 'tp-1', type: 'PICKUP', label: 'X', sortOrder: 0 }],
      })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)

      await expect(service.publishTrip('user-1', 'trip-1')).rejects.toThrow('drop point')
    })

    it('should throw ValidationError for non-DRAFT trip', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'ACTIVE' })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)

      await expect(service.publishTrip('user-1', 'trip-1')).rejects.toThrow(
        'Only DRAFT trips',
      )
    })
  })

  describe('getOrganizerStats', () => {
    it('should return stats with revenue from CAPTURED payments minus refunds', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.countByOrganizerId.mockResolvedValue(1)
      mockTripRepo.sumBookingsByOrganizerId.mockResolvedValue(8)
      // Revenue: ₹50,000 captured payments - ₹5,000 refunds = ₹45,000
      mockTripRepo.calculateOrganizerRevenue.mockResolvedValue(45000)
      mockTripRepo.countPendingRequests.mockResolvedValue(2)

      const result = await service.getOrganizerStats('user-1')

      expect(result.activeTrips).toBe(1)
      expect(result.totalBookings).toBe(8)
      expect(result.revenue).toBe(45000)
      expect(result.pendingRequests).toBe(2)
      expect(mockTripRepo.countByOrganizerId).toHaveBeenCalledWith('org-1', 'ACTIVE')
      expect(mockTripRepo.sumBookingsByOrganizerId).toHaveBeenCalledWith('org-1')
      expect(mockTripRepo.calculateOrganizerRevenue).toHaveBeenCalledWith('org-1')
      expect(mockTripRepo.countPendingRequests).toHaveBeenCalledWith('org-1')
    })

    it('should return zero revenue when organizer has no payments', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.countByOrganizerId.mockResolvedValue(0)
      mockTripRepo.sumBookingsByOrganizerId.mockResolvedValue(0)
      mockTripRepo.calculateOrganizerRevenue.mockResolvedValue(0)
      mockTripRepo.countPendingRequests.mockResolvedValue(0)

      const result = await service.getOrganizerStats('user-1')

      expect(result.activeTrips).toBe(0)
      expect(result.totalBookings).toBe(0)
      expect(result.revenue).toBe(0)
      expect(result.pendingRequests).toBe(0)
    })

    it('should return negative revenue when refunds exceed payments', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.countByOrganizerId.mockResolvedValue(1)
      mockTripRepo.sumBookingsByOrganizerId.mockResolvedValue(1)
      // Edge case: more refunds than payments (e.g. price adjustment + refund)
      mockTripRepo.calculateOrganizerRevenue.mockResolvedValue(-2000)
      mockTripRepo.countPendingRequests.mockResolvedValue(0)

      const result = await service.getOrganizerStats('user-1')

      expect(result.revenue).toBe(-2000)
    })

    it('should only count ACTIVE trips in activeTrips (exclude DRAFT, COMPLETED, CANCELLED)', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.countByOrganizerId.mockResolvedValue(2)
      mockTripRepo.sumBookingsByOrganizerId.mockResolvedValue(20)
      mockTripRepo.calculateOrganizerRevenue.mockResolvedValue(30000)
      mockTripRepo.countPendingRequests.mockResolvedValue(0)

      const result = await service.getOrganizerStats('user-1')

      expect(result.activeTrips).toBe(2)
      expect(result.totalBookings).toBe(20) // sum of ALL trips' currentBookings
    })

    it('should include bookings from all trip statuses in totalBookings', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.countByOrganizerId.mockResolvedValue(0)
      mockTripRepo.sumBookingsByOrganizerId.mockResolvedValue(23)
      mockTripRepo.calculateOrganizerRevenue.mockResolvedValue(50000)
      mockTripRepo.countPendingRequests.mockResolvedValue(0)

      const result = await service.getOrganizerStats('user-1')

      expect(result.activeTrips).toBe(0)
      expect(result.totalBookings).toBe(23) // cancelled bookings still count historically
      expect(result.revenue).toBe(50000) // revenue from captured payments still exists
    })

    it('should handle partial refund (revenue reduced but still positive)', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.countByOrganizerId.mockResolvedValue(1)
      mockTripRepo.sumBookingsByOrganizerId.mockResolvedValue(10)
      // ₹45,000 captured - ₹9,000 partial refund (2 of 10 travellers cancelled)
      mockTripRepo.calculateOrganizerRevenue.mockResolvedValue(36000)
      mockTripRepo.countPendingRequests.mockResolvedValue(0)

      const result = await service.getOrganizerStats('user-1')

      expect(result.revenue).toBe(36000)
    })

    it('should call all four stats queries in parallel', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      const callOrder: string[] = []
      mockTripRepo.countByOrganizerId.mockImplementation(async () => {
        callOrder.push('activeTrips')
        return 0
      })
      mockTripRepo.sumBookingsByOrganizerId.mockImplementation(async () => {
        callOrder.push('totalBookings')
        return 0
      })
      mockTripRepo.calculateOrganizerRevenue.mockImplementation(async () => {
        callOrder.push('revenue')
        return 0
      })
      mockTripRepo.countPendingRequests.mockImplementation(async () => {
        callOrder.push('pending')
        return 0
      })

      await service.getOrganizerStats('user-1')

      // All four should be called (order may vary since they run in parallel)
      expect(callOrder).toContain('activeTrips')
      expect(callOrder).toContain('totalBookings')
      expect(callOrder).toContain('revenue')
      expect(callOrder).toContain('pending')
      expect(mockTripRepo.countByOrganizerId).toHaveBeenCalledTimes(1)
      expect(mockTripRepo.sumBookingsByOrganizerId).toHaveBeenCalledTimes(1)
      expect(mockTripRepo.calculateOrganizerRevenue).toHaveBeenCalledTimes(1)
      expect(mockTripRepo.countPendingRequests).toHaveBeenCalledTimes(1)
    })

    it('should throw ForbiddenError if organizer profile not found', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(null)

      await expect(service.getOrganizerStats('user-99')).rejects.toThrow(
        'Organizer profile not found',
      )
    })
  })

  describe('setBookingPause', () => {
    it('should pause bookings with reason on ACTIVE trip', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', acceptingBookings: true })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.update.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', acceptingBookings: false, bookingsPausedBy: 'ORGANIZER', bookingsPausedReason: 'Too many enquiries' })

      const result = await service.setBookingPause('user-1', 'trip-1', { paused: true, reason: 'Too many enquiries' })

      expect(mockTripRepo.update).toHaveBeenCalledWith('trip-1', {
        acceptingBookings: false,
        bookingsPausedBy: 'ORGANIZER',
        bookingsPausedReason: 'Too many enquiries',
      })
      expect(result.acceptingBookings).toBe(false)
    })

    it('should pause bookings without reason (stores null)', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', acceptingBookings: true })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.update.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', acceptingBookings: false })

      await service.setBookingPause('user-1', 'trip-1', { paused: true })

      expect(mockTripRepo.update).toHaveBeenCalledWith('trip-1', {
        acceptingBookings: false,
        bookingsPausedBy: 'ORGANIZER',
        bookingsPausedReason: null,
      })
    })

    it('should resume bookings and clear reason + pausedBy', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', acceptingBookings: false, bookingsPausedBy: 'ORGANIZER', bookingsPausedReason: 'Some reason' })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.update.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', acceptingBookings: true, bookingsPausedBy: null, bookingsPausedReason: null })

      const result = await service.setBookingPause('user-1', 'trip-1', { paused: false })

      expect(mockTripRepo.update).toHaveBeenCalledWith('trip-1', {
        acceptingBookings: true,
        bookingsPausedBy: null,
        bookingsPausedReason: null,
      })
      expect(result.acceptingBookings).toBe(true)
    })

    it('should throw ConflictError when pausing an already-paused trip', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', acceptingBookings: false })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)

      await expect(service.setBookingPause('user-1', 'trip-1', { paused: true })).rejects.toThrow('already paused')
    })

    it('should throw ConflictError when resuming a trip that is not paused', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', acceptingBookings: true })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)

      await expect(service.setBookingPause('user-1', 'trip-1', { paused: false })).rejects.toThrow('not currently paused')
    })

    it('should throw ValidationError when trip is not ACTIVE', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'DRAFT' })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)

      await expect(service.setBookingPause('user-1', 'trip-1', { paused: true })).rejects.toThrow('Only ACTIVE trips')
    })

    it('should throw ForbiddenError when pausing another organizer\'s trip', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'ACTIVE' })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ ...mockOrganizer, id: 'org-other' })

      await expect(service.setBookingPause('user-2', 'trip-1', { paused: true })).rejects.toThrow('only manage your own')
    })

    it('should throw NotFoundError for non-existent trip', async () => {
      mockTripRepo.findById.mockResolvedValue(null)

      await expect(service.setBookingPause('user-1', 'trip-999', { paused: true })).rejects.toThrow('Trip not found')
    })

    it('should throw ForbiddenError when organizer tries to resume an admin-applied pause', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', acceptingBookings: false, bookingsPausedBy: 'ADMIN' })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)

      await expect(service.setBookingPause('user-1', 'trip-1', { paused: false })).rejects.toThrow('paused by an administrator')
    })
  })

  describe('adminSetBookingPause', () => {
    it('should pause bookings on any trip without ownership check', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', acceptingBookings: true, organizerId: 'org-other' })
      mockTripRepo.update.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', acceptingBookings: false, bookingsPausedBy: 'ADMIN' })

      const result = await service.adminSetBookingPause('admin-1', 'trip-1', { paused: true, reason: 'Policy violation' })

      expect(mockTripRepo.update).toHaveBeenCalledWith('trip-1', {
        acceptingBookings: false,
        bookingsPausedBy: 'ADMIN',
        bookingsPausedReason: 'Policy violation',
      })
      expect(result.acceptingBookings).toBe(false)
    })

    it('should allow admin to resume an admin-applied pause', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', acceptingBookings: false, bookingsPausedBy: 'ADMIN' })
      mockTripRepo.update.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', acceptingBookings: true, bookingsPausedBy: null, bookingsPausedReason: null })

      const result = await service.adminSetBookingPause('admin-1', 'trip-1', { paused: false })

      expect(result.acceptingBookings).toBe(true)
    })

    it('should throw NotFoundError for non-existent trip', async () => {
      mockTripRepo.findById.mockResolvedValue(null)

      await expect(service.adminSetBookingPause('admin-1', 'trip-999', { paused: true })).rejects.toThrow('Trip not found')
    })
  })

  describe('setVisibility', () => {
    it('should hide an ACTIVE trip with reason', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', isHidden: false })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.update.mockResolvedValue({ ...mockTrip, status: 'ACTIVE', isHidden: true, hiddenBy: 'ORGANIZER', hiddenReason: 'Rescheduling' })

      const result = await service.setVisibility('user-1', 'trip-1', { hidden: true, reason: 'Rescheduling' })

      expect(mockTripRepo.update).toHaveBeenCalledWith('trip-1', {
        isHidden: true,
        hiddenBy: 'ORGANIZER',
        hiddenReason: 'Rescheduling',
      })
      expect(result.isHidden).toBe(true)
    })

    it('should hide a FULL trip (no status restriction)', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'FULL', isHidden: false })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.update.mockResolvedValue({ ...mockTrip, status: 'FULL', isHidden: true })

      await service.setVisibility('user-1', 'trip-1', { hidden: true })

      expect(mockTripRepo.update).toHaveBeenCalledWith('trip-1', expect.objectContaining({ isHidden: true }))
    })

    it('should unhide a trip and clear hiddenBy + hiddenReason', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, isHidden: true, hiddenBy: 'ORGANIZER', hiddenReason: 'Old reason' })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.update.mockResolvedValue({ ...mockTrip, isHidden: false, hiddenBy: null, hiddenReason: null })

      const result = await service.setVisibility('user-1', 'trip-1', { hidden: false })

      expect(mockTripRepo.update).toHaveBeenCalledWith('trip-1', { isHidden: false, hiddenBy: null, hiddenReason: null })
      expect(result.isHidden).toBe(false)
    })

    it('should throw ConflictError when hiding an already-hidden trip', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, isHidden: true })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)

      await expect(service.setVisibility('user-1', 'trip-1', { hidden: true })).rejects.toThrow('already hidden')
    })

    it('should throw ConflictError when unhiding a visible trip', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, isHidden: false })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)

      await expect(service.setVisibility('user-1', 'trip-1', { hidden: false })).rejects.toThrow('not currently hidden')
    })

    it('should throw ForbiddenError when organizer tries to unhide an admin-hidden trip', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, isHidden: true, hiddenBy: 'ADMIN' })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)

      await expect(service.setVisibility('user-1', 'trip-1', { hidden: false })).rejects.toThrow('hidden by an administrator')
    })

    it('should throw ForbiddenError when hiding another organizer\'s trip', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, isHidden: false })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ ...mockOrganizer, id: 'org-other' })

      await expect(service.setVisibility('user-2', 'trip-1', { hidden: true })).rejects.toThrow('only manage your own')
    })
  })

  describe('adminSetVisibility', () => {
    it('should hide any trip without ownership check', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, isHidden: false, organizerId: 'org-other' })
      mockTripRepo.update.mockResolvedValue({ ...mockTrip, isHidden: true, hiddenBy: 'ADMIN' })

      const result = await service.adminSetVisibility('admin-1', 'trip-1', { hidden: true, reason: 'Policy' })

      expect(mockTripRepo.update).toHaveBeenCalledWith('trip-1', {
        isHidden: true,
        hiddenBy: 'ADMIN',
        hiddenReason: 'Policy',
      })
      expect(result.isHidden).toBe(true)
    })

    it('should allow admin to unhide an admin-hidden trip', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, isHidden: true, hiddenBy: 'ADMIN' })
      mockTripRepo.update.mockResolvedValue({ ...mockTrip, isHidden: false, hiddenBy: null, hiddenReason: null })

      const result = await service.adminSetVisibility('admin-1', 'trip-1', { hidden: false })

      expect(result.isHidden).toBe(false)
    })

    it('should throw NotFoundError for non-existent trip', async () => {
      mockTripRepo.findById.mockResolvedValue(null)

      await expect(service.adminSetVisibility('admin-1', 'trip-999', { hidden: true })).rejects.toThrow('Trip not found')
    })
  })

  describe('getTripEditHistory', () => {
    it('should return paginated edit history for own trip', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockEditHistoryRepo.findByTripId.mockResolvedValue({
        data: [
          {
            id: 'hist-1',
            editedBy: { id: 'user-1', name: 'Test User' },
            changedFields: ['title', 'pricePerPerson'],
            editNote: null,
            createdAt: new Date('2025-06-01'),
          },
        ],
        total: 1,
      })

      const result = await service.getTripEditHistory('user-1', 'trip-1', 1, 20)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].changedFields).toEqual(['title', 'pricePerPerson'])
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      })
      expect(mockEditHistoryRepo.findByTripId).toHaveBeenCalledWith('trip-1', {
        offset: 0,
        limit: 20,
      })
    })

    it('should throw NotFoundError for non-existent trip', async () => {
      mockTripRepo.findById.mockResolvedValue(null)

      await expect(
        service.getTripEditHistory('user-1', 'trip-999'),
      ).rejects.toThrow('Trip not found')
    })

    it('should throw ForbiddenError when viewing another organizer\'s history', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({
        ...mockOrganizer,
        id: 'org-other',
      })

      await expect(
        service.getTripEditHistory('user-2', 'trip-1'),
      ).rejects.toThrow('only manage your own')
    })
  })

  describe('deleteTrip', () => {
    it('should soft-delete a trip with no bookings within a transaction', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, currentBookings: 0 })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTx.trip.update.mockResolvedValue(undefined)

      await service.deleteTrip('user-1', 'trip-1')

      expect(mockTripRepo.withTransaction).toHaveBeenCalled()
      expect(mockTx.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'trip-1' },
          data: expect.objectContaining({ isDeleted: true, isActive: false }),
        }),
      )
    })

    it('should throw ValidationError for trip with existing bookings', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip) // currentBookings: 5
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)

      await expect(service.deleteTrip('user-1', 'trip-1')).rejects.toThrow(
        'existing bookings',
      )
    })

    it('should decrement destination trip count when deleting ACTIVE trip', async () => {
      mockTripRepo.findById.mockResolvedValue({
        ...mockTrip,
        status: 'ACTIVE',
        currentBookings: 0,
      })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTx.trip.update.mockResolvedValue(undefined)
      mockTx.destination.update.mockResolvedValue(undefined)

      await service.deleteTrip('user-1', 'trip-1')

      expect(mockTx.destination.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_DEST_ID },
          data: { tripCount: { decrement: 1 } },
        }),
      )
    })
  })

  // ── getOrganizerPublicProfileBySlug ─────────────────

  describe('getOrganizerPublicProfileBySlug', () => {
    const mockPublicProfile = {
      id: 'org-1',
      slug: 'desi-explorers',
      businessName: 'Desi Explorers',
      description: 'Best group trips',
      verificationStatus: 'APPROVED',
      rating: 4.5,
      totalReviews: 20,
      totalTripsCompleted: 15,
      createdAt: new Date('2023-01-01'),
      user: { createdAt: new Date('2023-01-01') },
    }

    const setupOrganizerMocks = () => {
      mockTripRepo.findByOrganizerIdPaginated.mockResolvedValue({ data: [], total: 0 })
      mockReviewRepo.findByOrganizerId.mockResolvedValue({ data: [], total: 0 })
      mockReviewRepo.getOrganizerRatingStats.mockResolvedValue({
        _avg: { overallRating: 4.5 },
        _count: { overallRating: 20 },
      })
      mockReviewRepo.getRatingDistributionByOrganizer.mockResolvedValue([])
    }

    it('should return organizer profile by slug', async () => {
      mockOrganizerProfileRepo.findBySlugPublic.mockResolvedValue(mockPublicProfile)
      mockOrganizerProfileRepo.findByIdPublic.mockResolvedValue(mockPublicProfile)
      setupOrganizerMocks()

      const result = await service.getOrganizerPublicProfileBySlug('desi-explorers')

      expect(mockOrganizerProfileRepo.findBySlugPublic).toHaveBeenCalledWith('desi-explorers')
      expect(result.organizer.slug).toBe('desi-explorers')
      expect(result.organizer.businessName).toBe('Desi Explorers')
      expect(result.organizer.verified).toBe(true)
    })

    it('should throw NotFoundError when slug does not exist', async () => {
      mockOrganizerProfileRepo.findBySlugPublic.mockResolvedValue(null)

      await expect(service.getOrganizerPublicProfileBySlug('nonexistent'))
        .rejects.toThrow('Organizer')
    })

    it('should skip redundant findByIdPublic and use slug-fetched profile directly', async () => {
      mockOrganizerProfileRepo.findBySlugPublic.mockResolvedValue(mockPublicProfile)
      setupOrganizerMocks()

      await service.getOrganizerPublicProfileBySlug('desi-explorers', 2, 6, 1, 5)

      expect(mockOrganizerProfileRepo.findBySlugPublic).toHaveBeenCalledWith('desi-explorers')
      expect(mockOrganizerProfileRepo.findByIdPublic).not.toHaveBeenCalled()
      expect(mockTripRepo.findByOrganizerIdPaginated).toHaveBeenCalledWith(
        'org-1', 'ACTIVE', { offset: 6, limit: 6 },
      )
    })
  })
})

// ═══════════════════════════════════════════════════════
// Redis Cache Integration Tests
// ═══════════════════════════════════════════════════════

describe('TripService — Redis Cache', () => {
  const mockCacheService = {
    getOrSet: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    invalidateByPrefix: vi.fn(),
  }

  let cachedService: TripService

  beforeEach(() => {
    vi.clearAllMocks()
    cachedService = new TripService(
      mockTripRepo as any,
      mockDestinationRepo as any,
      mockOrganizerProfileRepo as any,
      mockEditHistoryRepo as any,
      {} as any,
      {} as any,
      mockReviewRepo as any,
      logger as any,
      { send: vi.fn().mockResolvedValue([]) } as any,
      null,
      mockCacheService as any,
    )
  })

  describe('searchTrips — cache', () => {
    it('should return cached result on hit (no DB call)', async () => {
      const cachedResult = {
        data: [{ id: 'trip-1', title: 'Cached Trip' }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }
      mockCacheService.getOrSet.mockResolvedValue(cachedResult)

      const result = await cachedService.searchTrips({ page: 1, limit: 10 })

      expect(result).toEqual(cachedResult)
      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        expect.stringContaining('cache:trips:search:'),
        300,
        expect.any(Function),
      )
      expect(mockTripRepo.search).not.toHaveBeenCalled()
    })

    it('should call fetcher and cache result on miss', async () => {
      mockCacheService.getOrSet.mockImplementation(
        (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
      )
      mockTripRepo.search.mockResolvedValue({ data: [mockTrip], total: 1 })

      const result = await cachedService.searchTrips({ page: 1, limit: 10 })

      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
      expect(mockTripRepo.search).toHaveBeenCalledOnce()
    })
  })

  describe('getTripBySlug — cache', () => {
    it('should return cached detail on hit (no DB call)', async () => {
      const cachedDetail = { id: 'trip-1', title: 'Cached Trip', slug: 'cached-trip' }
      mockCacheService.getOrSet.mockResolvedValue(cachedDetail)

      const result = await cachedService.getTripBySlug('cached-trip')

      expect(result).toEqual(cachedDetail)
      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'cache:trips:detail:cached-trip',
        600,
        expect.any(Function),
      )
      expect(mockTripRepo.findBySlug).not.toHaveBeenCalled()
    })

    it('should call fetcher on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(
        (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
      )
      mockTripRepo.findBySlug.mockResolvedValue(mockTrip)

      const result = await cachedService.getTripBySlug('goa-beach-getaway-dec-2025')

      expect(result.title).toBe('Goa Beach Getaway')
      expect(mockTripRepo.findBySlug).toHaveBeenCalledOnce()
    })

    it('should throw NotFoundError on cache miss when slug does not exist', async () => {
      mockCacheService.getOrSet.mockImplementation(
        (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
      )
      mockTripRepo.findBySlug.mockResolvedValue(null)

      await expect(cachedService.getTripBySlug('nonexistent')).rejects.toThrow('Trip not found')
    })
  })

  describe('cache invalidation on mutations', () => {
    it('should invalidate trip caches after createTrip', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockDestinationRepo.findById.mockResolvedValue(mockDestination)
      mockTripRepo.slugExists.mockResolvedValue(false)
      mockTripRepo.create.mockResolvedValue(mockTrip)
      mockCacheService.invalidateByPrefix.mockResolvedValue(0)

      await cachedService.createTrip('user-1', {
        title: 'Goa Beach Getaway',
        destinationId: MOCK_DEST_ID,
        tripType: 'BEACH',
        bookingMode: 'INSTANT',
        description: 'An amazing beach trip',
        startDate: '2026-12-06T00:00:00.000Z',
        endDate: '2026-12-08T00:00:00.000Z',
        pricePerPerson: 4500,
        minGroupSize: 10,
        maxGroupSize: 20,
        cancellationPolicy: 'FLEXIBLE',
        inclusions: ['transport'],
        exclusions: [],
        itinerary: [],
        photos: [],
        pickupPoints: [{ label: 'Pune Station', time: '06:00 AM' }],
        dropPoints: [{ label: 'Pune Station', time: '08:00 PM' }],
      })

      expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('cache:trips:*')
    })

    it('should invalidate trip caches after updateTrip', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'ACTIVE' })
      // withTransaction resolves with the updated trip from tx.trip.update
      mockTripRepo.withTransaction.mockResolvedValue({ ...mockTrip, title: 'Updated Trip' })
      mockEditHistoryRepo.create.mockResolvedValue({})
      mockCacheService.invalidateByPrefix.mockResolvedValue(0)
      mockCacheService.del.mockResolvedValue(undefined)

      await cachedService.updateTrip('trip-1', 'user-1', { title: 'Updated Trip' })

      expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('cache:trips:*')
      expect(mockCacheService.del).toHaveBeenCalledWith('cache:trips:detail:goa-beach-getaway-dec-2025')
    })
  })

  describe('createTripRequest', () => {
    const mockLiteTrip = {
      id: 'trip-1',
      status: 'ACTIVE',
      bookingMode: 'REQUEST_BASED',
      acceptingBookings: true,
      bookingsPausedReason: null,
      isHidden: false,
      organizerId: 'org-1',
    }

    it('should throw ValidationError when trip is hidden', async () => {
      mockTripRepo.findByIdLite.mockResolvedValue({ ...mockLiteTrip, isHidden: true })

      await expect(
        service.createTripRequest('user-1', 'trip-1', { numTravelers: 2 }),
      ).rejects.toThrow('not available for requests')
    })
  })
})
