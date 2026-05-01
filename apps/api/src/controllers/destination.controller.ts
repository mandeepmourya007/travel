import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import { DestinationService } from '../services/destination.service'

export class DestinationController {
  constructor(private destinationService: DestinationService) {}

  list = asyncHandler(async (_req: Request, res: Response) => {
    const destinations = await this.destinationService.list()
    res.json({ success: true, data: destinations })
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const destination = await this.destinationService.getById(req.params.id)
    res.json({ success: true, data: destination })
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
