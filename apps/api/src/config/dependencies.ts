import { prisma } from '../lib/prisma'
import { env } from './env'
import { logger } from '../utils/logger'
import { UserRepository } from '../repositories/user.repository'
import { RefreshTokenRepository } from '../repositories/refresh-token.repository'
import { DestinationRepository } from '../repositories/destination.repository'
import { TripRepository } from '../repositories/trip.repository'
import { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import { AuthService } from '../services/auth.service'
import { DestinationService } from '../services/destination.service'
import { TripService } from '../services/trip.service'
import { AuthController } from '../controllers/auth.controller'
import { DestinationController } from '../controllers/destination.controller'
import { TripController } from '../controllers/trip.controller'
import { createAuthMiddleware } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import { createAuthRoutes } from '../routes/auth.routes'
import { createDestinationRoutes } from '../routes/destination.routes'
import { createTripRoutes } from '../routes/trip.routes'

// JWT secrets are validated at startup by config/env.ts (min 32 chars)
const { JWT_SECRET, JWT_REFRESH_SECRET } = env

// ── Repositories ─────────────────────────────────────
const userRepo = new UserRepository(prisma)
const refreshTokenRepo = new RefreshTokenRepository(prisma)
const destinationRepo = new DestinationRepository(prisma)
const tripRepo = new TripRepository(prisma)
const organizerProfileRepo = new OrganizerProfileRepository(prisma)

// ── Services ─────────────────────────────────────────
export const authService = new AuthService(
  userRepo,
  refreshTokenRepo,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  logger,
)

const destinationService = new DestinationService(destinationRepo, logger)
const tripService = new TripService(tripRepo, destinationRepo, organizerProfileRepo, logger)

// ── Middleware ────────────────────────────────────────
export const authMiddleware = createAuthMiddleware(authService)

// ── Controllers ──────────────────────────────────────
const authController = new AuthController(authService)
const destinationController = new DestinationController(destinationService)
const tripController = new TripController(tripService)

// ── Routes ───────────────────────────────────────────
export const authRoutes = createAuthRoutes(authController, authMiddleware)
export const destinationRoutes = createDestinationRoutes(destinationController, authMiddleware, requireRole)
export const tripRoutes = createTripRoutes(tripController, authMiddleware, requireRole)
