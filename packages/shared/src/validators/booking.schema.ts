import { z } from 'zod'

export const createBookingSchema = z.object({
  tripId: z.string().cuid(),
  numberOfTravelers: z.number().int().min(1).max(10),
  travelers: z
    .array(
      z.object({
        name: z.string().min(2).trim(),
        phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
        age: z.number().int().min(1).max(120),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
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

export const tripBookingFiltersSchema = z.object({
  bookingStatus: z
    .enum(['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REFUNDED', 'EXPIRED'])
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
