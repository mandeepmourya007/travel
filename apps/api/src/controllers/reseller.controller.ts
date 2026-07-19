import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import { ResellerService } from '../services/reseller.service'
import { USER_ROLE } from '@shared/constants'
import type {
  ResellerMainLinkFilters,
  ResellerSublinkFilters,
  ResellerLeadFilters,
  MyMainLinksFilters,
} from '@shared/types/reseller.types'

export class ResellerController {
  constructor(private resellerService: ResellerService) {}

  // ─── Organizer: main links ─────────────────────────

  /** POST /reseller/main-links — Generate a shareable main link for (trip, reseller) */
  createMainLink = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.resellerService.generateMainLink(req.user!.userId, req.body)
    res.status(201).json({ success: true, data: result })
  })

  /** GET /reseller/main-links — Organizer's main links (filter by tripId/resellerId) */
  listMainLinks = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.resellerService.listMainLinksForOrganizer(req.user!.userId, req.query as unknown as ResellerMainLinkFilters)
    res.json({ success: true, data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total } })
  })

  /** GET /reseller/main-links/:mainLinkId/bookings — Bookings feed for a main link */
  getMainLinkBookings = asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.role === USER_ROLE.ADMIN
    const result = await this.resellerService.getMainLinkBookings(req.user!.userId, isAdmin, req.params.mainLinkId, req.query)
    res.json({ success: true, data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total } })
  })

  /** GET /reseller/leads — Organizer's per-sublink lead aggregation */
  getOrganizerLeads = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.resellerService.getOrganizerLeads(req.user!.userId, req.query as unknown as ResellerLeadFilters)
    res.json({ success: true, data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total } })
  })

  // ─── Reseller: main links shared with them ─────────

  /** GET /reseller/main-links/mine — Reseller's own active main links (trip-card landing page) */
  getMyMainLinks = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.resellerService.listMainLinksForReseller(req.user!.userId, req.query as unknown as MyMainLinksFilters)
    res.json({ success: true, data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total } })
  })

  // ─── Reseller: sublinks ────────────────────────────

  /** POST /reseller/sublinks — Create a sublink (with markup) off a main link */
  createSublink = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.resellerService.createSublink(req.user!.userId, req.body)
    res.status(201).json({ success: true, data: result })
  })

  /** GET /reseller/sublinks — Reseller's own sublinks (filter by tripId/mainLinkId) */
  listSublinks = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.resellerService.listSublinksForReseller(req.user!.userId, req.query as unknown as ResellerSublinkFilters)
    res.json({ success: true, data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total } })
  })

  /** PATCH /reseller/sublinks/:sublinkId — Edit markup/label/isActive */
  patchSublink = asyncHandler(async (req: Request, res: Response) => {
    await this.resellerService.patchSublink(req.user!.userId, req.params.sublinkId, req.body)
    res.json({ success: true })
  })

  /** GET /reseller/sublinks/:sublinkId/bookings — Bookings feed for a sublink */
  getSublinkBookings = asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.role === USER_ROLE.ADMIN
    const isOrganizer = req.user!.role === USER_ROLE.ORGANIZER
    const result = await this.resellerService.getSublinkBookings(
      req.user!.userId,
      isAdmin,
      isOrganizer,
      req.params.sublinkId,
      req.query,
    )
    res.json({ success: true, data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total } })
  })

  /** GET /reseller/my-leads — Reseller's own per-sublink lead aggregation */
  getMyLeads = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.resellerService.getResellerLeads(req.user!.userId, req.query as unknown as ResellerLeadFilters)
    res.json({ success: true, data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total } })
  })

  // ─── Admin ──────────────────────────────────────────

  /** GET /reseller/admin/leads — All leads, platform-wide */
  getAdminLeads = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.resellerService.getAdminLeads(req.query as unknown as ResellerLeadFilters)
    res.json({ success: true, data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total } })
  })

  // ─── Public resolve + attribution ──────────────────

  /** GET /reseller/sublinks/resolve/:token — PUBLIC. Price-display fields only. */
  resolveSublink = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.resellerService.resolveSublinkToken(req.params.token)
    res.json({ success: true, data: result })
  })

  /** POST /reseller/attribution — Authed, idempotent last-wins attribution upsert */
  recordAttribution = asyncHandler(async (req: Request, res: Response) => {
    await this.resellerService.recordAttribution(req.user!.userId, req.body.sublinkToken)
    res.json({ success: true })
  })

  // ─── Combobox search ────────────────────────────────

  /** GET /reseller/resellers/search — Organizer: own resellers; Admin: all resellers */
  searchResellers = asyncHandler(async (req: Request, res: Response) => {
    const { q, page, limit } = req.query as unknown as { q?: string; page?: number; limit?: number }
    const isAdmin = req.user!.role === USER_ROLE.ADMIN
    const result = await this.resellerService.searchResellers(req.user!.userId, isAdmin, q, page, limit)
    res.json({ success: true, data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total } })
  })

  /** GET /reseller/organizers/search — Admin only */
  searchOrganizers = asyncHandler(async (req: Request, res: Response) => {
    const { q, page, limit } = req.query as unknown as { q?: string; page?: number; limit?: number }
    const result = await this.resellerService.searchOrganizers(q, page, limit)
    res.json({ success: true, data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total } })
  })
}
