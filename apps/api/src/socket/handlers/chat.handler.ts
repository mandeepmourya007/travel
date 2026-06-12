import type { Server } from 'socket.io'
import type { AuthenticatedSocket } from '../middleware/socket-auth.middleware'
import { ChatService } from '../../services/chat.service'
import { logger } from '../../utils/logger'
import { sendMessageSchema } from '@shared/validators/chat.schema'
import type { SendMessageDto } from '@shared/types/chat.types'

const SOCKET_MSG_LIMIT = 10
const SOCKET_MSG_WINDOW_MS = 10_000

export function registerChatHandlers(io: Server, socket: AuthenticatedSocket, chatService: ChatService) {
  const userId = socket.userId
  const log = logger.child({ module: 'socket:chat', userId, socketId: socket.id })
  const msgTimestamps: number[] = []

  /** Join a conversation room — verify participant before allowing */
  socket.on('chat:join', async ({ conversationId }: { conversationId: string }) => {
    try {
      const allowed = await chatService.isParticipant(conversationId, userId)
      if (!allowed) {
        socket.emit('chat:error', { error: 'Not a participant of this conversation' })
        return
      }
      socket.join(`conversation:${conversationId}`)
      log.debug({ conversationId }, 'User joined conversation room')
    } catch (error) {
      log.error({ conversationId, error }, 'Failed to join conversation room')
    }
  })

  /** Leave a conversation room */
  socket.on('chat:leave', ({ conversationId }: { conversationId: string }) => {
    socket.leave(`conversation:${conversationId}`)
    log.debug({ conversationId }, 'User left conversation room')
  })

  /** Send a message — supports socket.io ack callback so the client can detect failures */
  socket.on('chat:send', async (
    data: SendMessageDto & { conversationId: string },
    ack?: (res: { ok: boolean; messageId?: string; error?: string }) => void,
  ) => {
    const reply = typeof ack === 'function' ? ack : undefined

    // Per-socket rate limit: max SOCKET_MSG_LIMIT messages per SOCKET_MSG_WINDOW_MS
    const now = Date.now()
    while (msgTimestamps.length > 0 && msgTimestamps[0]! <= now - SOCKET_MSG_WINDOW_MS) {
      msgTimestamps.shift()
    }
    if (msgTimestamps.length >= SOCKET_MSG_LIMIT) {
      reply?.({ ok: false, error: 'You are sending messages too fast. Please slow down.' })
      return
    }
    msgTimestamps.push(now)

    try {
      const { conversationId, ...rawDto } = data
      if (typeof conversationId !== 'string' || !conversationId) {
        reply?.({ ok: false, error: 'Invalid conversation' })
        return
      }

      // Same contract as the REST route — the socket path must not be a
      // validation bypass (content length, uuid clientMsgId, file fields)
      const parsed = sendMessageSchema.safeParse(rawDto)
      if (!parsed.success) {
        reply?.({ ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid message payload' })
        return
      }

      const message = await chatService.sendMessage(conversationId, userId, parsed.data)
      reply?.({ ok: true, messageId: message.id })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      reply?.({ ok: false, error: errorMessage })
      log.error({ error }, 'Socket message send failed')
    }
  })

  /** Typing indicator */
  socket.on('chat:typing', ({ conversationId, userName }: { conversationId: string; userName?: string }) => {
    socket.to(`conversation:${conversationId}`).emit('chat:typing-indicator', {
      conversationId,
      userId,
      userName: userName || 'Someone',
    })
  })

  /** Stop typing indicator */
  socket.on('chat:stop-typing', ({ conversationId, userName }: { conversationId: string; userName?: string }) => {
    socket.to(`conversation:${conversationId}`).emit('chat:stop-typing-indicator', {
      conversationId,
      userId,
      userName: userName || 'Someone',
    })
  })

  /** Mark messages as read */
  socket.on('chat:read', async ({ conversationId }: { conversationId: string }) => {
    try {
      const { readAt } = await chatService.markAsRead(conversationId, userId)

      socket.to(`conversation:${conversationId}`).emit('chat:read-receipt', {
        conversationId,
        userId,
        readAt: readAt.toISOString(),
      })
    } catch (error) {
      log.error({ conversationId, error }, 'Failed to mark as read')
    }
  })

  /** Add reaction */
  socket.on('chat:react', async ({ conversationId, messageId, emoji }: { conversationId: string; messageId: string; emoji: string }) => {
    try {
      const message = await chatService.addReaction(conversationId, messageId, userId, emoji)

      io.to(`conversation:${conversationId}`).emit('chat:reaction-update', {
        conversationId,
        messageId,
        reactions: message.reactions,
      })
    } catch (error) {
      log.error({ messageId, error }, 'Failed to add reaction')
    }
  })

  /** Remove reaction */
  socket.on('chat:unreact', async ({ conversationId, messageId, emoji }: { conversationId: string; messageId: string; emoji: string }) => {
    try {
      const message = await chatService.removeReaction(conversationId, messageId, userId, emoji)

      io.to(`conversation:${conversationId}`).emit('chat:reaction-update', {
        conversationId,
        messageId,
        reactions: message.reactions,
      })
    } catch (error) {
      log.error({ messageId, error }, 'Failed to remove reaction')
    }
  })
}
