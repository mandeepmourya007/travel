import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TripCategoryService } from '../../../src/services/trip-category.service'
import { logger } from '../../../src/utils/logger'
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '../../../src/errors/app-error'

// ─── Mock repos ─────────────────────────────────────

const mockTripCategoryRepo = {
  findAll: vi.fn(),
  findAllActive: vi.fn(),
  findById: vi.fn(),
  findByValue: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  countTripsByValue: vi.fn(),
  countTripsByValues: vi.fn(),
  createRequest: vi.fn(),
  findRequestById: vi.fn(),
  findMyRequests: vi.fn(),
  findRequests: vi.fn(),
  updateRequest: vi.fn(),
  findPendingByName: vi.fn(),
}

const mockOrganizerProfileRepo = {
  findByUserId: vi.fn(),
}

const mockNotificationService = {
  send: vi.fn(),
}

let service: TripCategoryService

// ─── Factories ──────────────────────────────────────

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cat-1',
    value: 'ADVENTURE',
    label: 'Adventure',
    icon: null,
    isActive: true,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    organizerId: 'org-1',
    suggestedName: 'Camping',
    reason: 'Popular demand',
    status: 'PENDING',
    adminNote: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    organizer: { id: 'org-1', businessName: 'TravelCo', userId: 'user-org-1' },
    ...overrides,
  }
}

// ─── Setup ──────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  service = new TripCategoryService(
    mockTripCategoryRepo as any,
    mockOrganizerProfileRepo as any,
    mockNotificationService as any,
    logger as any,
  )
  // Pre-seed cache for most tests
  mockTripCategoryRepo.findAll.mockResolvedValue([
    makeCategory(),
    makeCategory({ id: 'cat-2', value: 'BEACH', label: 'Beach', sortOrder: 2 }),
  ])
})

// ─── Cache & Validation ─────────────────────────────

