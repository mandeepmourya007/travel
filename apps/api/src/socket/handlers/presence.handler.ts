import type { Server } from 'socket.io'
import type { AuthenticatedSocket } from '../middleware/socket-auth.middleware'
import { redis } from '../../config/redis'
import { logger } from '../../utils/logger'

const ONLINE_SET_KEY = 'chat:online_users'

export function registerPresenceHandlers(io: Server, socket: AuthenticatedSocket) {
  const userId = socket.userId
  const log = logger.child({ module: 'socket:presence', userId, socketId: socket.id })

  /** Mark user as online on connect */
  async function markOnline() {
    if (redis) {
      await redis.sadd(ONLINE_SET_KEY, userId)
    }
    socket.broadcast.emit('presence:online', { userId })
    log.debug('User online')
  }

  /** Mark user as offline on disconnect */
  async function markOffline() {
    const sockets = await io.fetchSockets()
    const stillConnected = sockets.some(
      (s) => (s as unknown as AuthenticatedSocket).userId === userId && s.id !== socket.id,
    )

    if (!stillConnected) {
      if (redis) {
        await redis.srem(ONLINE_SET_KEY, userId)
      }
      socket.broadcast.emit('presence:offline', { userId })
      log.debug('User offline')
    }
  }

  /** Check which users from a list are online */
  socket.on('presence:check', async ({ userIds }: { userIds: string[] }) => {
    try {
      let online: string[] = []

      if (redis) {
        const pipeline = redis.pipeline()
        for (const id of userIds) {
          pipeline.sismember(ONLINE_SET_KEY, id)
        }
        const results = await pipeline.exec()
        online = userIds.filter((_, i) => results && results[i] && results[i][1] === 1)
      } else {
        const sockets = await io.fetchSockets()
        const connectedUserIds = new Set(
          sockets.map((s) => (s as unknown as AuthenticatedSocket).userId),
        )
        online = userIds.filter((id) => connectedUserIds.has(id))
      }

      socket.emit('presence:status', { online })
    } catch (error) {
      log.error({ error }, 'Failed to check presence')
    }
  })

  // Register lifecycle
  markOnline()
  socket.on('disconnect', markOffline)
}
