import { z } from 'zod'
import { VERIFICATION_STATUSES, APPROVE_REJECT_ACTIONS } from '../constants/verification-status'
import { BOOKING_STATUSES } from '../constants/booking-status'
import { paginationSchema } from './common.schema'

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
})

/** Validates query params for GET /admin/cashback/trips */
export const cashbackTripFiltersSchema = paginationSchema.extend({
  search: z.string().max(100).trim().optional(),
})

/** Validates body for POST /admin/cashback/issue */
export const issueCashbackSchema = z.object({
  tripId: z.string().uuid(),
  items: z
    .array(
      z.object({
        bookingId: z.string().uuid(),
        userId: z.string().uuid(),
        amount: z.number().int().positive(),
      }),
    )
    .min(1),
})

/** Validates query params for GET /admin/cashback/by-user, /admin/cashback/by-trip */
export { paginationSchema as cashbackHistoryFiltersSchema } from './common.schema'
