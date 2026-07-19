import { z } from 'zod'

/**
 * Resource identifier validator. Accepts BOTH id formats so rows from before
 * and after the UUIDv7 migration both validate:
 *   - Legacy cuid v1 (rows created while the schema used @default(cuid())).
 *     Format: 'c' + exactly 24 lowercase alphanumeric chars = 25 chars total.
 *     e.g. "clh3k2abc0001234567890abc"
 *   - UUIDv7 (current default — @default(uuid(7))).
 *     Standard 8-4-4-4-12 hex format.
 *
 * IMPORTANT: do NOT use z.string().uuid() here — zod's uuid regex only allows
 * versions 1–5 and REJECTS the version-7 nibble, so it would 400 every new id.
 * The regex below is version-agnostic for the UUID branch.
 */
export const idSchema = z
  .string()
  .regex(
    /^(c[a-z0-9]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
    'Invalid id',
  )

export const cuidParamSchema = z.object({
  id: idSchema,
})

export const slugParamSchema = z.object({
  slug: z.string().min(1).max(200),
})

export const tripIdParamSchema = z.object({
  tripId: idSchema,
})

export const bookingIdParamSchema = z.object({
  bookingId: idSchema,
})

export const tripRequestParamSchema = z.object({
  tripId: idSchema,
  requestId: idSchema,
})

export const organizerIdParamSchema = z.object({
  organizerId: idSchema,
})

export const travellerIdParamSchema = z.object({
  travellerId: idSchema,
})

export const mainLinkIdParamSchema = z.object({
  mainLinkId: idSchema,
})

export const sublinkIdParamSchema = z.object({
  sublinkId: idSchema,
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
