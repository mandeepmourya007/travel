import type { Socket } from 'socket.io'
import type { ExtendedError } from 'socket.io/dist/namespace'
import { AuthService } from '../../services/auth.service'
import { logger } from '../../utils/logger'

export interface AuthenticatedSocket extends Socket {
  userId: string
  userRole: 'TRAVELER' | 'ORGANIZER' | 'ADMIN'
}

export function createSocketAuthMiddleware(authService: AuthService) {
  return async (socket: Socket, next: (err?: ExtendedError) => void) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined

      if (!token) {
        return next(new Error('Authentication token required'))
      }

      const payload = await authService.verifyAccessToken(token)

      if (!payload) {
        return next(new Error('Invalid or expired token'))
      }

      (socket as AuthenticatedSocket).userId = payload.userId;
      (socket as AuthenticatedSocket).userRole = payload.role

      logger.debug({ userId: payload.userId, socketId: socket.id }, 'Socket authenticated')
      next()
    } catch (error) {
      logger.warn({ socketId: socket.id, error }, 'Socket auth failed')
      next(new Error('Authentication failed'))
    }
  }
}
