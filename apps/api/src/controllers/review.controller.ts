import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import { ReviewService } from '../services/review.service'
import type { CreateReviewDto, UpdateReviewDto, OrganizerReplyDto, ReviewListFilters } from '@shared/types/review.types'

export class ReviewController {
  constructor(private reviewService: ReviewService) {}

  /** POST /reviews — Create a review for a completed booking */
  createReview = asyncHandler(async (req: Request, res: Response) => {
    const review = await this.reviewService.createReview(req.user!.userId, req.body as CreateReviewDto)
    res.status(201).json({ success: true, data: review })
  })

  /** PUT /reviews/:id — Edit own review within 30-day window */
  updateReview = asyncHandler(async (req: Request, res: Response) => {
    const review = await this.reviewService.updateReview(req.user!.userId, req.params.id, req.body as UpdateReviewDto)
    res.json({ success: true, data: review })
  })

  /** POST /reviews/:id/reply — Organizer replies to a review */
  addOrganizerReply = asyncHandler(async (req: Request, res: Response) => {
    const { reply } = req.body as OrganizerReplyDto
    const review = await this.reviewService.addOrganizerReply(req.user!.userId, req.params.id, reply)
    res.json({ success: true, data: review })
  })

  /** GET /reviews/trip/:tripId — Public paginated reviews for a trip */
  getTripReviews = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.reviewService.getReviewsForTrip(req.params.tripId, req.query as ReviewListFilters)
    res.json({ success: true, data: { reviews: result.data, summary: result.summary }, pagination: result.pagination })
  })

  /** GET /reviews/my/booking/:bookingId — Get own review for a booking */
  getMyReview = asyncHandler(async (req: Request, res: Response) => {
    const review = await this.reviewService.getMyReviewForBooking(req.user!.userId, req.params.bookingId)
    res.json({ success: true, data: review })
  })
}
