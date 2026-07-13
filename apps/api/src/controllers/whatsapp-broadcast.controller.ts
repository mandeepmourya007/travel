import type { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import type { WhatsappBroadcastService } from '../services/whatsapp-broadcast.service'
import type { SendWhatsappPromotionDto } from '@shared/validators/admin.schema'

export class WhatsappBroadcastController {
  constructor(private broadcastService: WhatsappBroadcastService) {}

  /** POST /admin/whatsapp/broadcast — Send a promotional WhatsApp broadcast */
  sendPromotion = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.broadcastService.sendPromotion(
      req.user!.userId,
      req.body as SendWhatsappPromotionDto,
    )
    res.status(200).json({ success: true, data: result })
  })

  /** GET /admin/whatsapp/broadcasts — Paginated broadcast history */
  getBroadcastHistory = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.broadcastService.getBroadcastHistory({
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    })
    res.status(200).json({ success: true, data: result.data, pagination: result.pagination })
  })
}
