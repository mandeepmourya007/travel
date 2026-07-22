import { Logger } from 'pino'
import { Prisma } from '@prisma/client'
import type {
  ResellerMainLinkDto,
  ResellerMainLinkWithEarningsDto,
  ResellerSublinkDto,
  ResellerLeadRow,
  ResellerLeadFilters,
  ResolvedSublinkDto,
  ResellerSearchResultItem,
  OrganizerSearchResultItem,
  PaginatedResult,
  MyMainLinksFilters,
} from '@shared/types/reseller.types'
import { ResellerRepository } from '../repositories/reseller.repository'
import { UserRepository } from '../repositories/user.repository'
import { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import { TripRepository } from '../repositories/trip.repository'
import { NotFoundError, ForbiddenError, ValidationError } from '../errors/app-error'
import { TRIP_STATUS } from '@shared/constants'
import { PAGINATION_DEFAULTS } from '../utils/constants'

function paginate(page?: number, limit?: number) {
  const take = Math.min(limit ?? PAGINATION_DEFAULTS.limit, PAGINATION_DEFAULTS.maxLimit)
  const p = page ?? PAGINATION_DEFAULTS.page
  return { page: p, limit: take, skip: (p - 1) * take, take }
}

export class ResellerService {
  constructor(
    private resellerRepo: ResellerRepository,
    private userRepo: UserRepository,
    private organizerProfileRepo: OrganizerProfileRepository,
    private tripRepo: TripRepository,
    private logger: Logger,
  ) {}

  // ─── Organizer: main links ─────────────────────────

  /**
   * v1 limitation (documented, not a bug): the named reseller MUST already have
   * an account. We do not create users here — organizers invite an existing
   * traveler by email. A future version could store resellerId as nullable and
   * backfill on first sublink creation once that email authenticates, but the
   * simpler "require existing user" contract is chosen for v1.
   *
   * Idempotent "invite" semantics: `ResellerMainLink` is now unique per
   * (tripId, resellerId) (schema `@@unique`). Re-inviting the same reseller
   * for the same trip is a safe no-op that returns the existing link, not an
   * error — "organizer sends a request to a reseller" is naturally idempotent
   * from the caller's point of view (re-clicking "Invite" shouldn't fail just
   * because the invite already went out). We check-then-create (matching the
   * pattern already used by `findActiveMainLinkByToken`-style lookups in this
   * repo) and additionally catch the P2002 that a concurrent duplicate invite
   * would raise, re-reading the now-existing row rather than surfacing a raw
   * conflict to the organizer.
   */
  async generateMainLink(organizerUserId: string, input: { tripId: string; resellerEmail: string }): Promise<ResellerMainLinkDto> {
    const organizerProfile = await this.organizerProfileRepo.findByUserId(organizerUserId)
    if (!organizerProfile) throw new NotFoundError('Organizer profile')

    const trip = await this.tripRepo.findById(input.tripId)
    if (!trip) throw new NotFoundError('Trip')
    if (trip.organizerId !== organizerProfile.id) {
      throw new ForbiddenError('You do not own this trip')
    }

    const reseller = await this.userRepo.findByEmail(input.resellerEmail)
    if (!reseller) {
      throw new NotFoundError('A user with this email must have an account before they can be added as a reseller')
    }
    if (!reseller.isReseller) {
      await this.userRepo.setResellerFlag(reseller.id)
    }

    const existing = await this.resellerRepo.findMainLinkByTripAndReseller(input.tripId, reseller.id)
    if (existing) {
      this.logger.info({ mainLinkId: existing.id, tripId: input.tripId, resellerId: reseller.id }, 'Reseller invite re-sent (existing link, no-op)')
      return this.toMainLinkDto(existing, trip, reseller, 0)
    }

    let mainLink
    try {
      mainLink = await this.resellerRepo.createMainLink({
        tripId: input.tripId,
        organizerId: organizerProfile.id,
        resellerId: reseller.id,
        resellerEmail: input.resellerEmail,
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Concurrent duplicate invite raced us — the other request's row now exists.
        const racedExisting = await this.resellerRepo.findMainLinkByTripAndReseller(input.tripId, reseller.id)
        if (racedExisting) return this.toMainLinkDto(racedExisting, trip, reseller, 0)
      }
      throw err
    }

    this.logger.info({ mainLinkId: mainLink.id, tripId: input.tripId, resellerId: reseller.id }, 'Reseller main link created')

    return this.toMainLinkDto(mainLink, trip, reseller, 0)
  }

  private toMainLinkDto(
    mainLink: { id: string; token: string; tripId: string; organizerId: string; resellerId: string; resellerEmail: string; isActive: boolean; createdAt: Date },
    trip: { title: string; slug: string },
    reseller: { name: string },
    sublinkCount: number,
  ): ResellerMainLinkDto {
    return {
      id: mainLink.id,
      token: mainLink.token,
      tripId: mainLink.tripId,
      tripTitle: trip.title,
      tripSlug: trip.slug,
      organizerId: mainLink.organizerId,
      resellerId: mainLink.resellerId,
      resellerEmail: mainLink.resellerEmail,
      resellerName: reseller.name,
      isActive: mainLink.isActive,
      createdAt: mainLink.createdAt.toISOString(),
      sublinkCount,
      bookingCount: 0,
      totalMarkupAmount: 0,
    }
  }

  async listMainLinksForOrganizer(
    organizerUserId: string,
    filters: { tripId?: string; resellerId?: string; page?: number; limit?: number },
  ): Promise<PaginatedResult<ResellerMainLinkDto>> {
    const organizerProfile = await this.organizerProfileRepo.findByUserId(organizerUserId)
    if (!organizerProfile) throw new NotFoundError('Organizer profile')
    return this.listMainLinks({ ...filters, organizerId: organizerProfile.id })
  }

  private async listMainLinks(
    filters: { tripId?: string; resellerId?: string; organizerId?: string; page?: number; limit?: number },
  ): Promise<PaginatedResult<ResellerMainLinkDto>> {
    const { page, limit, skip, take } = paginate(filters.page, filters.limit)
    const { data, total } = await this.resellerRepo.listMainLinks(filters, { skip, take })
    return {
      data: data.map((m) => ({
        id: m.id,
        token: m.token,
        tripId: m.tripId,
        tripTitle: m.trip.title,
        tripSlug: m.trip.slug,
        organizerId: m.organizerId,
        resellerId: m.resellerId,
        resellerEmail: m.resellerEmail,
        resellerName: m.reseller.name,
        isActive: m.isActive,
        createdAt: m.createdAt.toISOString(),
        sublinkCount: m._count.sublinks,
        bookingCount: m.bookingCount,
        totalMarkupAmount: m.totalMarkupAmount,
      })),
      total,
      page,
      limit,
    }
  }

  async getMainLinkBookings(
    organizerUserId: string,
    isAdmin: boolean,
    mainLinkId: string,
    pagination: { page?: number; limit?: number },
  ) {
    const mainLink = await this.resellerRepo.findMainLinkById(mainLinkId)
    if (!mainLink) throw new NotFoundError('Main link')

    if (!isAdmin) {
      const organizerProfile = await this.organizerProfileRepo.findByUserId(organizerUserId)
      if (!organizerProfile) throw new NotFoundError('Organizer profile')
      if (mainLink.organizerId !== organizerProfile.id) throw new ForbiddenError('You do not own this main link')
    }

    const { page, limit, skip, take } = paginate(pagination.page, pagination.limit)
    const { data, total } = await this.resellerRepo.listBookingsForMainLink(mainLinkId, { skip, take })
    return { data, total, page, limit }
  }

  // ─── Reseller: main links shared with them ─────────

  /**
   * The reseller's own active main links for the trip-card landing page.
   * Gated the same way as `createSublink`/`patchSublink`: `requireRole` can't
   * express `isReseller` (a reseller shares the TRAVELER role), so that check
   * lives here.
   */
  async listMainLinksForReseller(
    resellerUserId: string,
    filters: MyMainLinksFilters,
  ): Promise<PaginatedResult<ResellerMainLinkWithEarningsDto>> {
    const caller = await this.userRepo.findById(resellerUserId)
    if (!caller) throw new NotFoundError('User')
    if (!caller.isReseller) throw new ForbiddenError('You are not registered as a reseller')

    const { page, limit, skip, take } = paginate(filters.page, filters.limit)
    const { data, total } = await this.resellerRepo.listMainLinksForReseller(
      resellerUserId,
      { tripId: filters.tripId },
      { skip, take },
    )

    return {
      data: data.map((m) => ({
        id: m.id,
        token: m.token,
        tripId: m.tripId,
        tripTitle: m.trip.title,
        tripSlug: m.trip.slug,
        tripPhoto: m.trip.photos[0] ?? null,
        organizerName: m.organizer.businessName,
        organizerId: m.organizerId,
        resellerId: m.resellerId,
        resellerEmail: m.resellerEmail,
        resellerName: m.reseller.name,
        isActive: m.isActive,
        createdAt: m.createdAt.toISOString(),
        sublinkCount: m._count.sublinks,
        bookingCount: m.bookingCount,
        totalMarkupAmount: m.totalMarkupAmount,
      })),
      total,
      page,
      limit,
    }
  }

  // ─── Reseller: sublinks ────────────────────────────

  async createSublink(
    resellerUserId: string,
    input: { mainLinkToken: string; markupAmount: number; label?: string },
  ): Promise<ResellerSublinkDto> {
    const caller = await this.userRepo.findById(resellerUserId)
    if (!caller) throw new NotFoundError('User')
    if (!caller.isReseller) throw new ForbiddenError('You are not registered as a reseller')

    const mainLink = await this.resellerRepo.findActiveMainLinkByToken(input.mainLinkToken)
    if (!mainLink) throw new NotFoundError('Main link')
    const isNamedReseller = mainLink.resellerId === resellerUserId || mainLink.resellerEmail === caller.email
    if (!isNamedReseller) throw new ForbiddenError('This main link was not shared with you')

    const trip = await this.tripRepo.findById(mainLink.tripId)
    if (!trip) throw new NotFoundError('Trip')

    const sublink = await this.resellerRepo.createSublink({
      mainLinkId: mainLink.id,
      resellerId: resellerUserId,
      tripId: mainLink.tripId,
      markupAmount: input.markupAmount,
      label: input.label,
    })

    this.logger.info({ sublinkId: sublink.id, mainLinkId: mainLink.id, resellerId: resellerUserId }, 'Reseller sublink created')

    return {
      id: sublink.id,
      token: sublink.token,
      mainLinkId: sublink.mainLinkId,
      tripId: sublink.tripId,
      tripTitle: trip.title,
      tripSlug: trip.slug,
      resellerId: sublink.resellerId,
      markupAmount: sublink.markupAmount,
      label: sublink.label,
      isActive: sublink.isActive,
      createdAt: sublink.createdAt.toISOString(),
      bookingCount: 0,
      totalMarkupAmount: 0,
    }
  }

  async listSublinksForReseller(
    resellerUserId: string,
    filters: { tripId?: string; mainLinkId?: string; page?: number; limit?: number },
  ): Promise<PaginatedResult<ResellerSublinkDto>> {
    const { page, limit, skip, take } = paginate(filters.page, filters.limit)
    const { data, total } = await this.resellerRepo.listSublinks(
      { ...filters, resellerId: resellerUserId },
      { skip, take },
    )
    return {
      data: data.map((s) => ({
        id: s.id,
        token: s.token,
        mainLinkId: s.mainLinkId,
        tripId: s.tripId,
        tripTitle: s.trip.title,
        tripSlug: s.trip.slug,
        resellerId: s.resellerId,
        markupAmount: s.markupAmount,
        label: s.label,
        isActive: s.isActive,
        createdAt: s.createdAt.toISOString(),
        bookingCount: s._count.bookings,
        totalMarkupAmount: s.totalMarkupAmount,
      })),
      total,
      page,
      limit,
    }
  }

  async patchSublink(
    resellerUserId: string,
    sublinkId: string,
    data: { markupAmount?: number; label?: string; isActive?: boolean },
  ): Promise<void> {
    const sublink = await this.resellerRepo.findSublinkById(sublinkId)
    if (!sublink) throw new NotFoundError('Sublink')
    if (sublink.resellerId !== resellerUserId) throw new ForbiddenError('You do not own this sublink')
    await this.resellerRepo.updateSublink(sublinkId, data)
  }

  /**
   * Callers reaching this endpoint fall into three buckets — admin, the
   * organizer who owns the sublink's parent main link (via the shared "Views"
   * UI on the organizer dashboard), or the reseller who owns the sublink
   * itself. `isAdmin`/`isOrganizer` are computed in the controller from
   * `req.user!.role`, matching the existing `getMainLinkBookings` pattern.
   */
  async getSublinkBookings(
    callerUserId: string,
    isAdmin: boolean,
    isOrganizer: boolean,
    sublinkId: string,
    pagination: { page?: number; limit?: number },
  ) {
    const sublink = await this.resellerRepo.findSublinkById(sublinkId)
    if (!sublink) throw new NotFoundError('Sublink')

    if (!isAdmin) {
      if (isOrganizer) {
        const organizerProfile = await this.organizerProfileRepo.findByUserId(callerUserId)
        if (!organizerProfile) throw new NotFoundError('Organizer profile')
        if (sublink.mainLink.organizerId !== organizerProfile.id) {
          throw new ForbiddenError('You do not own this sublink')
        }
      } else if (sublink.resellerId !== callerUserId) {
        throw new ForbiddenError('You do not own this sublink')
      }
    }

    const { page, limit, skip, take } = paginate(pagination.page, pagination.limit)
    const { data, total } = await this.resellerRepo.listBookingsForSublink(sublinkId, { skip, take })
    return { data, total, page, limit }
  }

  // ─── Leads ──────────────────────────────────────────

  async getOrganizerLeads(organizerUserId: string, filters: Partial<ResellerLeadFilters>): Promise<PaginatedResult<ResellerLeadRow>> {
    const organizerProfile = await this.organizerProfileRepo.findByUserId(organizerUserId)
    if (!organizerProfile) throw new NotFoundError('Organizer profile')
    return this.getLeads({ ...filters, organizerId: organizerProfile.id })
  }

  async getResellerLeads(resellerUserId: string, filters: Partial<ResellerLeadFilters>): Promise<PaginatedResult<ResellerLeadRow>> {
    return this.getLeads({ ...filters, resellerId: resellerUserId })
  }

  async getAdminLeads(filters: Partial<ResellerLeadFilters>): Promise<PaginatedResult<ResellerLeadRow>> {
    return this.getLeads(filters)
  }

  private async getLeads(
    filters: Partial<ResellerLeadFilters> & { organizerId?: string },
  ): Promise<PaginatedResult<ResellerLeadRow>> {
    const { page, limit, skip, take } = paginate(filters.page, filters.limit)
    const { data, total } = await this.resellerRepo.getLeads(
      { ...filters, sort: filters.sort ?? 'newest' },
      { skip, take },
    )
    return { data, total, page, limit }
  }

  // ─── Public resolve + attribution ──────────────────

  /**
   * PUBLIC — no user context. Returns only the merged, undifferentiated price
   * for an active sublink whose trip is published/not deleted. Never leaks
   * internal ids, the organizer's identity, the reseller's email, or a
   * base/markup breakdown — this response is embedded in SSR HTML, so any
   * breakdown field here would let a traveler view-source the exact markup.
   */
  async resolveSublinkToken(token: string): Promise<ResolvedSublinkDto> {
    const sublink = await this.resellerRepo.findActiveSublinkByToken(token)
    if (!sublink) throw new NotFoundError('Link')
    const { trip } = sublink
    if (trip.isDeleted || trip.isHidden || trip.status !== TRIP_STATUS.ACTIVE) {
      throw new NotFoundError('Link')
    }

    const isEarlyBird = trip.earlyBirdPrice && trip.earlyBirdDeadline && new Date(trip.earlyBirdDeadline) > new Date()
    const basePrice = isEarlyBird ? trip.earlyBirdPrice! : trip.pricePerPerson

    return {
      tripId: trip.id,
      tripSlug: trip.slug,
      effectivePrice: basePrice + sublink.markupAmount,
      resellerName: sublink.reseller.name,
    }
  }

  /** Authed, idempotent — records/refreshes the last-wins (userId, tripId) attribution. */
  async recordAttribution(userId: string, sublinkToken: string): Promise<void> {
    const sublink = await this.resellerRepo.findActiveSublinkByToken(sublinkToken)
    if (!sublink) throw new NotFoundError('Link')
    await this.resellerRepo.upsertAttribution(userId, sublink.id, sublink.tripId)
  }

  // ─── Combobox search ────────────────────────────────

  async searchResellers(
    callerUserId: string,
    isAdmin: boolean,
    query: string | undefined,
    page: number | undefined,
    limit: number | undefined,
  ): Promise<PaginatedResult<ResellerSearchResultItem>> {
    const { page: p, limit: l, skip, take } = paginate(page, limit)
    if (isAdmin) {
      const { data, total } = await this.resellerRepo.searchAllResellers(query, { skip, take })
      return { data, total, page: p, limit: l }
    }
    const organizerProfile = await this.organizerProfileRepo.findByUserId(callerUserId)
    if (!organizerProfile) throw new ValidationError('Only organizers can search resellers')
    const { data, total } = await this.resellerRepo.searchResellersForOrganizer(organizerProfile.id, query, { skip, take })
    return { data, total, page: p, limit: l }
  }

  async searchOrganizers(
    query: string | undefined,
    page: number | undefined,
    limit: number | undefined,
  ): Promise<PaginatedResult<OrganizerSearchResultItem>> {
    const { page: p, limit: l, skip, take } = paginate(page, limit)
    const { data, total } = await this.resellerRepo.searchOrganizers(query, { skip, take })
    return { data, total, page: p, limit: l }
  }
}
