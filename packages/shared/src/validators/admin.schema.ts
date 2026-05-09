import { z } from 'zod'
import { VERIFICATION_STATUSES, APPROVE_REJECT_ACTIONS } from '../constants/verification-status'
import { BOOKING_STATUSES } from '../constants/booking-status'

/** Validates query params for GET /admin/organizers */
export const organizerApprovalFiltersSchema = z.object({
  status: z.enum(VERIFICATION_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/** Validates body for PATCH /admin/organizers/:id/status */
export const approveRejectSchema = z.object({
  action: z.enum(APPROVE_REJECT_ACTIONS),
  reason: z.string().max(500).trim().optional(),
})

/** Validates query params for GET /admin/bookings */
export const adminBookingFiltersSchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  search: z.string().max(100).trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
