import { z } from 'zod'
import { VERIFICATION_STATUSES, APPROVE_REJECT_ACTIONS } from '../constants/verification-status'
import { BOOKING_STATUSES } from '../constants/booking-status'
import { TRIP_STATUSES } from '../constants/trip-types'
import { DOC_TYPES } from '../constants/upload'
import { SORT_ORDERS, SORT_ORDER } from '../constants/sort'
import {
  ADMIN_REVIEW_SORT_BYS, ADMIN_BOOKING_SORT_BYS, ADMIN_TRIP_SORT_BYS,
  ADMIN_TRAVELLER_SORTS, ADMIN_ORGANIZER_SORTS, ADMIN_TRAVELLER_SORT, ADMIN_ORGANIZER_SORT,
  ADMIN_TRAVELLER_STATUSES,
} from '../constants/admin'
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
  tripId: idSchema.optional(),
  sortBy: z.enum(ADMIN_BOOKING_SORT_BYS).optional(),
  sortOrder: z.enum(SORT_ORDERS).optional(),
})

/** Validates query params for GET /admin/trips */
export const adminTripFiltersSchema = paginationSchema.extend({
  q: z.string().max(100).trim().optional(),
  status: z.enum(TRIP_STATUSES).optional(),
  sortBy: z.enum(ADMIN_TRIP_SORT_BYS).optional(),
  sortOrder: z.enum(SORT_ORDERS).optional(),
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

/** Validates query params for GET /admin/reviews */
export const adminReviewFiltersSchema = paginationSchema.extend({
  organizerSearch: z.string().max(100).trim().optional(),
  tripSearch: z.string().max(100).trim().optional(),
  tripId: idSchema.optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sortBy: z.enum(ADMIN_REVIEW_SORT_BYS).optional(),
  sortOrder: z.enum(SORT_ORDERS).optional(),
})

// ─── Admin User Directory ───────────────────────────────

/** Validates query params for GET /admin/users/travellers */
export const adminTravellerFiltersSchema = paginationSchema.extend({
  search: z.string().max(100).trim().optional(),
  status: z.enum(ADMIN_TRAVELLER_STATUSES).optional(),
  sortBy: z.enum(ADMIN_TRAVELLER_SORTS).default(ADMIN_TRAVELLER_SORT.JOINED_AT),
  sortOrder: z.enum(SORT_ORDERS).default(SORT_ORDER.DESC),
})

/** Validates query params for GET /admin/users/organizers */
export const adminOrganizerDirectoryFiltersSchema = paginationSchema.extend({
  search: z.string().max(100).trim().optional(),
  status: z.enum(VERIFICATION_STATUSES).optional(),
  sortBy: z.enum(ADMIN_ORGANIZER_SORTS).default(ADMIN_ORGANIZER_SORT.JOINED_AT),
  sortOrder: z.enum(SORT_ORDERS).default(SORT_ORDER.DESC),
})

/** Validates query params for GET /admin/users/travellers/:travellerId — filters the booked-trips sub-list */
export const adminTravellerDetailFiltersSchema = paginationSchema.extend({
  status: z.enum(BOOKING_STATUSES).optional(),
})

/** Validates query params for GET /admin/users/organizers/:organizerId — filters the trips-created sub-list */
export const adminOrganizerDetailFiltersSchema = paginationSchema.extend({
  status: z.enum(TRIP_STATUSES).optional(),
})
