import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import { UploadService } from '../services/upload.service'

export class UploadController {
  constructor(private uploadService: UploadService) {}

  getSignature = asyncHandler(async (req: Request, res: Response) => {
    const { folder } = req.body
    const signature = this.uploadService.generateSignature(folder)
    res.json({ success: true, data: signature })
  })
}
