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
  } as unknown as AuthService & {
    signup: ReturnType<typeof vi.fn>
    login: ReturnType<typeof vi.fn>
    refresh: ReturnType<typeof vi.fn>
    logout: ReturnType<typeof vi.fn>
    logoutAll: ReturnType<typeof vi.fn>
    getMe: ReturnType<typeof vi.fn>
    verifyAccessToken: ReturnType<typeof vi.fn>
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

function createTestApp(mockService: ReturnType<typeof createMockAuthService>) {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())

  const controller = new AuthController(mockService)
  const mockOtpService = { sendOtp: vi.fn(), verifyOtp: vi.fn() } as unknown as OtpService
  const otpController = new OtpController(mockOtpService)
  const authMiddleware = createAuthMiddleware(mockService)
  const router = createAuthRoutes(controller, otpController, authMiddleware)

  app.use('/api/v1/auth', router)
  app.use(errorHandler)
  return app
}

// ── Tests ─────────────────────────────────────────────

describe('Auth Routes (integration)', () => {
  let mockService: ReturnType<typeof createMockAuthService>
  let app: express.Express

  beforeEach(() => {
    vi.clearAllMocks()
    mockService = createMockAuthService()
    app = createTestApp(mockService)
  })

  // ── POST /signup ──────────────────────────────────

  describe('POST /api/v1/auth/signup', () => {
    const validBody = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password1',
      role: 'TRAVELER',
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
})
