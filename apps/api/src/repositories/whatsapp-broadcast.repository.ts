import type { WhatsappBroadcast } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import { paginate } from '../utils/constants'

export interface CreateBroadcastData {
  createdByAdminId: string
  message: string
  templateName: string
  targetType: string
  targetRole?: string
  totalCount: number
  status: string
}

export interface UpdateBroadcastData {
  successCount?: number
  failureCount?: number
  status?: string
  completedAt?: Date
}

export interface BroadcastPaginationFilters {
  page?: number
  limit?: number
}

export class WhatsappBroadcastRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  async create(data: CreateBroadcastData): Promise<WhatsappBroadcast> {
    return this.prisma.whatsappBroadcast.create({ data })
  }

  async updateCounts(id: string, update: UpdateBroadcastData): Promise<void> {
    await this.prisma.whatsappBroadcast.update({
      where: { id },
      data: update,
    })
  }

  async findById(id: string): Promise<WhatsappBroadcast | null> {
    return this.prisma.whatsappBroadcast.findUnique({ where: { id } })
  }

  async findAll(filters: BroadcastPaginationFilters): Promise<{ data: WhatsappBroadcast[]; total: number }> {
    const { skip, take } = paginate(filters)

    const [data, total] = await Promise.all([
      this.prisma.whatsappBroadcast.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.whatsappBroadcast.count(),
    ])

    return { data, total }
  }
}
