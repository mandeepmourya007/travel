import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import type { AdminService } from '../services/admin.service'
import type { OrganizerApprovalFilters, ApproveRejectDto, AdminBookingFilters } from '@shared/types/admin.types'

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
}
