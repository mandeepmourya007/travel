import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import { BookingService } from '../services/booking.service'

export class BookingController {
  constructor(private bookingService: BookingService) {}

  /** GET /bookings/my — Traveler's paginated booking list */
  getMyBookings = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.bookingService.getMyBookings(req.user!.userId, req.query as any)
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /bookings/my/summary — Tab count badges */
  getMyBookingSummary = asyncHandler(async (req: Request, res: Response) => {
    const summary = await this.bookingService.getMyBookingSummary(req.user!.userId)
    res.json({ success: true, data: summary })
  })

  /** POST /bookings/:id/cancel — Cancel booking with refund calculation */
  cancelBooking = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.bookingService.cancelBooking(
      req.user!.userId,
      req.params.id,
      req.body.reason,
    )
    res.json({ success: true, data: result })
  })
}
