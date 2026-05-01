import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'
import { ValidationError } from '../errors/app-error'

type RequestProperty = 'body' | 'query' | 'params'

export function validate(schema: ZodSchema, property: RequestProperty = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = schema.parse((req as any)[property])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(req as any)[property] = parsed
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }))
        next(new ValidationError('Validation failed', details))
      } else {
        next(err)
      }
    }
  }
}
