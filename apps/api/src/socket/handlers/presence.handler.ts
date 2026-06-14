import type { Server } from 'socket.io'
import type { AuthenticatedSocket } from '../middleware/socket-auth.middleware'
import { redis } from '../../config/redis'
import { logger } from '../../utils/logger'

const ONLINE_SET_KEY = 'chat:online_users'
/**
 * Hash key: field = userId, value = number of active connections.
 * Using a separate hash lets us atomically inc/dec and read without
 * scanning all sockets — O(1) and correct across multiple API nodes
 * (requires the @socket.io/redis-adapter to be attached).
 */
const CONN_COUNT_KEY = 'chat:conn_counts'

export function registerPresenceHandlers(io: Server, socket: AuthenticatedSocket) {
  const userId = socket.userId
  const log = logger.child({ module: 'socket:presence', userId, socketId: socket.id })

  /** Mark user as online on connect. */
  async function markOnline() {
    if (redis) {
      // Increment connection counter; add to online set on first connection
      const count = await redis.hincrby(CONN_COUNT_KEY, userId, 1)
      if (count === 1) {
        await redis.sadd(ONLINE_SET_KEY, userId)
      }
    }
    socket.broadcast.emit('presence:online', { userId })
    log.debug('User online')
  }

  /**
   * Mark user as offline on disconnect.
   *
   * Uses a per-user connection counter in Redis instead of io.fetchSockets().
   * io.fetchSockets() is process-local without the redis-adapter, so it gives
   * wrong answers in a multi-node deployment. The counter is shared across all
   * nodes and is O(1) per disconnect.
   */
  async function markOffline() {
    if (redis) {
      const remaining = await redis.hincrby(CONN_COUNT_KEY, userId, -1)
      if (remaining <= 0) {
        // Last connection gone — clean up and broadcast offline
        await redis.hdel(CONN_COUNT_KEY, userId)
        await redis.srem(ONLINE_SET_KEY, userId)
        socket.broadcast.emit('presence:offline', { userId })
        log.debug('User offline')
      }
      // else: user still has other open connections — stay online
    } else {
      // No Redis (dev / CI) — fall back to process-local socket scan
      const sockets = await io.fetchSockets()
      const stillConnected = sockets.some(
        (s) => (s as unknown as AuthenticatedSocket).userId === userId && s.id !== socket.id,
      )
      if (!stillConnected) {
        socket.broadcast.emit('presence:offline', { userId })
        log.debug('User offline (no-redis fallback)')
      }
    }
  }

  /** Check which users from a list are online. */
  socket.on('presence:check', async ({ userIds }: { userIds: string[] }) => {
    try {
      let online: string[] = []

      if (redis) {
        // Pipeline sismember calls — O(N) on user list, not on socket count
        const pipeline = redis.pipeline()
        for (const id of userIds) {
          pipeline.sismember(ONLINE_SET_KEY, id)
        }
        const results = await pipeline.exec()
        online = userIds.filter((_, i) => results && results[i] && results[i][1] === 1)
      } else {
        // No Redis — process-local fallback (single-instance dev only)
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
