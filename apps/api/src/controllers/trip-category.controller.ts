import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import type { TripCategoryService } from '../services/trip-category.service'
import type {
  CreateTripCategoryDto,
  UpdateTripCategoryDto,
  CreateTripTypeRequestDto,
  ReviewTripTypeRequestDto,
  TripTypeRequestFilters,
} from '@shared/types/trip-category.types'

export class TripCategoryController {
  constructor(private tripCategoryService: TripCategoryService) {}

  // ─── Public ───────────────────────────────────────────

  /** GET /trip-categories — Active trip types for dropdowns/filters */
  getActiveCategories = asyncHandler(async (_req: Request, res: Response) => {
    const data = await this.tripCategoryService.getActiveCategories()
    res.json({ success: true, data })
  })

  // ─── Admin: Category CRUD ─────────────────────────────

  /** GET /admin/trip-categories — All categories with trip counts */
  getAllCategories = asyncHandler(async (_req: Request, res: Response) => {
    const data = await this.tripCategoryService.getAllCategories()
    res.json({ success: true, data })
  })

  /** POST /admin/trip-categories — Create category */
  createCategory = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.tripCategoryService.createCategory(req.body as CreateTripCategoryDto)
    res.status(201).json({ success: true, data })
  })

  /** PUT /admin/trip-categories/:id — Update category */
  updateCategory = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.tripCategoryService.updateCategory(
      req.params.id,
      req.body as UpdateTripCategoryDto,
    )
    res.json({ success: true, data })
  })

  /** DELETE /admin/trip-categories/:id — Delete category */
  deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    await this.tripCategoryService.deleteCategory(req.params.id)
    res.json({ success: true, data: { deleted: true } })
  })

  // ─── Admin: Request review ────────────────────────────

  /** GET /admin/trip-type-requests — Request queue */
  getRequests = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.tripCategoryService.getRequests(
      req.query as TripTypeRequestFilters,
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** PATCH /admin/trip-type-requests/:id — Approve/reject */
  reviewRequest = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.tripCategoryService.reviewRequest(
      req.params.id,
      req.body as ReviewTripTypeRequestDto,
    )
    res.json({ success: true, data })
  })

  // ─── Organizer: Submit/view requests ──────────────────

  /** POST /trip-type-requests — Submit a request */
  submitRequest = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.tripCategoryService.submitRequest(
      req.user!.userId,
      req.body as CreateTripTypeRequestDto,
    )
    res.status(201).json({ success: true, data })
  })

  /** GET /trip-type-requests/my — My requests */
  getMyRequests = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.tripCategoryService.getMyRequests(req.user!.userId)
    res.json({ success: true, data })
  })
}
