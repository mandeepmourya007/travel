import type { Logger } from 'pino'
import { Prisma } from '@prisma/client'
import type {
  CreateOrganizerLeadDto,
  OrganizerLeadFilters,
  OrganizerLeadItem,
  UpdateOrganizerLeadStatusDto,
} from '@shared/types/organizer-lead.types'
import { OrganizerLeadRepository } from '../repositories/organizer-lead.repository'
import { ConflictError, NotFoundError } from '../errors/app-error'
import { PAGINATION_DEFAULTS } from '../utils/constants'

const DUPLICATE_LEAD_MESSAGE =
  "This email is already on our organizer waitlist. We'll be in touch soon!"
const DUPLICATE_LEAD_SUBCODE = 'LEAD_ALREADY_SUBMITTED'

type OrganizerLeadRow = Awaited<ReturnType<OrganizerLeadRepository['findById']>>

export class OrganizerLeadService {
  constructor(
    private leadRepo: OrganizerLeadRepository,
    private logger: Logger,
  ) {}

  async submit(dto: CreateOrganizerLeadDto): Promise<OrganizerLeadItem> {
    const email = dto.email.trim().toLowerCase()

    // Fast-path duplicate check for a helpful message. The unique constraint on
    // OrganizerLead.email is the actual backstop — two concurrent submissions can
    // both pass this check and race on create(), so we translate the resulting
    // P2002 into the same ConflictError below (matches the check-then-catch
    // pattern in ResellerService.createMainLink / OtpService.setPhone).
    const existing = await this.leadRepo.findByEmail(email)
    if (existing) {
      throw new ConflictError(DUPLICATE_LEAD_MESSAGE, DUPLICATE_LEAD_SUBCODE)
    }

    try {
      const lead = await this.leadRepo.create({
        fullName: dto.fullName.trim(),
        email,
        phone: dto.phone.trim(),
        businessName: dto.businessName?.trim() || null,
        city: dto.city?.trim() || null,
        notes: dto.notes?.trim() || null,
      })

      this.logger.info({ leadId: lead.id }, 'Organizer lead submitted')
      return this.toItem(lead)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Concurrent duplicate raced the findByEmail check above — surface the
        // same ConflictError the fast path would have thrown.
        throw new ConflictError(DUPLICATE_LEAD_MESSAGE, DUPLICATE_LEAD_SUBCODE)
      }
      throw err
    }
  }

  async listForAdmin(filters: OrganizerLeadFilters) {
    const page = filters.page ?? 1
    const limit = filters.limit ?? PAGINATION_DEFAULTS.limit
    const { items, total } = await this.leadRepo.findAllPaginated({
      status: filters.status,
      search: filters.search,
      page,
      limit,
    })
    return {
      data: items.map((row) => this.toItem(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async updateStatus(id: string, dto: UpdateOrganizerLeadStatusDto): Promise<OrganizerLeadItem> {
    const existing = await this.leadRepo.findById(id)
    if (!existing) throw new NotFoundError('OrganizerLead')

    const updated = await this.leadRepo.updateStatus(id, {
      status: dto.status,
      adminNotes: dto.adminNotes,
    })
    this.logger.info({ leadId: id, status: dto.status }, 'Organizer lead status updated')
    return this.toItem(updated)
  }

  private toItem(row: NonNullable<OrganizerLeadRow>): OrganizerLeadItem {
    return {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      businessName: row.businessName,
      city: row.city,
      notes: row.notes,
      status: row.status,
      adminNotes: row.adminNotes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
