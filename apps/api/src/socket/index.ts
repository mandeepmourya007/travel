import { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createSocketAuthMiddleware, type AuthenticatedSocket } from './middleware/socket-auth.middleware'
import { registerChatHandlers } from './handlers/chat.handler'
import { registerPresenceHandlers } from './handlers/presence.handler'
import { AuthService } from '../services/auth.service'
import { ChatService } from '../services/chat.service'
import { logger } from '../utils/logger'
import { redis } from '../config/redis'

export function createSocketServer(
  httpServer: HttpServer,
  authService: AuthService,
  chatService: ChatService,
  corsOrigins: string[],
) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
  })

  // Attach Redis adapter so room broadcasts and fetchSockets() work correctly
  // across all horizontal API instances. Without this, rooms are process-local
  // and chat messages only reach clients connected to the same node.
  // Falls back to the default in-memory adapter when Redis is unavailable (dev/CI).
  if (redis) {
    const pubClient = redis.duplicate()
    const subClient = redis.duplicate()
    io.adapter(createAdapter(pubClient, subClient))
    logger.info('Socket.IO: Redis adapter attached (multi-node ready)')
  } else {
    logger.warn('Socket.IO: Redis unavailable — using in-memory adapter (single-instance only)')
  }

  io.use(createSocketAuthMiddleware(authService))

  io.on('connection', (socket) => {
    const authedSocket = socket as AuthenticatedSocket
    const log = logger.child({ module: 'socket', userId: authedSocket.userId, socketId: socket.id })
    log.info('Socket connected')

    authedSocket.join(`user:${authedSocket.userId}`)

    registerChatHandlers(io, authedSocket, chatService)
    registerPresenceHandlers(io, authedSocket)

    socket.on('disconnect', (reason) => {
      log.debug({ reason }, 'Socket disconnected')
    })
  })

  logger.info('Socket.IO server initialized')
  return io
}
