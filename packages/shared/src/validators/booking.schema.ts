import { z } from 'zod'

export const createBookingSchema = z.object({
  tripId: z.string().cuid(),
  pickupPointId: z.string().cuid('Invalid pickup point').optional(),
  dropPointId: z.string().cuid('Invalid drop point').optional(),
  numTravelers: z.number().int().min(1).max(10),
  travelers: z
    .array(
      z.object({
        name: z.string().min(2).trim(),
        phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
        age: z.number().int().min(1).max(120),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
        isPrimary: z.boolean().default(false),
        emergencyContactName: z.string().optional(),
        emergencyContactPhone: z.string().optional(),
      }),
    )
    .min(1),
})

export const createTripRequestSchema = z.object({
  tripId: z.string().cuid(),
  message: z.string().max(500).optional(),
  numberOfTravelers: z.number().int().min(1).max(10),
})

export const respondTripRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  responseNote: z.string().max(500).optional(),
})

// ─── Organizer Trip Participants Filters ──────────────

const bookingStatusEnum = z.enum(['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REFUNDED', 'EXPIRED'])

export const tripBookingFiltersSchema = z.object({
  bookingStatus: z
    .union([
      bookingStatusEnum,
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
    .enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED'])
    .optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const createReviewSchema = z.object({
  tripId: z.string().cuid(),
  bookingId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10, 'Review must be at least 10 characters').max(1000),
})

// ─── Traveler "My Bookings" Filters & Actions ───────

export const myBookingFiltersSchema = z.object({
  tab: z.enum(['all', 'upcoming', 'completed', 'cancelled']).optional(),
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
