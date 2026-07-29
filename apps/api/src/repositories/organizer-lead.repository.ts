import type { OrganizerLeadStatus, Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'

export interface CreateOrganizerLeadData {
  fullName: string
  email: string
  phone: string
  businessName?: string | null
  city?: string | null
  notes?: string | null
}

export interface OrganizerLeadListFilters {
  status?: OrganizerLeadStatus
  search?: string
  page: number
  limit: number
}

export class OrganizerLeadRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  async create(data: CreateOrganizerLeadData) {
    return this.prisma.organizerLead.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        businessName: data.businessName ?? null,
        city: data.city ?? null,
        notes: data.notes ?? null,
      },
    })
  }

  async findByEmail(email: string) {
    return this.prisma.organizerLead.findUnique({ where: { email } })
  }

  async findById(id: string) {
    return this.prisma.organizerLead.findUnique({ where: { id } })
  }

  async findAllPaginated(filters: OrganizerLeadListFilters) {
    const where: Prisma.OrganizerLeadWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { email: { contains: filters.search, mode: 'insensitive' } },
              { fullName: { contains: filters.search, mode: 'insensitive' } },
              { businessName: { contains: filters.search, mode: 'insensitive' } },
              { city: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.organizerLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.organizerLead.count({ where }),
    ])

    return { items, total }
  }

  async updateStatus(
    id: string,
    data: { status: OrganizerLeadStatus; adminNotes?: string },
  ) {
    return this.prisma.organizerLead.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.adminNotes !== undefined ? { adminNotes: data.adminNotes } : {}),
      },
    })
  }
}
