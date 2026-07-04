import { z } from 'zod'
import { VERIFICATION_STATUSES, APPROVE_REJECT_ACTIONS } from '../constants/verification-status'
import { BOOKING_STATUSES } from '../constants/booking-status'
import { DOC_TYPES } from '../constants/upload'
import { paginationSchema, idSchema } from './common.schema'

/** Validates query params for GET /admin/organizers */
export const organizerApprovalFiltersSchema = paginationSchema.extend({
  status: z.enum(VERIFICATION_STATUSES).optional(),
})

/** Validates body for PATCH /admin/organizers/:id/status */
export const approveRejectSchema = z.object({
  action: z.enum(APPROVE_REJECT_ACTIONS),
  reason: z.string().max(500).trim().optional(),
})

/** Validates query params for GET /admin/bookings */
export const adminBookingFiltersSchema = paginationSchema.extend({
  status: z.enum(BOOKING_STATUSES).optional(),
  search: z.string().max(100).trim().optional(),
  sortBy: z.enum(['totalAmount', 'bookingStatus', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

/** Validates query params for GET /admin/trips */
export const adminTripFiltersSchema = paginationSchema.extend({
  q: z.string().max(100).trim().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'FULL', 'COMPLETED', 'CANCELLED']).optional(),
  sortBy: z.enum(['destination', 'startDate', 'pricePerPerson', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

/** Validates query params for GET /admin/cashback/trips */
export const cashbackTripFiltersSchema = paginationSchema.extend({
  search: z.string().max(100).trim().optional(),
})

/** Validates body for POST /admin/cashback/issue */
export const issueCashbackSchema = z.object({
  tripId: idSchema,
  items: z
    .array(
      z.object({
        bookingId: idSchema,
        userId: idSchema,
        amount: z.number().int().positive(),
      }),
    )
    .min(1),
})

/** Validates query params for GET /admin/cashback/by-user, /admin/cashback/by-trip */
export { paginationSchema as cashbackHistoryFiltersSchema } from './common.schema'

// ─── Document Review Schemas ─────────────────────────────

/** Validates body for PATCH /admin/organizers/:id/documents/:docType/review */
export const reviewDocSchema = z.object({
  action: z.enum(APPROVE_REJECT_ACTIONS),
  comment: z.string().max(500).trim().optional(),
})

/** Validates :docType route param — passthrough keeps other params like :id */
export const docTypeParamSchema = z.object({
  docType: z.enum(DOC_TYPES),
}).passthrough()

/** Validates body for POST /admin/organizers/:id/comments or organizer comment */
export const addDocCommentSchema = z.object({
  docType: z.enum(DOC_TYPES).optional(),
  comment: z.string().min(1, 'Comment is required').max(1000).trim(),
  attachmentUrl: z.string().url().optional(),
})

/** Validates query params for GET /admin/organizer-invites */
export const organizerInviteFiltersSchema = paginationSchema.extend({
  status: z.enum(['pending', 'accepted']).optional(),
})
