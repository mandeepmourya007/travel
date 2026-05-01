import { z } from 'zod'

export const cuidParamSchema = z.object({
  id: z.string().cuid(),
})

export const slugParamSchema = z.object({
  slug: z.string().min(1).max(200),
})
