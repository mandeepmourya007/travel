import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import { PaymentHistoryService } from '../services/payment-history.service'
import type { PaymentHistoryFilters, AdminPaymentFilters } from '@shared/types/payment.types'

export class PaymentHistoryController {
  constructor(private paymentHistoryService: PaymentHistoryService) {}

  /** GET /payments/my — Traveler's payment history */
  getMyPayments = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.paymentHistoryService.getMyPayments(
      req.user!.userId,
      req.query as PaymentHistoryFilters,
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /payments/my/summary — Traveler summary */
  getMyPaymentSummary = asyncHandler(async (req: Request, res: Response) => {
    const summary = await this.paymentHistoryService.getMyPaymentSummary(req.user!.userId)
    res.json({ success: true, data: summary })
  })

  /** GET /payments/trip/:tripId — Organizer's per-trip payments */
  getTripPayments = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.paymentHistoryService.getTripPayments(
      req.user!.userId,
      req.params.tripId,
      req.query as PaymentHistoryFilters,
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /payments/trip/:tripId/summary — Organizer trip summary */
  getTripPaymentSummary = asyncHandler(async (req: Request, res: Response) => {
    const summary = await this.paymentHistoryService.getTripPaymentSummary(
      req.user!.userId,
      req.params.tripId,
    )
    res.json({ success: true, data: summary })
  })

  /** GET /payments/admin — Admin global payments */
  getAllPayments = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.paymentHistoryService.getAllPayments(
      req.query as AdminPaymentFilters,
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /payments/admin/summary — Admin global summary */
  getGlobalSummary = asyncHandler(async (_req: Request, res: Response) => {
    const summary = await this.paymentHistoryService.getGlobalSummary()
    res.json({ success: true, data: summary })
  })
}
