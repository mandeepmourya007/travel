import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DestinationService } from '../../../src/services/destination.service'
import { logger } from '../../../src/utils/logger'

const mockDestinationRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findBySlugPublic: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  incrementTripCount: vi.fn(),
  decrementTripCount: vi.fn(),
}

const mockTripRepo = {
  findByDestinationIdPaginated: vi.fn(),
  getDestinationStats: vi.fn(),
}

let service: DestinationService

beforeEach(() => {
  vi.clearAllMocks()
  service = new DestinationService(mockDestinationRepo as any, mockTripRepo as any, logger as any)
})

describe('DestinationService', () => {
  describe('list', () => {
    it('should return all active destinations', async () => {
      const destinations = [
        { id: '1', name: 'Goa', slug: 'goa', state: 'Goa', photoUrl: null, tripCount: 5, isPopular: true },
        { id: '2', name: 'Manali', slug: 'manali', state: 'Himachal Pradesh', photoUrl: null, tripCount: 3, isPopular: false },
      ]
      mockDestinationRepo.findAll.mockResolvedValue(destinations)

      const result = await service.list()

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Goa')
      expect(mockDestinationRepo.findAll).toHaveBeenCalled()
    })
  })

  describe('getById', () => {
    it('should return a destination by id', async () => {
      const destination = { id: '1', name: 'Goa', slug: 'goa', state: 'Goa' }
      mockDestinationRepo.findById.mockResolvedValue(destination)

      const result = await service.getById('1')

      expect(result.name).toBe('Goa')
    })

    it('should throw NotFoundError when destination does not exist', async () => {
      mockDestinationRepo.findById.mockResolvedValue(null)

      await expect(service.getById('nonexistent')).rejects.toThrow('Destination not found')
    })
  })

  describe('create', () => {
    it('should create a destination with auto-generated slug', async () => {
      mockDestinationRepo.findBySlug.mockResolvedValue(null)
      mockDestinationRepo.create.mockResolvedValue({
        id: '1',
        name: 'Goa',
        slug: 'goa',
        state: 'Goa',
        isPopular: false,
      })

      const result = await service.create({ name: 'Goa', state: 'Goa' })

      expect(result.slug).toBe('goa')
      expect(mockDestinationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Goa', slug: 'goa', state: 'Goa' }),
      )
      expect(logger.info).toHaveBeenCalled()
    })

    it('should throw ConflictError when slug already exists', async () => {
      mockDestinationRepo.findBySlug.mockResolvedValue({ id: 'existing' })

      await expect(service.create({ name: 'Goa', state: 'Goa' })).rejects.toThrow(
        'already exists',
      )
    })
  })

  describe('update', () => {
    it('should update an existing destination', async () => {
      mockDestinationRepo.findById.mockResolvedValue({ id: '1', slug: 'goa' })
      mockDestinationRepo.update.mockResolvedValue({ id: '1', name: 'Goa Updated', slug: 'goa' })

      const result = await service.update('1', { name: 'Goa Updated' })

      expect(result.name).toBe('Goa Updated')
      expect(logger.info).toHaveBeenCalled()
    })

    it('should throw NotFoundError when updating non-existent destination', async () => {
      mockDestinationRepo.findById.mockResolvedValue(null)

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(
        'Destination not found',
      )
    })

    it('should throw ConflictError when changing slug to an existing one', async () => {
      mockDestinationRepo.findById.mockResolvedValue({ id: '1', slug: 'goa' })
      mockDestinationRepo.findBySlug.mockResolvedValue({ id: '2', slug: 'manali' })

      await expect(service.update('1', { slug: 'manali' })).rejects.toThrow('already taken')
    })
  })

  describe('getBySlug', () => {
    const mockDest = {
      id: 'dest-1',
      name: 'Goa',
      slug: 'goa',
      state: 'Goa',
      photoUrl: 'https://example.com/goa.jpg',
      description: 'Beautiful beaches',
      tripCount: 5,
      isPopular: true,
    }

    const mockTrips = [
      { id: 'trip-1', title: 'Beach Trip', slug: 'beach-trip', pricePerPerson: 5000 },
      { id: 'trip-2', title: 'Night Life', slug: 'night-life', pricePerPerson: 8000 },
    ]

    const mockStats = { avgPrice: 6500, organizerCount: 2, upcomingCount: 2 }

    it('should return destination detail with trips and stats', async () => {
      mockDestinationRepo.findBySlugPublic.mockResolvedValue(mockDest)
      mockTripRepo.findByDestinationIdPaginated.mockResolvedValue({ data: mockTrips, total: 2 })
      mockTripRepo.getDestinationStats.mockResolvedValue(mockStats)

      const result = await service.getBySlug('goa')

      expect(result.destination.name).toBe('Goa')
      expect(result.destination.description).toBe('Beautiful beaches')
      expect(result.trips).toHaveLength(2)
      expect(result.tripsPagination.total).toBe(2)
      expect(result.tripsPagination.totalPages).toBe(1)
      expect(result.stats).toEqual(mockStats)
      expect(mockDestinationRepo.findBySlugPublic).toHaveBeenCalledWith('goa')
      expect(mockTripRepo.findByDestinationIdPaginated).toHaveBeenCalledWith('dest-1', { offset: 0, limit: 20 })
      expect(mockTripRepo.getDestinationStats).toHaveBeenCalledWith('dest-1')
    })

    it('should throw NotFoundError when slug does not exist', async () => {
      mockDestinationRepo.findBySlugPublic.mockResolvedValue(null)

      await expect(service.getBySlug('nonexistent')).rejects.toThrow('Destination not found')
    })

    it('should return empty trips with zero stats when no trips exist', async () => {
      mockDestinationRepo.findBySlugPublic.mockResolvedValue(mockDest)
      mockTripRepo.findByDestinationIdPaginated.mockResolvedValue({ data: [], total: 0 })
      mockTripRepo.getDestinationStats.mockResolvedValue({ avgPrice: 0, organizerCount: 0, upcomingCount: 0 })

      const result = await service.getBySlug('goa')

      expect(result.trips).toHaveLength(0)
      expect(result.tripsPagination.total).toBe(0)
      expect(result.tripsPagination.totalPages).toBe(0)
      expect(result.stats.avgPrice).toBe(0)
    })

    it('should forward pagination params correctly', async () => {
      mockDestinationRepo.findBySlugPublic.mockResolvedValue(mockDest)
      mockTripRepo.findByDestinationIdPaginated.mockResolvedValue({ data: [], total: 0 })
      mockTripRepo.getDestinationStats.mockResolvedValue({ avgPrice: 0, organizerCount: 0, upcomingCount: 0 })

      await service.getBySlug('goa', 3, 6)

      expect(mockTripRepo.findByDestinationIdPaginated).toHaveBeenCalledWith('dest-1', { offset: 12, limit: 6 })
    })
  })

  describe('delete', () => {
    it('should soft-delete an existing destination with no trips', async () => {
      mockDestinationRepo.findById.mockResolvedValue({ id: '1', tripCount: 0 })
      mockDestinationRepo.softDelete.mockResolvedValue(undefined)

      await service.delete('1')

      expect(mockDestinationRepo.softDelete).toHaveBeenCalledWith('1')
      expect(logger.info).toHaveBeenCalled()
    })

    it('should throw NotFoundError when deleting non-existent destination', async () => {
      mockDestinationRepo.findById.mockResolvedValue(null)

      await expect(service.delete('nonexistent')).rejects.toThrow('Destination not found')
    })

    it('should throw ValidationError when deleting destination with active trips', async () => {
      mockDestinationRepo.findById.mockResolvedValue({ id: '1', tripCount: 5 })

      await expect(service.delete('1')).rejects.toThrow('active trips')
    })
  })
})
