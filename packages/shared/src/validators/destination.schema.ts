import { z } from 'zod'

export const createDestinationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only')
    .optional(),
  state: z.string().min(2, 'State is required').max(100).trim(),
  photoUrl: z.string().url().optional(),
  description: z.string().max(2000).optional(),
  isPopular: z.boolean().default(false),
})

export const updateDestinationSchema = createDestinationSchema.partial()

export const destinationDetailQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
})
