import { prisma } from '../lib/prisma'
import { logger } from '../utils/logger'
import { UserRepository } from '../repositories/user.repository'
import { RefreshTokenRepository } from '../repositories/refresh-token.repository'
import { AuthService } from '../services/auth.service'
import { AuthController } from '../controllers/auth.controller'
import { createAuthMiddleware } from '../middleware/auth.middleware'
import { createAuthRoutes } from '../routes/auth.routes'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-min-32-chars-long-here'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-min-32-chars-long'

// ── Repositories ─────────────────────────────────────
const userRepo = new UserRepository(prisma)
const refreshTokenRepo = new RefreshTokenRepository(prisma)

// ── Services ─────────────────────────────────────────
export const authService = new AuthService(
  userRepo,
  refreshTokenRepo,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  logger,
)

// ── Middleware ────────────────────────────────────────
export const authMiddleware = createAuthMiddleware(authService)

// ── Controllers ──────────────────────────────────────
const authController = new AuthController(authService)

// ── Routes ───────────────────────────────────────────
export const authRoutes = createAuthRoutes(authController, authMiddleware)