describe('TripCategoryService', () => {
  describe('validateTripType', () => {
    it('passes for active trip type', async () => {
      await expect(service.validateTripType('ADVENTURE')).resolves.toBeUndefined()
    })

    it('throws ValidationError for unknown trip type', async () => {
      await expect(service.validateTripType('NONEXISTENT')).rejects.toThrow(ValidationError)
    })

    it('throws ValidationError for inactive trip type', async () => {
      mockTripCategoryRepo.findAll.mockResolvedValue([
        makeCategory({ isActive: false }),
      ])
      // Force cache reload by creating new service
      const svc = new TripCategoryService(
        mockTripCategoryRepo as any,
        mockOrganizerProfileRepo as any,
        mockNotificationService as any,
        logger as any,
      )
      await expect(svc.validateTripType('ADVENTURE')).rejects.toThrow(ValidationError)
    })
  })

  describe('getLabelForValue', () => {
    it('returns label for known value', async () => {
      const label = await service.getLabelForValue('BEACH')
      expect(label).toBe('Beach')
    })

    it('returns formatted fallback for unknown value', async () => {
      const label = await service.getLabelForValue('ROAD_TRIP')
      expect(label).toBe('ROAD TRIP')
    })
  })

  // ─── Public ─────────────────────────────────────────

  describe('getActiveCategories', () => {
    it('returns only active categories', async () => {
      mockTripCategoryRepo.findAllActive.mockResolvedValue([makeCategory()])
      const result = await service.getActiveCategories()
      expect(result).toHaveLength(1)
      expect(result[0].value).toBe('ADVENTURE')
      expect(mockTripCategoryRepo.findAllActive).toHaveBeenCalledOnce()
    })
  })

  // ─── Admin CRUD ─────────────────────────────────────

  describe('getAllCategories', () => {
    it('returns categories with trip counts using a single batch query', async () => {
      mockTripCategoryRepo.findAll.mockResolvedValue([makeCategory()])
      mockTripCategoryRepo.countTripsByValues.mockResolvedValue(new Map([['ADVENTURE', 5]]))
      const result = await service.getAllCategories()
      expect(result).toHaveLength(1)
      expect(result[0].tripCount).toBe(5)
      expect(mockTripCategoryRepo.countTripsByValues).toHaveBeenCalledOnce()
      expect(mockTripCategoryRepo.countTripsByValue).not.toHaveBeenCalled()
    })

    it('defaults tripCount to 0 for categories with no trips', async () => {
      mockTripCategoryRepo.findAll.mockResolvedValue([makeCategory({ value: 'RARE' })])
      mockTripCategoryRepo.countTripsByValues.mockResolvedValue(new Map())
      const result = await service.getAllCategories()
      expect(result[0].tripCount).toBe(0)
    })
  })

  describe('createCategory', () => {
    it('creates category and refreshes cache', async () => {
      mockTripCategoryRepo.findByValue.mockResolvedValue(null)
      mockTripCategoryRepo.create.mockResolvedValue(makeCategory({ value: 'CAMPING', label: 'Camping' }))
      const result = await service.createCategory({ value: 'CAMPING', label: 'Camping' })
      expect(result.value).toBe('CAMPING')
      expect(mockTripCategoryRepo.create).toHaveBeenCalledWith({ value: 'CAMPING', label: 'Camping' })
    })

    it('throws ConflictError for duplicate value', async () => {
      mockTripCategoryRepo.findByValue.mockResolvedValue(makeCategory())
      await expect(service.createCategory({ value: 'ADVENTURE', label: 'Adventure' })).rejects.toThrow(ConflictError)
    })
  })

  describe('updateCategory', () => {
    it('updates and returns category', async () => {
      mockTripCategoryRepo.findById.mockResolvedValue(makeCategory())
      mockTripCategoryRepo.update.mockResolvedValue(makeCategory({ label: 'Updated' }))
      const result = await service.updateCategory('cat-1', { label: 'Updated' })
      expect(result.label).toBe('Updated')
    })

    it('throws NotFoundError for missing category', async () => {
      mockTripCategoryRepo.findById.mockResolvedValue(null)
      await expect(service.updateCategory('missing', { label: 'X' })).rejects.toThrow(NotFoundError)
    })
  })

  describe('deleteCategory', () => {
    it('deletes category with zero trips', async () => {
      mockTripCategoryRepo.findById.mockResolvedValue(makeCategory())
      mockTripCategoryRepo.countTripsByValue.mockResolvedValue(0)
      await service.deleteCategory('cat-1')
      expect(mockTripCategoryRepo.delete).toHaveBeenCalledWith('cat-1')
    })

    it('throws NotFoundError for missing category', async () => {
      mockTripCategoryRepo.findById.mockResolvedValue(null)
      await expect(service.deleteCategory('missing')).rejects.toThrow(NotFoundError)
    })

    it('throws ConflictError when trips exist', async () => {
      mockTripCategoryRepo.findById.mockResolvedValue(makeCategory())
      mockTripCategoryRepo.countTripsByValue.mockResolvedValue(3)
      await expect(service.deleteCategory('cat-1')).rejects.toThrow(ConflictError)
      expect(mockTripCategoryRepo.delete).not.toHaveBeenCalled()
    })
  })

  // ─── Organizer requests ─────────────────────────────

  describe('submitRequest', () => {
    it('creates request for organizer', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: 'org-1' })
      mockTripCategoryRepo.findPendingByName.mockResolvedValue(null)
      mockTripCategoryRepo.createRequest.mockResolvedValue(makeRequest())
      const result = await service.submitRequest('user-org-1', { suggestedName: 'Camping', reason: 'Popular demand' })
      expect(result.suggestedName).toBe('Camping')
      expect(mockTripCategoryRepo.createRequest).toHaveBeenCalledWith({
        organizerId: 'org-1',
        suggestedName: 'Camping',
        reason: 'Popular demand',
      })
    })

    it('throws ForbiddenError without organizer profile', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(null)
      await expect(service.submitRequest('user-1', { suggestedName: 'X', reason: 'Y' })).rejects.toThrow(ForbiddenError)
    })

    it('throws ConflictError for duplicate pending request', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: 'org-1' })
      mockTripCategoryRepo.findPendingByName.mockResolvedValue(makeRequest())
      await expect(service.submitRequest('user-org-1', { suggestedName: 'Camping', reason: 'Y' })).rejects.toThrow(ConflictError)
    })
  })

  describe('getMyRequests', () => {
    it('returns organizer requests', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: 'org-1' })
      mockTripCategoryRepo.findMyRequests.mockResolvedValue([makeRequest()])
      const result = await service.getMyRequests('user-org-1')
      expect(result).toHaveLength(1)
      expect(result[0].suggestedName).toBe('Camping')
    })

    it('throws ForbiddenError without profile', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(null)
      await expect(service.getMyRequests('user-1')).rejects.toThrow(ForbiddenError)
    })
  })

  // ─── Admin review ───────────────────────────────────

  describe('getRequests', () => {
    it('returns paginated requests', async () => {
      mockTripCategoryRepo.findRequests.mockResolvedValue({ data: [makeRequest()], total: 1 })
      const result = await service.getRequests({ page: 1, limit: 20 })
      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })
  })

  describe('reviewRequest', () => {
    it('approves request, creates category, and notifies organizer', async () => {
      mockTripCategoryRepo.findRequestById.mockResolvedValue(makeRequest())
      mockTripCategoryRepo.updateRequest.mockResolvedValue(makeRequest({ status: 'APPROVED' }))
      mockTripCategoryRepo.findByValue.mockResolvedValue(null)
      mockTripCategoryRepo.create.mockResolvedValue(makeCategory({ value: 'CAMPING', label: 'Camping' }))

      const result = await service.reviewRequest('req-1', { status: 'APPROVED', adminNote: 'Looks good' })
      expect(result.status).toBe('APPROVED')
      expect(mockTripCategoryRepo.create).toHaveBeenCalledWith({ value: 'CAMPING', label: 'Camping' })
      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'TRIP_TYPE_REQUEST_APPROVED', userId: 'user-org-1' }),
      )
    })

    it('rejects request and notifies organizer', async () => {
      mockTripCategoryRepo.findRequestById.mockResolvedValue(makeRequest())
      mockTripCategoryRepo.updateRequest.mockResolvedValue(makeRequest({ status: 'REJECTED' }))

      const result = await service.reviewRequest('req-1', { status: 'REJECTED', adminNote: 'Too similar' })
      expect(result.status).toBe('REJECTED')
      expect(mockTripCategoryRepo.create).not.toHaveBeenCalled()
      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'TRIP_TYPE_REQUEST_REJECTED' }),
      )
    })

    it('throws NotFoundError for missing request', async () => {
      mockTripCategoryRepo.findRequestById.mockResolvedValue(null)
      await expect(service.reviewRequest('missing', { status: 'APPROVED' })).rejects.toThrow(NotFoundError)
    })

    it('throws ConflictError for already reviewed request', async () => {
      mockTripCategoryRepo.findRequestById.mockResolvedValue(makeRequest({ status: 'APPROVED' }))
      await expect(service.reviewRequest('req-1', { status: 'REJECTED' })).rejects.toThrow(ConflictError)
    })

    it('skips category creation if value already exists', async () => {
      mockTripCategoryRepo.findRequestById.mockResolvedValue(makeRequest())
      mockTripCategoryRepo.updateRequest.mockResolvedValue(makeRequest({ status: 'APPROVED' }))
      mockTripCategoryRepo.findByValue.mockResolvedValue(makeCategory({ value: 'CAMPING' }))

      await service.reviewRequest('req-1', { status: 'APPROVED' })
      expect(mockTripCategoryRepo.create).not.toHaveBeenCalled()
    })

    it('does not throw if notification fails', async () => {
      mockTripCategoryRepo.findRequestById.mockResolvedValue(makeRequest())
      mockTripCategoryRepo.updateRequest.mockResolvedValue(makeRequest({ status: 'REJECTED' }))
      mockNotificationService.send.mockRejectedValue(new Error('notification down'))

      await expect(service.reviewRequest('req-1', { status: 'REJECTED' })).resolves.toBeDefined()
    })
  })
})

