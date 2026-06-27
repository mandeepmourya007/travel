import { z } from 'zod'
import { idSchema } from './common.schema'
import { APPROVE_REJECT_ACTIONS } from '../constants/verification-status'
import { TRIP_REQUEST_STATUSES } from '../constants/booking-status'

/** Reusable traveler detail schema — shared between booking and trip request */
export const travelerDetailSchema = z.object({
  name: z.string().min(2).trim(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
  age: z.number().int().min(1).max(120),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  isPrimary: z.boolean().default(false),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
})

export const createBookingSchema = z.object({
  tripId: idSchema,
  pickupPointId: idSchema.optional(),
  dropPointId: idSchema.optional(),
  numTravelers: z.number().int().min(1).max(10),
  travelers: z.array(travelerDetailSchema).min(1),
  seatIds: z.array(z.string().min(1)).min(1).max(10).optional(),
})

export const createTripRequestSchema = z.object({
  tripId: idSchema,
  message: z.string().max(500).optional(),
  numberOfTravelers: z.number().int().min(1).max(10),
})

/** Body-only schema for POST /trips/:tripId/request — tripId comes from URL params (H3 fix) */
export const createTripRequestBodySchema = z.object({
  message: z.string().max(500).optional(),
  numberOfTravelers: z.number().int().min(1).max(10),
  travelers: z.array(travelerDetailSchema).min(1),
})

export const respondTripRequestSchema = z.object({
  status: z.enum(APPROVE_REJECT_ACTIONS),
  responseNote: z.string().max(500).optional(),
})

// ─── Organizer Trip Participants Filters ──────────────

const bookingStatusEnum = z.enum(['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REFUNDED', 'EXPIRED'])

export const tripBookingFiltersSchema = z.object({
  bookingStatus: z
    .union([
      bookingStatusEnum,
      z.array(bookingStatusEnum),
      z.string().refine((v) => v.includes(','), 'Invalid booking status').transform((val) => val.split(',')).pipe(z.array(bookingStatusEnum)),
    ])
    .optional(),
  search: z.string().max(100).optional(),
  sort: z.enum(['newest', 'oldest', 'amount_desc', 'amount_asc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const tripRequestFiltersSchema = z.object({
  status: z
    .enum(TRIP_REQUEST_STATUSES)
    .optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// ─── Traveler "My Bookings" Filters & Actions ───────

export const myBookingFiltersSchema = z.object({
  tab: z.enum(['all', 'upcoming', 'payment_pending', 'completed', 'cancelled']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const cancelBookingSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500).trim(),
})

// ─── Payment Verification ──────────────────────────

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, 'Order ID is required'),
  razorpayPaymentId: z.string().min(1, 'Payment ID is required'),
  razorpaySignature: z.string().min(1, 'Signature is required'),
})
