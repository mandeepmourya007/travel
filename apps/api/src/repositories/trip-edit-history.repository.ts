import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'

const EDIT_HISTORY_INCLUDE = {
  editedBy: {
    select: { id: true, name: true },
  },
} as const

export class TripEditHistoryRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Creates an audit entry for a trip edit.
   *
   * Stores a snapshot of the trip before the edit, which fields changed,
   * and who made the edit. Audit rows are immutable — never update or delete.
   * Used by: TripService.updateTrip() (skipped for DRAFT trips)
   */
  async create(data: Prisma.TripEditHistoryUncheckedCreateInput) {
    return this.prisma.tripEditHistory.create({
      data,
      include: EDIT_HISTORY_INCLUDE,
    })
  }

  /**
   * Returns paginated edit history for a trip, ordered by most recent first.
   *
   * Filters: tripId (exact match)
   * Includes: editedBy (id, name) for attribution
   * Used by: TripService.getTripEditHistory()
   *
   * Edge cases:
   * - Returns { data: [], total: 0 } if trip has no edits
   */
  async findByTripId(tripId: string, pagination: { offset: number; limit: number }) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.tripEditHistory.findMany({
        where: { tripId },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: EDIT_HISTORY_INCLUDE,
      }),
      this.prisma.tripEditHistory.count({ where: { tripId } }),
    ])
    return { data, total }
  }
}
