import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import { AuthController } from '../../src/controllers/auth.controller'
import { OtpController } from '../../src/controllers/otp.controller'
import { AuthService } from '../../src/services/auth.service'
import { OtpService } from '../../src/services/otp.service'
import { createAuthRoutes } from '../../src/routes/auth.routes'
import { createAuthMiddleware } from '../../src/middleware/auth.middleware'
import { errorHandler } from '../../src/middleware/error-handler.middleware'
import { requireRole } from '../../src/middleware/role.middleware'
import { AuthError, ConflictError } from '../../src/errors/app-error'

// ── Mock AuthService ──────────────────────────────────

function createMockAuthService() {
  return {
    signup: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    getMe: vi.fn(),
    verifyAccessToken: vi.fn(),
    googleAuth: vi.fn(),
    updateProfile: vi.fn(),
  } as unknown as AuthService & {
    signup: ReturnType<typeof vi.fn>
    login: ReturnType<typeof vi.fn>
    refresh: ReturnType<typeof vi.fn>
    logout: ReturnType<typeof vi.fn>
    logoutAll: ReturnType<typeof vi.fn>
    getMe: ReturnType<typeof vi.fn>
    verifyAccessToken: ReturnType<typeof vi.fn>
    googleAuth: ReturnType<typeof vi.fn>
    updateProfile: ReturnType<typeof vi.fn>
  }
}

const authResponse = {
  auth: {
    user: { id: 'u1', name: 'John', email: 'john@test.com', role: 'TRAVELER' },
    tokens: { accessToken: 'jwt-token', expiresIn: 900 },
  },
  refreshToken: 'raw-refresh-token',
}

// ── Test app factory ──────────────────────────────────

function createMockOtpService() {
  return {
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
    sendEmailOtp: vi.fn(),
    verifyEmailOtp: vi.fn(),
    sendPhoneOtpForAttach: vi.fn(),
    verifyPhoneOtpForAttach: vi.fn(),
  } as unknown as OtpService & {
    sendOtp: ReturnType<typeof vi.fn>
    verifyOtp: ReturnType<typeof vi.fn>
    sendEmailOtp: ReturnType<typeof vi.fn>
    verifyEmailOtp: ReturnType<typeof vi.fn>
    sendPhoneOtpForAttach: ReturnType<typeof vi.fn>
    verifyPhoneOtpForAttach: ReturnType<typeof vi.fn>
  }
}

function createTestApp(
  mockService: ReturnType<typeof createMockAuthService>,
  mockOtpService: ReturnType<typeof createMockOtpService> = createMockOtpService(),
) {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())

  const controller = new AuthController(mockService)
  const otpController = new OtpController(mockOtpService)
  const authMiddleware = createAuthMiddleware(mockService)
  const router = createAuthRoutes(controller, otpController, authMiddleware, requireRole)

  app.use('/api/v1/auth', router)
  app.use(errorHandler)
  return app
}

// ── Tests ─────────────────────────────────────────────

