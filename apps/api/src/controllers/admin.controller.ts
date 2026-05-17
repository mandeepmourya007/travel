import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import type { AdminService } from '../services/admin.service'
import type {
  OrganizerApprovalFilters, ApproveRejectDto, AdminBookingFilters,
  CashbackTripFilters, IssueCashbackDto, CashbackHistoryFilters,
  ReviewDocDto, AddDocCommentDto,
} from '@shared/types/admin.types'

export class AdminController {
  constructor(private adminService: AdminService) {}

  /** GET /admin/organizers — Paginated approval queue */
  getApprovalQueue = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.adminService.getApprovalQueue(
      req.query as OrganizerApprovalFilters,
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /admin/organizers/:id — Organizer detail */
  getOrganizerDetail = asyncHandler(async (req: Request, res: Response) => {
    const detail = await this.adminService.getOrganizerDetail(req.params.id)
    res.json({ success: true, data: detail })
  })

  /** PATCH /admin/organizers/:id/status — Approve/reject */
  approveOrReject = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.adminService.approveOrReject(
      req.params.id,
      req.body as ApproveRejectDto,
    )
    res.json({ success: true, data: result })
  })

  /** GET /admin/stats — Platform statistics */
  getPlatformStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await this.adminService.getPlatformStats()
    res.json({ success: true, data: stats })
  })

  /** GET /admin/bookings — Admin booking list */
  getBookings = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.adminService.getBookings(
      req.query as AdminBookingFilters,
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /admin/bookings/:id — Booking detail for disputes */
  getBookingDetail = asyncHandler(async (req: Request, res: Response) => {
    const detail = await this.adminService.getBookingDetail(req.params.id)
    res.json({ success: true, data: detail })
  })

  // ─── Cashback ───────────────────────────────────────

  /** GET /admin/cashback/trips — Completed trips for cashback */
  getCompletedTripsForCashback = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.adminService.getCompletedTripsForCashback(
      req.query as CashbackTripFilters,
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /admin/cashback/trips/:tripId — Trip cashback detail */
  getTripCashbackDetail = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.adminService.getTripCashbackDetail(req.params.tripId)
    res.json({ success: true, data })
  })

  /** POST /admin/cashback/issue — Issue cashback */
  issueCashback = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.adminService.issueCashback(
      req.user!.userId,
      req.body as IssueCashbackDto,
    )
    res.status(201).json({ success: true, data: result })
  })

  /** GET /admin/cashback/by-user — Cashback grouped by user */
  getCashbackHistoryByUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.adminService.getCashbackHistoryByUser(
      req.query as CashbackHistoryFilters,
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /admin/cashback/by-trip — Cashback grouped by trip */
  getCashbackHistoryByTrip = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.adminService.getCashbackHistoryByTrip(
      req.query as CashbackHistoryFilters,
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /admin/cashback/by-user/:userId — Per-user cashback detail */
  getCashbackUserDetail = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.adminService.getCashbackUserDetail(
      req.params.userId,
      req.query as CashbackHistoryFilters,
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  // ─── Document Review ───────────────────────────────

  /** PATCH /admin/organizers/:id/documents/:docType/review */
  reviewDocument = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.adminService.reviewDocument(
      req.user!.userId,
      req.params.id,
      req.params.docType,
      req.body as ReviewDocDto,
    )
    res.json({ success: true, data: result })
  })

  /** POST /admin/organizers/:id/comments */
  addDocComment = asyncHandler(async (req: Request, res: Response) => {
    const comment = await this.adminService.addDocComment(
      req.user!.userId,
      'ADMIN',
      req.params.id,
      req.body as AddDocCommentDto,
    )
    res.status(201).json({ success: true, data: comment })
  })

  /** GET /admin/organizers/:id/documents */
  getDocReviewDetail = asyncHandler(async (req: Request, res: Response) => {
    const detail = await this.adminService.getDocReviewDetail(req.params.id)
    res.json({ success: true, data: detail })
  })
}
