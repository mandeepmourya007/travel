import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DestinationService } from '../../../src/services/destination.service'
import { logger } from '../../../src/utils/logger'

const mockDestinationRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  incrementTripCount: vi.fn(),
  decrementTripCount: vi.fn(),
}

let service: DestinationService

beforeEach(() => {
  vi.clearAllMocks()
  service = new DestinationService(mockDestinationRepo as any, logger as any)
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
