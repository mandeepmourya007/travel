import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import { BookingService } from '../services/booking.service'
import type { VerifyPaymentDto } from '@shared/types/payment.types'
import type { CreateBookingDto, MyBookingFilters } from '@shared/types/booking.types'

export class BookingController {
  constructor(private bookingService: BookingService) {}

  /** GET /bookings/my — Traveler's paginated booking list */
  getMyBookings = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.bookingService.getMyBookings(req.user!.userId, req.query as MyBookingFilters)
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

  /** GET /bookings/my/pending-requests — Approved requests awaiting payment */
  getPendingRequests = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.bookingService.getMyPendingPaymentRequests(req.user!.userId)
    res.json({ success: true, data })
  })

  /** GET /bookings/my/trip-status/:tripId — Check user's booking/request status for a trip */
  getMyTripStatus = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.bookingService.getMyTripStatus(req.user!.userId, req.params.tripId)
    res.json({ success: true, data })
  })

  /** POST /bookings — Create booking + Razorpay order */
  createBooking = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.bookingService.createBooking(req.user!.userId, req.body as CreateBookingDto)
    res.status(201).json({ success: true, data: result })
  })

  /** POST /bookings/:id/verify-payment — FE callback after Razorpay checkout */
  verifyPayment = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.bookingService.verifyAndConfirmPayment(req.params.id, req.user!.userId, req.body as VerifyPaymentDto)
    res.json({ success: true, data: result })
  })
}
