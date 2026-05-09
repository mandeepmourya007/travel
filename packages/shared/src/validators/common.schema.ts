import { z } from 'zod'

export const cuidParamSchema = z.object({
  id: z.string().cuid(),
})

export const slugParamSchema = z.object({
  slug: z.string().min(1).max(200),
})

export const tripIdParamSchema = z.object({
  tripId: z.string().cuid(),
})

export const bookingIdParamSchema = z.object({
  bookingId: z.string().cuid(),
})

export const tripRequestParamSchema = z.object({
  tripId: z.string().cuid(),
  requestId: z.string().cuid(),
})

export const organizerIdParamSchema = z.object({
  organizerId: z.string().cuid(),
})

/** Generic page + limit pagination schema — reuse across admin/wallet/etc routes */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const organizerProfileQuerySchema = z.object({
  tripsPage: z.coerce.number().int().min(1).default(1),
  tripsLimit: z.coerce.number().int().min(1).max(50).default(12),
  reviewsPage: z.coerce.number().int().min(1).default(1),
  reviewsLimit: z.coerce.number().int().min(1).max(50).default(10),
})
