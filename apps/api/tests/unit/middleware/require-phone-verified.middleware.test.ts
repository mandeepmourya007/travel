import { describe, it, expect, vi } from 'vitest'
import { createRequirePhoneVerified } from '../../../src/middleware/require-phone-verified.middleware'
import { AuthError, ForbiddenError, NotFoundError } from '../../../src/errors/app-error'
import type { UserRepository } from '../../../src/repositories/user.repository'

function buildReq(userId?: string) {
  return { user: userId ? { userId, role: 'TRAVELER' } : undefined } as any
}

describe('createRequirePhoneVerified', () => {
  it('calls next() without an error when the user is verified (fresh DB read, not req.user)', async () => {
    const findById = vi.fn().mockResolvedValue({ id: 'u1', phoneVerified: true })
    const userRepo = { findById } as unknown as UserRepository
    const middleware = createRequirePhoneVerified(userRepo)
    const next = vi.fn()

    // req.user carries no phoneVerified claim at all — proves the middleware
    // never reads a cached JWT claim and always does a fresh repo lookup.
    middleware(buildReq('u1'), {} as any, next)
    await vi.waitFor(() => expect(next).toHaveBeenCalled())

    expect(findById).toHaveBeenCalledWith('u1')
    expect(next).toHaveBeenCalledWith()
  })

  it('passes a ForbiddenError with subCode PHONE_NOT_VERIFIED when unverified', async () => {
    const findById = vi.fn().mockResolvedValue({ id: 'u1', phoneVerified: false })
    const userRepo = { findById } as unknown as UserRepository
    const middleware = createRequirePhoneVerified(userRepo)
    const next = vi.fn()

    middleware(buildReq('u1'), {} as any, next)
    await vi.waitFor(() => expect(next).toHaveBeenCalled())

    const err = next.mock.calls[0][0]
    expect(err).toBeInstanceOf(ForbiddenError)
    expect(err.subCode).toBe('PHONE_NOT_VERIFIED')
  })

  it('never calls next() with no error when unverified', async () => {
    const findById = vi.fn().mockResolvedValue({ id: 'u1', phoneVerified: false })
    const userRepo = { findById } as unknown as UserRepository
    const middleware = createRequirePhoneVerified(userRepo)
    const next = vi.fn()

    middleware(buildReq('u1'), {} as any, next)
    await vi.waitFor(() => expect(next).toHaveBeenCalled())

    expect(next).not.toHaveBeenCalledWith()
  })

  it('passes AuthError when req.user is missing (authMiddleware did not run)', () => {
    const findById = vi.fn()
    const userRepo = { findById } as unknown as UserRepository
    const middleware = createRequirePhoneVerified(userRepo)
    const next = vi.fn()

    middleware(buildReq(undefined), {} as any, next)

    expect(findById).not.toHaveBeenCalled()
    expect(next.mock.calls[0][0]).toBeInstanceOf(AuthError)
  })

  it('passes NotFoundError when the user no longer exists', async () => {
    const findById = vi.fn().mockResolvedValue(null)
    const userRepo = { findById } as unknown as UserRepository
    const middleware = createRequirePhoneVerified(userRepo)
    const next = vi.fn()

    middleware(buildReq('u1'), {} as any, next)
    await vi.waitFor(() => expect(next).toHaveBeenCalled())

    expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError)
  })
})
