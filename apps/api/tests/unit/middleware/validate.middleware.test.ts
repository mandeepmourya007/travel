import { describe, it, expect, vi } from 'vitest'
import { Request, Response } from 'express'
import { z } from 'zod'
import { validate } from '../../../src/middleware/validate.middleware'
import { ValidationError } from '../../../src/errors/app-error'

function createMockReqRes(body = {}, query = {}, params = {}) {
  const req = { body, query, params } as unknown as Request
  const res = {} as Response
  const next = vi.fn()
  return { req, res, next }
}

describe('validate middleware', () => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  })

  it('calls next() on valid body', () => {
    const { req, res, next } = createMockReqRes({ email: 'a@b.com', password: '12345678' })

    validate(schema)(req, res, next)

    expect(next).toHaveBeenCalledWith()
    expect(req.body).toEqual({ email: 'a@b.com', password: '12345678' })
  })

  it('replaces body with parsed/transformed data', () => {
    const trimSchema = z.object({ name: z.string().trim() })
    const { req, res, next } = createMockReqRes({ name: '  hello  ' })

    validate(trimSchema)(req, res, next)

    expect(req.body).toEqual({ name: 'hello' })
  })

  it('calls next with ValidationError on invalid body', () => {
    const { req, res, next } = createMockReqRes({ email: 'bad', password: '1' })

    validate(schema)(req, res, next)

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError))
    const error = next.mock.calls[0][0] as ValidationError
    expect(error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
        expect.objectContaining({ field: 'password' }),
      ]),
    )
  })

  it('validates query params when property is query', () => {
    const qSchema = z.object({ page: z.coerce.number().min(1) })
    const { req, res, next } = createMockReqRes({}, { page: '3' })

    validate(qSchema, 'query')(req, res, next)

    expect(next).toHaveBeenCalledWith()
    expect(req.query).toEqual({ page: 3 })
  })

  it('validates route params when property is params', () => {
    const pSchema = z.object({ id: z.string().uuid() })
    const validId = '550e8400-e29b-41d4-a716-446655440000'
    const { req, res, next } = createMockReqRes({}, {}, { id: validId })

    validate(pSchema, 'params')(req, res, next)

    expect(next).toHaveBeenCalledWith()
  })
})
