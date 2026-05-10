import { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { createSocketAuthMiddleware, type AuthenticatedSocket } from './middleware/socket-auth.middleware'
import { registerChatHandlers } from './handlers/chat.handler'
import { registerPresenceHandlers } from './handlers/presence.handler'
import { AuthService } from '../services/auth.service'
import { ChatService } from '../services/chat.service'
import { logger } from '../utils/logger'

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
