import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import { DestinationService } from '../services/destination.service'

export class DestinationController {
  constructor(private destinationService: DestinationService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const popular = req.query.popular === 'true' ? true : undefined
    const destinations = await this.destinationService.list({ popular })
    res.json({ success: true, data: destinations })
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const destination = await this.destinationService.getById(req.params.id)
    res.json({ success: true, data: destination })
  })

  getBySlug = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, tripType, sort, minPrice, maxPrice } = req.query as {
      page?: number
      limit?: number
      tripType?: string
      sort?: string
      minPrice?: number
      maxPrice?: number
    }
    const filters = { tripType, sort, minPrice, maxPrice } as Parameters<
      DestinationService['getBySlug']
    >[3]
    const data = await this.destinationService.getBySlug(req.params.slug, page, limit, filters)
    res.json({ success: true, data })
  })

  create = asyncHandler(async (req: Request, res: Response) => {
    const destination = await this.destinationService.create(req.body)
    res.status(201).json({ success: true, data: destination })
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const destination = await this.destinationService.update(req.params.id, req.body)
    res.json({ success: true, data: destination })
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.destinationService.delete(req.params.id)
    res.json({ success: true, message: 'Destination deleted' })
  })
}