describe('Auth Routes (integration)', () => {
  let mockService: ReturnType<typeof createMockAuthService>
  let mockOtpService: ReturnType<typeof createMockOtpService>
  let app: express.Express

  beforeEach(() => {
    vi.clearAllMocks()
    mockService = createMockAuthService()
    mockOtpService = createMockOtpService()
    app = createTestApp(mockService, mockOtpService)
  })

  // ── POST /signup ──────────────────────────────────

  describe('POST /api/v1/auth/signup', () => {
    const validBody = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password1',
      role: 'TRAVELER',
      acceptedTerms: true,
    }

    it('returns 201 with auth data on success', async () => {
      mockService.signup.mockResolvedValue(authResponse)

      const res = await request(app).post('/api/v1/auth/signup').send(validBody)

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.user.email).toBe('john@test.com')
      expect(res.body.data.tokens.accessToken).toBeDefined()
    })

    it('sets httpOnly refresh token cookie', async () => {
      mockService.signup.mockResolvedValue(authResponse)

      const res = await request(app).post('/api/v1/auth/signup').send(validBody)

      const cookies = res.headers['set-cookie']
      expect(cookies).toBeDefined()
      expect(cookies[0]).toContain('refreshToken=')
      expect(cookies[0]).toContain('HttpOnly')
    })

    it('returns 400 on validation failure', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: 'bad', password: '1' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 409 on duplicate email', async () => {
      mockService.signup.mockRejectedValue(new ConflictError('Email exists'))

      const res = await request(app).post('/api/v1/auth/signup').send(validBody)

      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('CONFLICT')
    })

    it('returns 400 when role is ORGANIZER and acceptedOrganizerAgreement is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ ...validBody, role: 'ORGANIZER' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(mockService.signup).not.toHaveBeenCalled()
    })

    it('returns 400 when role is ORGANIZER and acceptedOrganizerAgreement is false', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ ...validBody, role: 'ORGANIZER', acceptedOrganizerAgreement: false })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(mockService.signup).not.toHaveBeenCalled()
    })

    it('returns 201 when role is ORGANIZER and acceptedOrganizerAgreement is true', async () => {
      mockService.signup.mockResolvedValue({
        ...authResponse,
        auth: { ...authResponse.auth, user: { ...authResponse.auth.user, role: 'ORGANIZER' } },
      })

      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ ...validBody, role: 'ORGANIZER', acceptedOrganizerAgreement: true })

      expect(res.status).toBe(201)
      expect(mockService.signup).toHaveBeenCalledOnce()
    })
  })

  // ── PATCH /profile ────────────────────────────────

  describe('PATCH /api/v1/auth/profile', () => {
    it('returns 400 when switching role to ORGANIZER without acceptedOrganizerAgreement', async () => {
      mockService.verifyAccessToken.mockReturnValue({ userId: 'u1', role: 'TRAVELER' })

      const res = await request(app)
        .patch('/api/v1/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Rahul', role: 'ORGANIZER' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(mockService.updateProfile).not.toHaveBeenCalled()
    })

    it('returns 400 when switching role to ORGANIZER with acceptedOrganizerAgreement false', async () => {
      mockService.verifyAccessToken.mockReturnValue({ userId: 'u1', role: 'TRAVELER' })

      const res = await request(app)
        .patch('/api/v1/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Rahul', role: 'ORGANIZER', acceptedOrganizerAgreement: false })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(mockService.updateProfile).not.toHaveBeenCalled()
    })

    it('returns 200 when switching role to ORGANIZER with acceptedOrganizerAgreement true', async () => {
      mockService.verifyAccessToken.mockReturnValue({ userId: 'u1', role: 'TRAVELER' })
      mockService.updateProfile.mockResolvedValue({
        id: 'u1',
        name: 'Rahul',
        role: 'ORGANIZER',
        accessToken: 'new-jwt',
      })

      const res = await request(app)
        .patch('/api/v1/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Rahul', role: 'ORGANIZER', acceptedOrganizerAgreement: true })

      expect(res.status).toBe(200)
      expect(res.body.data.role).toBe('ORGANIZER')
      expect(mockService.updateProfile).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ role: 'ORGANIZER', acceptedOrganizerAgreement: true }),
      )
    })
  })

  // ── POST /login ───────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    const loginBody = { email: 'john@example.com', password: 'Password1' }

    it('returns 200 with auth data', async () => {
      mockService.login.mockResolvedValue(authResponse)

      const res = await request(app).post('/api/v1/auth/login').send(loginBody)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.user).toBeDefined()
    })

    it('returns 401 on invalid credentials', async () => {
      mockService.login.mockRejectedValue(new AuthError('Invalid email or password'))

      const res = await request(app).post('/api/v1/auth/login').send(loginBody)

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    })

    it('returns 400 on missing email', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ password: 'x' })

      expect(res.status).toBe(400)
    })
  })

  // ── POST /refresh ─────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('returns new access token', async () => {
      mockService.refresh.mockResolvedValue({ accessToken: 'new-jwt', expiresIn: 900 })

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=raw-token')

      expect(res.status).toBe(200)
      expect(res.body.data.accessToken).toBe('new-jwt')
    })

    it('returns 401 when no cookie', async () => {
      const res = await request(app).post('/api/v1/auth/refresh')

      expect(res.status).toBe(401)
    })
  })

  // ── POST /logout ──────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('clears cookie and returns success', async () => {
      mockService.logout.mockResolvedValue(undefined)

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', 'refreshToken=raw-token')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  // ── POST /google ───────────────────────────────────

  describe('POST /api/v1/auth/google', () => {
    it('returns 400 when idToken missing', async () => {
      const res = await request(app).post('/api/v1/auth/google').send({})
      expect(res.status).toBe(400)
    })

    it('returns 201 for new Google user', async () => {
      mockService.googleAuth.mockResolvedValue({
        ...authResponse,
        isNewUser: true,
      })
      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: 'valid-google-token' })
      expect(res.status).toBe(201)
      expect(res.body.data.isNewUser).toBe(true)
    })

    it('returns 200 for existing Google user', async () => {
      mockService.googleAuth.mockResolvedValue({
        ...authResponse,
        isNewUser: false,
      })
      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: 'valid-google-token' })
      expect(res.status).toBe(200)
      expect(res.body.data.isNewUser).toBe(false)
    })
  })

  // ── GET /me ───────────────────────────────────────

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without auth header', async () => {
      const res = await request(app).get('/api/v1/auth/me')

      expect(res.status).toBe(401)
    })

    it('returns user data with valid token', async () => {
      mockService.verifyAccessToken.mockReturnValue({ userId: 'u1', role: 'TRAVELER' })
      mockService.getMe.mockResolvedValue({
        id: 'u1',
        name: 'John',
        email: 'john@test.com',
        role: 'TRAVELER',
      })

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer valid-token')

      expect(res.status).toBe(200)
      expect(res.body.data.email).toBe('john@test.com')
    })
  })

  // ── POST /otp/attach/send ─────────────────────────

  describe('POST /api/v1/auth/otp/attach/send', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/attach/send')
        .send({ phone: '9876543210' })

      expect(res.status).toBe(401)
      expect(mockOtpService.sendPhoneOtpForAttach).not.toHaveBeenCalled()
    })

    it('returns 200 and delegates to sendPhoneOtpForAttach with the authenticated userId', async () => {
      mockService.verifyAccessToken.mockReturnValue({ userId: 'u1', role: 'TRAVELER' })
      mockOtpService.sendPhoneOtpForAttach.mockResolvedValue({ message: 'OTP sent', retryAfter: 30 })

      const res = await request(app)
        .post('/api/v1/auth/otp/attach/send')
        .set('Authorization', 'Bearer valid-token')
        .send({ phone: '9876543210' })

      expect(res.status).toBe(200)
      expect(mockOtpService.sendPhoneOtpForAttach).toHaveBeenCalledWith('u1', '9876543210')
    })

    it('returns 409 when the phone is already linked to another account', async () => {
      mockService.verifyAccessToken.mockReturnValue({ userId: 'u1', role: 'TRAVELER' })
      mockOtpService.sendPhoneOtpForAttach.mockRejectedValue(
        new ConflictError('This phone number is already linked to another account', 'PHONE_TAKEN'),
      )

      const res = await request(app)
        .post('/api/v1/auth/otp/attach/send')
        .set('Authorization', 'Bearer valid-token')
        .send({ phone: '9876543210' })

      expect(res.status).toBe(409)
      expect(res.body.error.subCode).toBe('PHONE_TAKEN')
    })
  })

  // ── POST /otp/attach/verify ────────────────────────

  describe('POST /api/v1/auth/otp/attach/verify', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/attach/verify')
        .send({ phone: '9876543210', otp: '1234' })

      expect(res.status).toBe(401)
      expect(mockOtpService.verifyPhoneOtpForAttach).not.toHaveBeenCalled()
    })

    it('returns 200 with phone/phoneVerified and never sets a refresh cookie', async () => {
      mockService.verifyAccessToken.mockReturnValue({ userId: 'u1', role: 'TRAVELER' })
      mockOtpService.verifyPhoneOtpForAttach.mockResolvedValue({ phone: '9876543210', phoneVerified: true })

      const res = await request(app)
        .post('/api/v1/auth/otp/attach/verify')
        .set('Authorization', 'Bearer valid-token')
        .send({ phone: '9876543210', otp: '1234' })

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual({ phone: '9876543210', phoneVerified: true })
      expect(res.body.data.tokens).toBeUndefined()
      expect(res.headers['set-cookie']).toBeUndefined()
      expect(mockOtpService.verifyPhoneOtpForAttach).toHaveBeenCalledWith('u1', '9876543210', '1234')
    })

    it('returns 409 when the phone is already linked to another account', async () => {
      mockService.verifyAccessToken.mockReturnValue({ userId: 'u1', role: 'TRAVELER' })
      mockOtpService.verifyPhoneOtpForAttach.mockRejectedValue(
        new ConflictError('This phone number is already linked to another account', 'PHONE_TAKEN'),
      )

      const res = await request(app)
        .post('/api/v1/auth/otp/attach/verify')
        .set('Authorization', 'Bearer valid-token')
        .send({ phone: '9876543210', otp: '1234' })

      expect(res.status).toBe(409)
      expect(res.body.error.subCode).toBe('PHONE_TAKEN')
    })
  })
})