// ═══════════════════════════════════════════════════════
// Redis Cache Integration Tests
// ═══════════════════════════════════════════════════════

describe('TripCategoryService — Redis Cache', () => {
  const mockRedisCache = {
    getOrSet: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    invalidateByPrefix: vi.fn(),
  }

  let cachedService: TripCategoryService

  beforeEach(() => {
    vi.clearAllMocks()
    cachedService = new TripCategoryService(
      mockTripCategoryRepo as any,
      mockOrganizerProfileRepo as any,
      mockNotificationService as any,
      logger as any,
      mockRedisCache as any,
    )
    mockTripCategoryRepo.findAll.mockResolvedValue([
      makeCategory(),
      makeCategory({ id: 'cat-2', value: 'BEACH', label: 'Beach', sortOrder: 2 }),
    ])
  })

  describe('getActiveCategories — cache', () => {
    it('should return cached categories on hit (no DB call)', async () => {
      const cached = [{ value: 'ADVENTURE', label: 'Adventure' }]
      mockRedisCache.getOrSet.mockResolvedValue(cached)

      const result = await cachedService.getActiveCategories()

      expect(result).toEqual(cached)
      expect(mockRedisCache.getOrSet).toHaveBeenCalledWith(
        'cache:categories:active',
        600,
        expect.any(Function),
      )
      expect(mockTripCategoryRepo.findAllActive).not.toHaveBeenCalled()
    })

    it('should call fetcher on cache miss', async () => {
      mockRedisCache.getOrSet.mockImplementation(
        (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
      )
      mockTripCategoryRepo.findAllActive.mockResolvedValue([makeCategory()])

      const result = await cachedService.getActiveCategories()

      expect(result).toHaveLength(1)
      expect(mockTripCategoryRepo.findAllActive).toHaveBeenCalledOnce()
    })
  })

  describe('cache invalidation', () => {
    it('should invalidate category caches after create', async () => {
      mockTripCategoryRepo.findByValue.mockResolvedValue(null)
      mockTripCategoryRepo.create.mockResolvedValue(makeCategory({ id: 'cat-new', value: 'CAMPING', label: 'Camping' }))
      mockRedisCache.invalidateByPrefix.mockResolvedValue(0)

      await cachedService.createCategory({ value: 'CAMPING', label: 'Camping' })

      expect(mockRedisCache.invalidateByPrefix).toHaveBeenCalledWith('cache:categories:*')
    })

    it('should invalidate category caches after update', async () => {
      mockTripCategoryRepo.findById.mockResolvedValue(makeCategory())
      mockTripCategoryRepo.update.mockResolvedValue(makeCategory({ label: 'Updated' }))
      mockRedisCache.invalidateByPrefix.mockResolvedValue(0)

      await cachedService.updateCategory('cat-1', { label: 'Updated' })

      expect(mockRedisCache.invalidateByPrefix).toHaveBeenCalledWith('cache:categories:*')
    })

    it('should invalidate category caches after delete', async () => {
      mockTripCategoryRepo.findById.mockResolvedValue(makeCategory())
      mockTripCategoryRepo.countTripsByValue.mockResolvedValue(0)
      mockTripCategoryRepo.delete.mockResolvedValue(undefined)
      mockRedisCache.invalidateByPrefix.mockResolvedValue(0)

      await cachedService.deleteCategory('cat-1')

      expect(mockRedisCache.invalidateByPrefix).toHaveBeenCalledWith('cache:categories:*')
    })
  })
})
