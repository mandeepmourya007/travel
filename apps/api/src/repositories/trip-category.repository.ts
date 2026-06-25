import { TripTypeRequestStatus } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'

export class TripCategoryRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  // ─── TripCategory CRUD ────────────────────────────────

  async findAllActive() {
    return this.prisma.tripCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    })
  }

  async findAll() {
    return this.prisma.tripCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    })
  }

  async findById(id: string) {
    return this.prisma.tripCategory.findUnique({ where: { id } })
  }

  async findByValue(value: string) {
    return this.prisma.tripCategory.findUnique({ where: { value } })
  }

  async create(data: { value: string; label: string; icon?: string; sortOrder?: number }) {
    return this.prisma.tripCategory.create({ data })
  }

  async update(id: string, data: { label?: string; icon?: string | null; isActive?: boolean; sortOrder?: number }) {
    return this.prisma.tripCategory.update({ where: { id }, data })
  }

  async delete(id: string) {
    return this.prisma.tripCategory.delete({ where: { id } })
  }

  async countTripsByValue(value: string): Promise<number> {
    return this.prisma.trip.count({
      where: { tripType: value, isDeleted: false },
    })
  }

  /**
   * Returns trip counts for ALL categories in a single groupBy query.
   * Use this in admin list views instead of calling countTripsByValue() per category (N+1).
   */
  async countTripsByValues(): Promise<Map<string, number>> {
    const rows = await this.prisma.trip.groupBy({
      by: ['tripType'],
      where: { isDeleted: false },
      _count: { _all: true },
    })
    return new Map(rows.map(r => [r.tripType, r._count._all]))
  }

  // ─── TripTypeRequest ──────────────────────────────────

  async createRequest(data: { organizerId: string; suggestedName: string; reason: string }) {
    return this.prisma.tripTypeRequest.create({
      data,
      include: { organizer: { select: { id: true, businessName: true, userId: true } } },
    })
  }

  async findRequestById(id: string) {
    return this.prisma.tripTypeRequest.findUnique({
      where: { id },
      include: { organizer: { select: { id: true, businessName: true, userId: true } } },
    })
  }

  async findMyRequests(organizerId: string) {
    return this.prisma.tripTypeRequest.findMany({
      where: { organizerId },
      orderBy: { createdAt: 'desc' },
      include: { organizer: { select: { id: true, businessName: true } } },
    })
  }

  async findRequests(filters: { status?: TripTypeRequestStatus; page: number; limit: number }) {
    const where = filters.status ? { status: filters.status } : {}
    const [data, total] = await Promise.all([
      this.prisma.tripTypeRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: { organizer: { select: { id: true, businessName: true } } },
      }),
      this.prisma.tripTypeRequest.count({ where }),
    ])
    return { data, total }
  }

  async updateRequest(id: string, data: { status: TripTypeRequestStatus; adminNote?: string; reviewedAt?: Date }) {
    return this.prisma.tripTypeRequest.update({
      where: { id },
      data,
      include: { organizer: { select: { id: true, businessName: true, userId: true } } },
    })
  }

  async findPendingByName(organizerId: string, suggestedName: string) {
    return this.prisma.tripTypeRequest.findFirst({
      where: { organizerId, suggestedName, status: TripTypeRequestStatus.PENDING },
    })
  }
}
