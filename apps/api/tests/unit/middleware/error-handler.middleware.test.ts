import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response } from 'express'
import { errorHandler } from '../../../src/middleware/error-handler.middleware'
import { AppError, ValidationError } from '../../../src/errors/app-error'

function createMockReqRes() {
  const req = {
    path: '/test',
    method: 'GET',
    log: { warn: vi.fn(), error: vi.fn() },
  } as unknown as Request

  const json = vi.fn().mockReturnThis()
  const status = vi.fn().mockReturnThis()
  const set = vi.fn().mockReturnThis()
  const res = { status, json, set } as unknown as Response

  const next = vi.fn()
  return { req, res, status, json, set, next }
}

describe('errorHandler middleware', () => {
  describe('Cache-Control: no-store on all error responses', () => {
    it('sets no-store for AppError', () => {
      const { req, res, set } = createMockReqRes()
      const err = new AppError('Not found', 404, 'NOT_FOUND')

      errorHandler(err, req, res, vi.fn())

      expect(set).toHaveBeenCalledWith('Cache-Control', 'no-store')
    })

    it('sets no-store for ValidationError (ZodError-like)', () => {
      const { req, res, set } = createMockReqRes()
      const err = new ValidationError('Validation failed', [{ field: 'email', message: 'Required' }])

      errorHandler(err, req, res, vi.fn())

      expect(set).toHaveBeenCalledWith('Cache-Control', 'no-store')
    })

    it('sets no-store for unexpected errors (500 path)', () => {
      const { req, res, set } = createMockReqRes()
      const err = new Error('Something exploded')

      errorHandler(err, req, res, vi.fn())

      expect(set).toHaveBeenCalledWith('Cache-Control', 'no-store')
    })
  })

  describe('AppError responses', () => {
    it('responds with AppError statusCode and code', () => {
      const { req, res, status, json } = createMockReqRes()
      const err = new AppError('Not found', 404, 'NOT_FOUND')

      errorHandler(err, req, res, vi.fn())

      expect(status).toHaveBeenCalledWith(404)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'NOT_FOUND', message: 'Not found' }),
        }),
      )
    })

    it('includes details for ValidationError', () => {
      const { req, res, json } = createMockReqRes()
      const details = [{ field: 'email', message: 'Required' }]
      const err = new ValidationError('Validation failed', details)

      errorHandler(err, req, res, vi.fn())

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ details }),
        }),
      )
    })
  })

  describe('unexpected error (500)', () => {
    it('responds with 500 INTERNAL_ERROR for generic Error', () => {
      const { req, res, status, json } = createMockReqRes()

      errorHandler(new Error('boom'), req, res, vi.fn())

      expect(status).toHaveBeenCalledWith(500)
      expect(json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      })
    })

    it('responds with 500 for non-Error thrown values', () => {
      const { req, res, status } = createMockReqRes()

      errorHandler('string error' as any, req, res, vi.fn())

      expect(status).toHaveBeenCalledWith(500)
    })
  })
})
