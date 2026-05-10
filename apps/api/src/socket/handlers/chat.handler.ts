import type { Server } from 'socket.io'
import type { AuthenticatedSocket } from '../middleware/socket-auth.middleware'
import { ChatService } from '../../services/chat.service'
import { logger } from '../../utils/logger'
import type { SendMessageDto } from '@shared/types/chat.types'

export function registerChatHandlers(io: Server, socket: AuthenticatedSocket, chatService: ChatService) {
  const userId = socket.userId
  const log = logger.child({ module: 'socket:chat', userId, socketId: socket.id })

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

  /** Send a message */
  socket.on('chat:send', async (data: SendMessageDto & { conversationId: string }) => {
    try {
      const { conversationId, ...dto } = data
      const message = await chatService.sendMessage(conversationId, userId, dto)

      io.to(`conversation:${conversationId}`).emit('chat:message', message)

      io.to(`conversation:${conversationId}`).emit('chat:conversation-update', {
        conversationId,
        lastMessagePreview: message.content.substring(0, 100),
        lastMessageAt: message.createdAt,
      })

      socket.emit('chat:send:ack', { messageId: message.id, status: 'sent' })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      socket.emit('chat:send:error', { error: errorMessage })
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
