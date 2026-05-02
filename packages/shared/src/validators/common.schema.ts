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

export const tripRequestParamSchema = z.object({
  tripId: z.string().cuid(),
  requestId: z.string().cuid(),
})
