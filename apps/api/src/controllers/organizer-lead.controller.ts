import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import { OrganizerLeadService } from '../services/organizer-lead.service'
import type {
  CreateOrganizerLeadDto,
  OrganizerLeadFilters,
  UpdateOrganizerLeadStatusDto,
} from '@shared/types/organizer-lead.types'

export class OrganizerLeadController {
  constructor(private leadService: OrganizerLeadService) {}

  submit = asyncHandler(async (req: Request, res: Response) => {
    const lead = await this.leadService.submit(req.body as CreateOrganizerLeadDto)
    res.status(201).json({ success: true, data: lead })
  })

  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.leadService.listForAdmin(req.query as OrganizerLeadFilters)
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const lead = await this.leadService.updateStatus(
      req.params.id,
      req.body as UpdateOrganizerLeadStatusDto,
    )
    res.json({ success: true, data: lead })
  })
}
