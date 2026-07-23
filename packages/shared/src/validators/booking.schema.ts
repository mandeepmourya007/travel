import { z } from 'zod'
import { idSchema } from './common.schema'
import { APPROVE_REJECT_ACTIONS } from '../constants/verification-status'
import { BOOKING_STATUSES, TRIP_REQUEST_STATUSES, TRIP_BOOKING_SORTS, MY_BOOKINGS_TABS } from '../constants/booking-status'
import { PAYMENT_PROVIDERS } from '../constants/payment'
import { verifyOtpSchema } from './auth.schema'

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
  // [TravelerDetail] travelers: z.array(travelerDetailSchema).min(1),
  travelers: z.array(travelerDetailSchema).optional(),
  seatIds: z.array(z.string().min(1)).min(1).max(10).optional(),
  // Reseller feature — opaque sublink token only, never a price. Server resolves
  // markup from this token (or a prior SublinkAttribution) at booking time.
  sublinkToken: z.string().min(1).optional(),
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
  // [TravelerDetail] travelers: z.array(travelerDetailSchema).min(1),
  travelers: z.array(travelerDetailSchema).optional(),
  // Reseller feature — see createBookingSchema comment.
  sublinkToken: z.string().min(1).optional(),
})

export const respondTripRequestSchema = z.object({
  status: z.enum(APPROVE_REJECT_ACTIONS),
  responseNote: z.string().max(500).optional(),
})

// ─── Organizer Trip Participants Filters ──────────────

const bookingStatusEnum = z.enum(BOOKING_STATUSES)

export const tripBookingFiltersSchema = z.object({
  bookingStatus: z
    .union([
      bookingStatusEnum,
      z.array(bookingStatusEnum),
      z.string().refine((v) => v.includes(','), 'Invalid booking status').transform((val) => val.split(',')).pipe(z.array(bookingStatusEnum)),
    ])
    .optional(),
  search: z.string().max(100).optional(),
  sort: z.enum(TRIP_BOOKING_SORTS).default('newest'),
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
  tab: z.enum(MY_BOOKINGS_TABS).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const cancelBookingSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500).trim(),
})

// ─── Payment Verification ──────────────────────────

// ─── Post-Payment Booking Contact Verification ──────

/** Body for POST /bookings/:id/contact/send-otp — booking-scoped, never writes to User */
export const bookingContactSchema = z.object({
  name: travelerDetailSchema.shape.name,
  phone: travelerDetailSchema.shape.phone,
})

/** Body for POST /bookings/:id/contact/verify-otp */
export const bookingContactVerifyOtpSchema = bookingContactSchema.extend({
  otp: verifyOtpSchema.shape.otp,
})

export const verifyPaymentSchema = z.object({
  provider: z.enum(PAYMENT_PROVIDERS).optional(),
  // Provider-neutral
  orderId: z.string().min(1).optional(),
  paymentId: z.string().min(1).optional(),
  signature: z.string().min(1).optional(),
  // Razorpay legacy (kept for backwards compat)
  razorpayOrderId: z.string().min(1).optional(),
  razorpayPaymentId: z.string().min(1).optional(),
  razorpaySignature: z.string().min(1).optional(),
}).refine(
  (d) => d.orderId || d.razorpayOrderId,
  { message: 'orderId is required', path: ['orderId'] },
)
