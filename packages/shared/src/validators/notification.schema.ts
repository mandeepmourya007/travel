import { z } from 'zod'

export const notificationFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().default(false),
  ),
})

export const markReadParamsSchema = z.object({
  id: z.string().min(1),
})
