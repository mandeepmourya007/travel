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
  isPopular: z.boolean().default(false),
})

export const updateDestinationSchema = createDestinationSchema.partial()
