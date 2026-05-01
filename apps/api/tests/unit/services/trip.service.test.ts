import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TripService } from '../../../src/services/trip.service'
import { logger } from '../../../src/utils/logger'

const mockTx = {
  trip: { update: vi.fn() },
  destination: { update: vi.fn() },
}

const mockTripRepo = {
  search: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findByOrganizerId: vi.fn(),
  slugExists: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  withTransaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
}

const mockDestinationRepo = {
  findById: vi.fn(),
  incrementTripCount: vi.fn(),
  decrementTripCount: vi.fn(),
}

const mockOrganizerProfileRepo = {
  findByUserId: vi.fn(),
}

let service: TripService

const mockOrganizer = {
  id: 'org-1',
  userId: 'user-1',
  businessName: 'TripVibes',
  verificationStatus: 'APPROVED',
  rating: 4.5,
  totalReviews: 20,
}

const mockDestination = {
  id: 'dest-1',
  name: 'Goa',
  slug: 'goa',
}

const mockTrip = {
  id: 'trip-1',
  title: 'Goa Beach Getaway',
  slug: 'goa-beach-getaway-dec-2025',
  destinationId: 'dest-1',
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
  pickupLocation: 'Pune',
  pickupTime: '6:00 AM',
  cancellationPolicy: 'FLEXIBLE',
  destination: mockDestination,
  organizer: { ...mockOrganizer, verificationStatus: 'APPROVED' },
}

beforeEach(() => {
  vi.clearAllMocks()
  service = new TripService(
    mockTripRepo as any,
    mockDestinationRepo as any,
    mockOrganizerProfileRepo as any,
    logger as any,
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

    it('should throw NotFoundError for non-existent slug', async () => {
      mockTripRepo.findBySlug.mockResolvedValue(null)

      await expect(service.getTripBySlug('nonexistent')).rejects.toThrow('Trip not found')
    })
  })

  describe('createTrip', () => {
    const createInput = {
      title: 'Goa Beach Getaway',
      destinationId: 'dest-1',
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
    }

    it('should create a trip for an approved organizer', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockDestinationRepo.findById.mockResolvedValue(mockDestination)
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

    it('should throw ValidationError for invalid destination', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockDestinationRepo.findById.mockResolvedValue(null)

      await expect(service.createTrip('user-1', createInput)).rejects.toThrow(
        'Invalid destination',
      )
    })

    it('should generate unique slug with suffix if slug exists', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockDestinationRepo.findById.mockResolvedValue(mockDestination)
      mockTripRepo.slugExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
      mockTripRepo.create.mockResolvedValue(mockTrip)

      await service.createTrip('user-1', createInput)

      expect(mockTripRepo.slugExists).toHaveBeenCalledTimes(2)
    })
  })

  describe('updateTrip', () => {
    it('should update a trip owned by the organizer', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockTripRepo.update.mockResolvedValue({ ...mockTrip, title: 'Updated Title' })

      const result = await service.updateTrip('user-1', 'trip-1', { title: 'Updated Title' })

      expect(result.title).toBe('Updated Title')
    })

    it('should throw ForbiddenError when editing another organizer trip', async () => {
      mockTripRepo.findById.mockResolvedValue(mockTrip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ ...mockOrganizer, id: 'org-other' })

      await expect(
        service.updateTrip('user-2', 'trip-1', { title: 'X' }),
      ).rejects.toThrow('only edit your own')
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
        expect.objectContaining({ where: { id: 'dest-1' }, data: { tripCount: { increment: 1 } } }),
      )
    })

    it('should throw ValidationError for non-DRAFT trip', async () => {
      mockTripRepo.findById.mockResolvedValue({ ...mockTrip, status: 'ACTIVE' })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)

      await expect(service.publishTrip('user-1', 'trip-1')).rejects.toThrow(
        'Only DRAFT trips',
      )
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
          where: { id: 'dest-1' },
          data: { tripCount: { decrement: 1 } },
        }),
      )
    })
  })
})
