import type { Logger } from 'pino'
import type { TripCategoryRepository } from '../repositories/trip-category.repository'
import type { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import type { NotificationService } from './notification.service'
import type {
  TripCategoryItem,
  AdminTripCategoryItem,
  TripTypeRequestItem,
  TripTypeRequestFilters,
} from '@shared/types/trip-category.types'
import { NotFoundError } from '../errors/app-error'
import { ConflictError } from '../errors/app-error'
import { ForbiddenError } from '../errors/app-error'
import { ValidationError } from '../errors/app-error'
import type { CacheService } from './cache.service'
import { CACHE_TTL } from '../utils/constants'
import { cacheKeys, cacheInvalidation } from '../utils/cache-keys'

export class TripCategoryService {
  /** In-memory fallback cache: value → { label, isActive } */
  private memCache = new Map<string, { label: string; isActive: boolean }>()
  private memCacheLoaded = false

  constructor(
    private tripCategoryRepo: TripCategoryRepository,
    private organizerProfileRepo: OrganizerProfileRepository,
    private notificationService: NotificationService,
    private logger: Logger,
    private redisCache: CacheService | null = null,
  ) {}

  // ─── Cache ────────────────────────────────────────────

  private async ensureMemCache() {
    if (this.memCacheLoaded) return
    await this.refreshMemCache()
  }

  private async refreshMemCache() {
    const all = await this.tripCategoryRepo.findAll()
    this.memCache.clear()
    for (const cat of all) {
      this.memCache.set(cat.value, { label: cat.label, isActive: cat.isActive })
    }
    this.memCacheLoaded = true
  }

  /** Validate that a tripType value exists and is active. Called by TripService. */
  async validateTripType(value: string): Promise<void> {
    await this.ensureMemCache()
    const entry = this.memCache.get(value)
    if (!entry || !entry.isActive) {
      throw new ValidationError(`Invalid trip type: ${value}`)
    }
  }

  /** Get the display label for a tripType value. Returns the value itself if not found. */
  async getLabelForValue(value: string): Promise<string> {
    await this.ensureMemCache()
    return this.memCache.get(value)?.label ?? value.replace(/_/g, ' ')
  }

  // ─── Public (unauthenticated) ─────────────────────────

  async getActiveCategories(): Promise<TripCategoryItem[]> {
    const fetcher = async () => {
      const categories = await this.tripCategoryRepo.findAllActive()
      return categories.map(this.toItem)
    }

    if (this.redisCache) {
      return this.redisCache.getOrSet(cacheKeys.categoriesActive(), CACHE_TTL.CATEGORIES, fetcher)
    }
    return fetcher()
  }

  // ─── Admin: TripCategory CRUD ─────────────────────────

  async getAllCategories(): Promise<AdminTripCategoryItem[]> {
    const [categories, tripCountMap] = await Promise.all([
      this.tripCategoryRepo.findAll(),
      this.tripCategoryRepo.countTripsByValues(),
    ])
    return categories.map(cat => ({
      ...this.toItem(cat),
      tripCount: tripCountMap.get(cat.value) ?? 0,
    }))
  }

  async createCategory(data: { value: string; label: string; icon?: string; sortOrder?: number }): Promise<TripCategoryItem> {
    const existing = await this.tripCategoryRepo.findByValue(data.value)
    if (existing) throw new ConflictError(`Trip type "${data.value}" already exists`)

    const category = await this.tripCategoryRepo.create(data)
    await this.refreshMemCache()
    await this.redisCache?.invalidateByPrefix(cacheInvalidation.allCategories())
    this.logger.info({ categoryId: category.id, value: category.value }, 'Trip category created')
    return this.toItem(category)
  }

  async updateCategory(id: string, data: { label?: string; icon?: string | null; isActive?: boolean; sortOrder?: number }): Promise<TripCategoryItem> {
    const existing = await this.tripCategoryRepo.findById(id)
    if (!existing) throw new NotFoundError('Trip category')

    const category = await this.tripCategoryRepo.update(id, data)
    await this.refreshMemCache()
    await this.redisCache?.invalidateByPrefix(cacheInvalidation.allCategories())
    this.logger.info({ categoryId: id }, 'Trip category updated')
    return this.toItem(category)
  }

  async deleteCategory(id: string): Promise<void> {
    const existing = await this.tripCategoryRepo.findById(id)
    if (!existing) throw new NotFoundError('Trip category')

    const tripCount = await this.tripCategoryRepo.countTripsByValue(existing.value)
    if (tripCount > 0) {
      throw new ConflictError(
        `Cannot delete trip type "${existing.label}" — ${tripCount} trip(s) still use it. Disable it instead.`,
      )
    }

    await this.tripCategoryRepo.delete(id)
    await this.refreshMemCache()
    await this.redisCache?.invalidateByPrefix(cacheInvalidation.allCategories())
    this.logger.info({ categoryId: id, value: existing.value }, 'Trip category deleted')
  }

  // ─── Organizer: TripTypeRequest ───────────────────────

  async submitRequest(userId: string, data: { suggestedName: string; reason: string }): Promise<TripTypeRequestItem> {
    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new ForbiddenError('Organizer profile not found')

    const duplicate = await this.tripCategoryRepo.findPendingByName(profile.id, data.suggestedName)
    if (duplicate) throw new ConflictError('You already have a pending request for this trip type')

    const request = await this.tripCategoryRepo.createRequest({
      organizerId: profile.id,
      suggestedName: data.suggestedName,
      reason: data.reason,
    })
    this.logger.info({ requestId: request.id, organizerId: profile.id }, 'Trip type request submitted')
    return this.toRequestItem(request)
  }

  async getMyRequests(userId: string): Promise<TripTypeRequestItem[]> {
    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new ForbiddenError('Organizer profile not found')

    const requests = await this.tripCategoryRepo.findMyRequests(profile.id)
    return requests.map(this.toRequestItem)
  }

  // ─── Admin: Review requests ───────────────────────────

  async getRequests(filters: TripTypeRequestFilters) {
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const { data, total } = await this.tripCategoryRepo.findRequests({
      status: filters.status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined,
      page,
      limit,
    })

    return {
      data: data.map(this.toRequestItem),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async reviewRequest(
    requestId: string,
    data: { status: 'APPROVED' | 'REJECTED'; adminNote?: string },
  ): Promise<TripTypeRequestItem> {
    const request = await this.tripCategoryRepo.findRequestById(requestId)
    if (!request) throw new NotFoundError('Trip type request')
    if (request.status !== 'PENDING') {
      throw new ConflictError('This request has already been reviewed')
    }

    const updated = await this.tripCategoryRepo.updateRequest(requestId, {
      status: data.status,
      adminNote: data.adminNote,
      reviewedAt: new Date(),
    })

    // Auto-create category on approval
    if (data.status === 'APPROVED') {
      const value = request.suggestedName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')
      const existingByValue = await this.tripCategoryRepo.findByValue(value)

      if (!existingByValue) {
        await this.tripCategoryRepo.create({
          value,
          label: request.suggestedName,
        })
        await this.refreshMemCache()
        await this.redisCache?.invalidateByPrefix(cacheInvalidation.allCategories())
        this.logger.info({ value, label: request.suggestedName }, 'Trip category auto-created from approved request')
      }
    }

    // Notify the organizer
    const notifType = data.status === 'APPROVED'
      ? 'TRIP_TYPE_REQUEST_APPROVED' as const
      : 'TRIP_TYPE_REQUEST_REJECTED' as const

    try {
      await this.notificationService.send({
        userId: updated.organizer.userId,
        type: notifType,
        title: data.status === 'APPROVED'
          ? `Trip type "${request.suggestedName}" approved!`
          : `Trip type request "${request.suggestedName}" rejected`,
        body: data.status === 'APPROVED'
          ? `Your requested trip type "${request.suggestedName}" has been approved and is now available.`
          : `Your trip type request was rejected.${data.adminNote ? ` Reason: ${data.adminNote}` : ''}`,
        data: { requestId },
      })
    } catch (err) {
      this.logger.error({ err, requestId }, 'Failed to send trip type request notification')
    }

    this.logger.info({ requestId, status: data.status }, 'Trip type request reviewed')
    return this.toRequestItem(updated)
  }

  // ─── Mappers ──────────────────────────────────────────

  private toItem(cat: { id: string; value: string; label: string; icon: string | null; isActive: boolean; sortOrder: number }): TripCategoryItem {
    return {
      id: cat.id,
      value: cat.value,
      label: cat.label,
      icon: cat.icon,
      isActive: cat.isActive,
      sortOrder: cat.sortOrder,
    }
  }

  private toRequestItem(req: {
    id: string
    suggestedName: string
    reason: string
    status: string
    adminNote: string | null
    reviewedAt: Date | null
    createdAt: Date
    organizer: { id: string; businessName: string }
  }): TripTypeRequestItem {
    return {
      id: req.id,
      suggestedName: req.suggestedName,
      reason: req.reason,
      status: req.status as TripTypeRequestItem['status'],
      adminNote: req.adminNote,
      reviewedAt: req.reviewedAt?.toISOString() ?? null,
      createdAt: req.createdAt.toISOString(),
      organizer: { id: req.organizer.id, businessName: req.organizer.businessName },
    }
  }
}
