/**
 * FEATURE BRIEF: Reseller markup links
 * =====================================
 * 1. What:      Organizer→reseller "main link" per (trip, reseller); reseller
 *               generates "sublinks" with their own markup; traveler pays base+markup.
 * 2. Who:       Organizer (generate main link), Reseller (a TRAVELER with isReseller=true)
 * 3. Why:       Track-only commission reporting for resold trips — no payout split.
 * 4. Error Cases: NotFoundError (missing trip/user/link), ForbiddenError (ownership,
 *    not-the-named-reseller, isReseller=false)
 * 5. Security: isReseller gating happens here (service layer), not in requireRole —
 *    a reseller shares the TRAVELER role, so this check is load-bearing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResellerService } from '../../../src/services/reseller.service'
import { logger } from '../../../src/utils/logger'
import { NotFoundError, ForbiddenError } from '../../../src/errors/app-error'

const mockResellerRepo = {
  createMainLink: vi.fn(),
  findMainLinkById: vi.fn(),
  findMainLinkByTripAndReseller: vi.fn(),
  findActiveMainLinkByToken: vi.fn(),
  listMainLinks: vi.fn(),
  listMainLinksForReseller: vi.fn(),
  createSublink: vi.fn(),
  findSublinkById: vi.fn(),
  findActiveSublinkByToken: vi.fn(),
  findActiveByToken: vi.fn(),
  listSublinks: vi.fn(),
  updateSublink: vi.fn(),
  findAttributionByUserAndTrip: vi.fn(),
  findAttributionsForTrips: vi.fn(),
  upsertAttribution: vi.fn(),
  getLeads: vi.fn(),
  listBookingsForMainLink: vi.fn(),
  listBookingsForSublink: vi.fn(),
  searchResellersForOrganizer: vi.fn(),
  searchAllResellers: vi.fn(),
  searchOrganizers: vi.fn(),
}

const mockUserRepo = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  setResellerFlag: vi.fn(),
}

const mockOrganizerProfileRepo = {
  findByUserId: vi.fn(),
}

const mockTripRepo = {
  findById: vi.fn(),
}

describe('ResellerService', () => {
  let service: ResellerService

  beforeEach(() => {
    vi.clearAllMocks()
    mockResellerRepo.findMainLinkByTripAndReseller.mockResolvedValue(null)
    service = new ResellerService(
      mockResellerRepo as never,
      mockUserRepo as never,
      mockOrganizerProfileRepo as never,
      mockTripRepo as never,
      logger,
    )
  })

  describe('generateMainLink', () => {
    const trip = { id: 'trip-1', organizerId: 'org-profile-1', title: 'Goa Trip', slug: 'goa-trip' }
    const organizerProfile = { id: 'org-profile-1', userId: 'organizer-user-1' }
    const reseller = { id: 'reseller-user-1', name: 'Resale Rani', email: 'reseller@x.com', isReseller: false }

    it('creates a main link and flips isReseller when the named user exists', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(organizerProfile)
      mockTripRepo.findById.mockResolvedValue(trip)
      mockUserRepo.findByEmail.mockResolvedValue(reseller)
      mockResellerRepo.createMainLink.mockResolvedValue({
        id: 'link-1', token: 'tok123', tripId: 'trip-1', organizerId: 'org-profile-1',
        resellerId: 'reseller-user-1', resellerEmail: 'reseller@x.com', isActive: true, createdAt: new Date(),
      })

      const result = await service.generateMainLink('organizer-user-1', { tripId: 'trip-1', resellerEmail: 'reseller@x.com' })

      expect(mockUserRepo.setResellerFlag).toHaveBeenCalledWith('reseller-user-1')
      expect(result.token).toBe('tok123')
      expect(result.sublinkCount).toBe(0)
    })

    it('does not re-flip isReseller when already true (idempotent)', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(organizerProfile)
      mockTripRepo.findById.mockResolvedValue(trip)
      mockUserRepo.findByEmail.mockResolvedValue({ ...reseller, isReseller: true })
      mockResellerRepo.createMainLink.mockResolvedValue({
        id: 'link-1', token: 'tok123', tripId: 'trip-1', organizerId: 'org-profile-1',
        resellerId: 'reseller-user-1', resellerEmail: 'reseller@x.com', isActive: true, createdAt: new Date(),
      })

      await service.generateMainLink('organizer-user-1', { tripId: 'trip-1', resellerEmail: 'reseller@x.com' })

      expect(mockUserRepo.setResellerFlag).not.toHaveBeenCalled()
    })

    it('throws ForbiddenError when the caller does not own the trip', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: 'someone-elses-profile', userId: 'organizer-user-1' })
      mockTripRepo.findById.mockResolvedValue(trip) // trip.organizerId = 'org-profile-1', mismatch

      await expect(
        service.generateMainLink('organizer-user-1', { tripId: 'trip-1', resellerEmail: 'reseller@x.com' }),
      ).rejects.toThrow(ForbiddenError)
    })

    it('throws NotFoundError when the named reseller has no account (v1 limitation)', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(organizerProfile)
      mockTripRepo.findById.mockResolvedValue(trip)
      mockUserRepo.findByEmail.mockResolvedValue(null)

      await expect(
        service.generateMainLink('organizer-user-1', { tripId: 'trip-1', resellerEmail: 'ghost@x.com' }),
      ).rejects.toThrow(NotFoundError)
    })

    it('throws NotFoundError when the trip does not exist', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(organizerProfile)
      mockTripRepo.findById.mockResolvedValue(null)

      await expect(
        service.generateMainLink('organizer-user-1', { tripId: 'missing-trip', resellerEmail: 'reseller@x.com' }),
      ).rejects.toThrow(NotFoundError)
    })

    // ── Idempotent invite semantics (ResellerMainLink is now @@unique([tripId, resellerId])) ──

    it('re-inviting the same (trip, reseller) pair is a safe no-op that returns the existing link, not an error', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(organizerProfile)
      mockTripRepo.findById.mockResolvedValue(trip)
      mockUserRepo.findByEmail.mockResolvedValue({ ...reseller, isReseller: true })
      mockResellerRepo.findMainLinkByTripAndReseller.mockResolvedValue({
        id: 'link-1', token: 'tok123', tripId: 'trip-1', organizerId: 'org-profile-1',
        resellerId: 'reseller-user-1', resellerEmail: 'reseller@x.com', isActive: true, createdAt: new Date(),
      })

      const result = await service.generateMainLink('organizer-user-1', { tripId: 'trip-1', resellerEmail: 'reseller@x.com' })

      expect(mockResellerRepo.createMainLink).not.toHaveBeenCalled()
      expect(result.id).toBe('link-1')
      expect(result.token).toBe('tok123')
    })

    it('inviting a different reseller for the same trip still creates a second row (unique constraint is per-pair, not per-trip)', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(organizerProfile)
      mockTripRepo.findById.mockResolvedValue(trip)
      mockUserRepo.findByEmail.mockResolvedValue({ id: 'reseller-user-2', name: 'Other Reseller', email: 'other@x.com', isReseller: false })
      mockResellerRepo.findMainLinkByTripAndReseller.mockResolvedValue(null)
      mockResellerRepo.createMainLink.mockResolvedValue({
        id: 'link-2', token: 'tok999', tripId: 'trip-1', organizerId: 'org-profile-1',
        resellerId: 'reseller-user-2', resellerEmail: 'other@x.com', isActive: true, createdAt: new Date(),
      })

      const result = await service.generateMainLink('organizer-user-1', { tripId: 'trip-1', resellerEmail: 'other@x.com' })

      expect(mockResellerRepo.createMainLink).toHaveBeenCalledWith(
        expect.objectContaining({ tripId: 'trip-1', resellerId: 'reseller-user-2' }),
      )
      expect(result.id).toBe('link-2')
    })

    it('a concurrent duplicate invite (P2002 race) falls back to the existing link instead of throwing', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(organizerProfile)
      mockTripRepo.findById.mockResolvedValue(trip)
      mockUserRepo.findByEmail.mockResolvedValue({ ...reseller, isReseller: true })
      mockResellerRepo.findMainLinkByTripAndReseller
        .mockResolvedValueOnce(null) // first check: no existing link
        .mockResolvedValueOnce({
          id: 'link-1', token: 'tok123', tripId: 'trip-1', organizerId: 'org-profile-1',
          resellerId: 'reseller-user-1', resellerEmail: 'reseller@x.com', isActive: true, createdAt: new Date(),
        }) // re-check after the race
      const { Prisma } = await import('@prisma/client')
      mockResellerRepo.createMainLink.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.0.0' }),
      )

      const result = await service.generateMainLink('organizer-user-1', { tripId: 'trip-1', resellerEmail: 'reseller@x.com' })

      expect(result.id).toBe('link-1')
    })
  })

  describe('listMainLinksForReseller', () => {
    it('throws ForbiddenError when the caller is not registered as a reseller', async () => {
      mockUserRepo.findById.mockResolvedValue({ id: 'reseller-user-1', isReseller: false })

      await expect(
        service.listMainLinksForReseller('reseller-user-1', {}),
      ).rejects.toThrow(ForbiddenError)
      expect(mockResellerRepo.listMainLinksForReseller).not.toHaveBeenCalled()
    })

    it('throws NotFoundError when the caller does not exist', async () => {
      mockUserRepo.findById.mockResolvedValue(null)

      await expect(
        service.listMainLinksForReseller('missing-user', {}),
      ).rejects.toThrow(NotFoundError)
    })

    it('sums markupAmount across multiple sublinks into totalMarkupAmount per main link', async () => {
      mockUserRepo.findById.mockResolvedValue({ id: 'reseller-user-1', isReseller: true })
      mockResellerRepo.listMainLinksForReseller.mockResolvedValue({
        data: [
          {
            id: 'link-1', token: 'tok1', tripId: 'trip-1', organizerId: 'org-1',
            resellerId: 'reseller-user-1', resellerEmail: 'reseller@x.com', isActive: true,
            createdAt: new Date('2026-01-01'),
            trip: { title: 'Goa Trip', slug: 'goa-trip', photos: ['https://img/1.jpg'] },
            reseller: { name: 'Resale Rani' },
            organizer: { businessName: 'Resell Org' },
            _count: { sublinks: 2 },
            totalMarkupAmount: 1500, // sum of sublink A's 500 + sublink B's 1000
          },
        ],
        total: 1,
      })

      const result = await service.listMainLinksForReseller('reseller-user-1', {})

      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({
        id: 'link-1',
        sublinkCount: 2,
        totalMarkupAmount: 1500,
        tripPhoto: 'https://img/1.jpg',
        organizerName: 'Resell Org',
      })
      expect(mockResellerRepo.listMainLinksForReseller).toHaveBeenCalledWith(
        'reseller-user-1',
        { tripId: undefined },
        expect.objectContaining({ skip: 0 }),
      )
    })
  })

  describe('createSublink', () => {
    const mainLink = { id: 'link-1', token: 'tok123', tripId: 'trip-1', resellerId: 'reseller-user-1', resellerEmail: 'reseller@x.com', isActive: true }
    const trip = { id: 'trip-1', title: 'Goa Trip', slug: 'goa-trip' }

    it('creates a sublink when the caller is the named reseller and isReseller=true', async () => {
      mockUserRepo.findById.mockResolvedValue({ id: 'reseller-user-1', email: 'reseller@x.com', isReseller: true })
      mockResellerRepo.findActiveMainLinkByToken.mockResolvedValue(mainLink)
      mockTripRepo.findById.mockResolvedValue(trip)
      mockResellerRepo.createSublink.mockResolvedValue({
        id: 'sub-1', token: 'subtok', mainLinkId: 'link-1', resellerId: 'reseller-user-1',
        tripId: 'trip-1', markupAmount: 500, label: null, isActive: true, createdAt: new Date(),
      })

      const result = await service.createSublink('reseller-user-1', { mainLinkToken: 'tok123', markupAmount: 500 })

      expect(result.markupAmount).toBe(500)
      expect(mockResellerRepo.createSublink).toHaveBeenCalledWith(
        expect.objectContaining({ mainLinkId: 'link-1', resellerId: 'reseller-user-1', tripId: 'trip-1', markupAmount: 500 }),
      )
    })

    it('throws ForbiddenError when the caller is not registered as a reseller', async () => {
      mockUserRepo.findById.mockResolvedValue({ id: 'reseller-user-1', email: 'reseller@x.com', isReseller: false })

      await expect(
        service.createSublink('reseller-user-1', { mainLinkToken: 'tok123', markupAmount: 500 }),
      ).rejects.toThrow(ForbiddenError)
      expect(mockResellerRepo.createSublink).not.toHaveBeenCalled()
    })

    it('throws ForbiddenError when the caller is a reseller but not the one named on this main link', async () => {
      mockUserRepo.findById.mockResolvedValue({ id: 'someone-else', email: 'someone-else@x.com', isReseller: true })
      mockResellerRepo.findActiveMainLinkByToken.mockResolvedValue(mainLink)

      await expect(
        service.createSublink('someone-else', { mainLinkToken: 'tok123', markupAmount: 500 }),
      ).rejects.toThrow(ForbiddenError)
    })

    it('throws NotFoundError when the main link token does not resolve', async () => {
      mockUserRepo.findById.mockResolvedValue({ id: 'reseller-user-1', email: 'reseller@x.com', isReseller: true })
      mockResellerRepo.findActiveMainLinkByToken.mockResolvedValue(null)

      await expect(
        service.createSublink('reseller-user-1', { mainLinkToken: 'bad-token', markupAmount: 500 }),
      ).rejects.toThrow(NotFoundError)
    })
  })

  describe('patchSublink — ownership', () => {
    it('patchSublink throws ForbiddenError when caller does not own the sublink', async () => {
      mockResellerRepo.findSublinkById.mockResolvedValue({ id: 'sub-1', resellerId: 'other-reseller' })

      await expect(
        service.patchSublink('reseller-user-1', 'sub-1', { isActive: false }),
      ).rejects.toThrow(ForbiddenError)
      expect(mockResellerRepo.updateSublink).not.toHaveBeenCalled()
    })

    it('patchSublink succeeds when caller owns the sublink', async () => {
      mockResellerRepo.findSublinkById.mockResolvedValue({ id: 'sub-1', resellerId: 'reseller-user-1' })

      await service.patchSublink('reseller-user-1', 'sub-1', { markupAmount: 750 })

      expect(mockResellerRepo.updateSublink).toHaveBeenCalledWith('sub-1', { markupAmount: 750 })
    })
  })

  describe('getMainLinkBookings — admin bypass vs owner-scoped', () => {
    it('lets a pure ADMIN (no OrganizerProfile) fetch bookings for any mainLinkId', async () => {
      mockResellerRepo.findMainLinkById.mockResolvedValue({ id: 'link-1', organizerId: 'some-other-organizers-profile' })
      mockResellerRepo.listBookingsForMainLink.mockResolvedValue({ data: [{ id: 'booking-1' }], total: 1 })

      const result = await service.getMainLinkBookings('admin-user-1', true, 'link-1', {})

      expect(mockOrganizerProfileRepo.findByUserId).not.toHaveBeenCalled()
      expect(mockResellerRepo.listBookingsForMainLink).toHaveBeenCalledWith('link-1', expect.any(Object))
      expect(result.data).toEqual([{ id: 'booking-1' }])
      expect(result.total).toBe(1)
    })

    it('lets the owning organizer fetch bookings for their own main link', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: 'org-profile-1' })
      mockResellerRepo.findMainLinkById.mockResolvedValue({ id: 'link-1', organizerId: 'org-profile-1' })
      mockResellerRepo.listBookingsForMainLink.mockResolvedValue({ data: [], total: 0 })

      await service.getMainLinkBookings('organizer-user-1', false, 'link-1', {})

      expect(mockOrganizerProfileRepo.findByUserId).toHaveBeenCalledWith('organizer-user-1')
      expect(mockResellerRepo.listBookingsForMainLink).toHaveBeenCalledWith('link-1', expect.any(Object))
    })

    it('throws ForbiddenError for a non-admin organizer who does not own the main link', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: 'org-profile-1' })
      mockResellerRepo.findMainLinkById.mockResolvedValue({ id: 'link-1', organizerId: 'someone-elses-profile' })

      await expect(
        service.getMainLinkBookings('organizer-user-1', false, 'link-1', {}),
      ).rejects.toThrow(ForbiddenError)
      expect(mockResellerRepo.listBookingsForMainLink).not.toHaveBeenCalled()
    })

    it('throws NotFoundError when the main link does not exist, even for an admin', async () => {
      mockResellerRepo.findMainLinkById.mockResolvedValue(null)

      await expect(
        service.getMainLinkBookings('admin-user-1', true, 'missing-link', {}),
      ).rejects.toThrow(NotFoundError)
    })
  })

  describe('getSublinkBookings — admin/organizer bypass vs owner-scoped', () => {
    it('lets a pure ADMIN fetch bookings for any sublinkId without an ownership check', async () => {
      mockResellerRepo.findSublinkById.mockResolvedValue({ id: 'sub-1', resellerId: 'some-other-reseller', mainLink: { organizerId: 'some-organizer-profile' } })
      mockResellerRepo.listBookingsForSublink.mockResolvedValue({ data: [{ id: 'booking-1' }], total: 1 })

      const result = await service.getSublinkBookings('admin-user-1', true, false, 'sub-1', {})

      expect(mockResellerRepo.listBookingsForSublink).toHaveBeenCalledWith('sub-1', expect.any(Object))
      expect(result.data).toEqual([{ id: 'booking-1' }])
      expect(result.total).toBe(1)
    })

    it('lets the owning reseller fetch bookings for their own sublink', async () => {
      mockResellerRepo.findSublinkById.mockResolvedValue({ id: 'sub-1', resellerId: 'reseller-user-1', mainLink: { organizerId: 'some-organizer-profile' } })
      mockResellerRepo.listBookingsForSublink.mockResolvedValue({ data: [], total: 0 })

      await service.getSublinkBookings('reseller-user-1', false, false, 'sub-1', {})

      expect(mockResellerRepo.listBookingsForSublink).toHaveBeenCalledWith('sub-1', expect.any(Object))
    })

    it('throws ForbiddenError for a non-admin reseller who does not own the sublink', async () => {
      mockResellerRepo.findSublinkById.mockResolvedValue({ id: 'sub-1', resellerId: 'someone-elses-id', mainLink: { organizerId: 'some-organizer-profile' } })

      await expect(
        service.getSublinkBookings('reseller-user-1', false, false, 'sub-1', {}),
      ).rejects.toThrow(ForbiddenError)
      expect(mockResellerRepo.listBookingsForSublink).not.toHaveBeenCalled()
    })

    it('throws NotFoundError when the sublink does not exist, even for an admin', async () => {
      mockResellerRepo.findSublinkById.mockResolvedValue(null)

      await expect(
        service.getSublinkBookings('admin-user-1', true, false, 'missing-sublink', {}),
      ).rejects.toThrow(NotFoundError)
    })

    it('lets the organizer who owns the sublink\'s parent main link fetch bookings', async () => {
      mockResellerRepo.findSublinkById.mockResolvedValue({ id: 'sub-1', resellerId: 'reseller-user-1', mainLink: { organizerId: 'org-profile-1' } })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: 'org-profile-1' })
      mockResellerRepo.listBookingsForSublink.mockResolvedValue({ data: [{ id: 'booking-1' }], total: 1 })

      const result = await service.getSublinkBookings('organizer-user-1', false, true, 'sub-1', {})

      expect(mockOrganizerProfileRepo.findByUserId).toHaveBeenCalledWith('organizer-user-1')
      expect(mockResellerRepo.listBookingsForSublink).toHaveBeenCalledWith('sub-1', expect.any(Object))
      expect(result.data).toEqual([{ id: 'booking-1' }])
    })

    it('throws ForbiddenError for an organizer who does not own the trip behind the sublink', async () => {
      mockResellerRepo.findSublinkById.mockResolvedValue({ id: 'sub-1', resellerId: 'reseller-user-1', mainLink: { organizerId: 'someone-elses-profile' } })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: 'org-profile-1' })

      await expect(
        service.getSublinkBookings('organizer-user-1', false, true, 'sub-1', {}),
      ).rejects.toThrow(ForbiddenError)
      expect(mockResellerRepo.listBookingsForSublink).not.toHaveBeenCalled()
    })

    it('throws NotFoundError when the organizer caller has no OrganizerProfile', async () => {
      mockResellerRepo.findSublinkById.mockResolvedValue({ id: 'sub-1', resellerId: 'reseller-user-1', mainLink: { organizerId: 'org-profile-1' } })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(null)

      await expect(
        service.getSublinkBookings('organizer-user-1', false, true, 'sub-1', {}),
      ).rejects.toThrow(NotFoundError)
      expect(mockResellerRepo.listBookingsForSublink).not.toHaveBeenCalled()
    })
  })

  describe('resolveSublinkToken — public, price-display only', () => {
    it('returns only the merged effective price for an active sublink on a published trip — never a base/markup breakdown', async () => {
      mockResellerRepo.findActiveSublinkByToken.mockResolvedValue({
        id: 'sub-1', markupAmount: 500,
        trip: { id: 'trip-1', slug: 'goa-trip', status: 'ACTIVE', isHidden: false, isDeleted: false, pricePerPerson: 5000, earlyBirdPrice: null, earlyBirdDeadline: null },
        reseller: { name: 'Resale Rani' },
      })

      const result = await service.resolveSublinkToken('subtok')

      // Regression guard: this DTO is embedded in SSR HTML — basePrice/markupAmount
      // must NEVER be present, only the undifferentiated effectivePrice.
      expect(result).toEqual({
        tripId: 'trip-1', tripSlug: 'goa-trip', effectivePrice: 5500, resellerName: 'Resale Rani',
      })
      expect(result).not.toHaveProperty('basePrice')
      expect(result).not.toHaveProperty('markupAmount')
      expect(Object.keys(result).sort()).toEqual(['effectivePrice', 'resellerName', 'tripId', 'tripSlug'])
    })

    it('throws NotFoundError (never leaking internals) when the sublink is missing', async () => {
      mockResellerRepo.findActiveSublinkByToken.mockResolvedValue(null)
      await expect(service.resolveSublinkToken('bad-token')).rejects.toThrow(NotFoundError)
    })

    it('throws NotFoundError when the trip is hidden (does not leak that the link itself is valid)', async () => {
      mockResellerRepo.findActiveSublinkByToken.mockResolvedValue({
        id: 'sub-1', markupAmount: 500,
        trip: { id: 'trip-1', slug: 'goa-trip', status: 'ACTIVE', isHidden: true, isDeleted: false, pricePerPerson: 5000, earlyBirdPrice: null, earlyBirdDeadline: null },
        reseller: { name: 'Resale Rani' },
      })
      await expect(service.resolveSublinkToken('subtok')).rejects.toThrow(NotFoundError)
    })

    it('throws NotFoundError when the trip is soft-deleted', async () => {
      mockResellerRepo.findActiveSublinkByToken.mockResolvedValue({
        id: 'sub-1', markupAmount: 500,
        trip: { id: 'trip-1', slug: 'goa-trip', status: 'ACTIVE', isHidden: false, isDeleted: true, pricePerPerson: 5000, earlyBirdPrice: null, earlyBirdDeadline: null },
        reseller: { name: 'Resale Rani' },
      })
      await expect(service.resolveSublinkToken('subtok')).rejects.toThrow(NotFoundError)
    })

    it('throws NotFoundError when the trip is not published (e.g. DRAFT/PAUSED, not ACTIVE)', async () => {
      mockResellerRepo.findActiveSublinkByToken.mockResolvedValue({
        id: 'sub-1', markupAmount: 500,
        trip: { id: 'trip-1', slug: 'goa-trip', status: 'DRAFT', isHidden: false, isDeleted: false, pricePerPerson: 5000, earlyBirdPrice: null, earlyBirdDeadline: null },
        reseller: { name: 'Resale Rani' },
      })
      await expect(service.resolveSublinkToken('subtok')).rejects.toThrow(NotFoundError)
    })

    it('applies the early-bird price instead of pricePerPerson when the early-bird deadline has not passed', async () => {
      mockResellerRepo.findActiveSublinkByToken.mockResolvedValue({
        id: 'sub-1', markupAmount: 500,
        trip: {
          id: 'trip-1', slug: 'goa-trip', status: 'ACTIVE', isHidden: false, isDeleted: false,
          pricePerPerson: 5000, earlyBirdPrice: 4000, earlyBirdDeadline: new Date(Date.now() + 86400000).toISOString(),
        },
        reseller: { name: 'Resale Rani' },
      })
      const result = await service.resolveSublinkToken('subtok')
      expect(result.effectivePrice).toBe(4500)
    })
  })

  describe('recordAttribution — idempotent, last-wins', () => {
    it('upserts the attribution for the resolved sublink', async () => {
      mockResellerRepo.findActiveSublinkByToken.mockResolvedValue({ id: 'sub-2', tripId: 'trip-1' })

      await service.recordAttribution('user-1', 'subtok2')

      expect(mockResellerRepo.upsertAttribution).toHaveBeenCalledWith('user-1', 'sub-2', 'trip-1')
    })

    it('throws NotFoundError when the token does not resolve to an active sublink', async () => {
      mockResellerRepo.findActiveSublinkByToken.mockResolvedValue(null)
      await expect(service.recordAttribution('user-1', 'bad-token')).rejects.toThrow(NotFoundError)
    })
  })
})
