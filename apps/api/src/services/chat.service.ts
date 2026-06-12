import { Prisma } from '@prisma/client'
import { Logger } from 'pino'
import type { Server } from 'socket.io'
import {
  CONVERSATION_STATUS,
  MESSAGE_TYPE,
} from '@shared/types/chat.types'
import type {
  ConversationListFilters,
  MessageListFilters,
  MessageSearchFilters,
  SendMessageDto,
  Reaction,
} from '@shared/types/chat.types'
import { ConversationRepository } from '../repositories/conversation.repository'
import { MessageRepository } from '../repositories/message.repository'
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../errors/app-error'
import { filterChatMessage } from '../utils/chat-filter'
import { PAGINATION_DEFAULTS, MESSAGE_PREVIEW_LENGTH } from '../utils/constants'

interface TripLookup {
  findById(id: string): Promise<{ id: string; organizerId: string } | null>
}

interface OrganizerProfileLookup {
  findByUserId(userId: string): Promise<{ id: string } | null>
}

export class ChatService {
  constructor(
    private conversationRepo: ConversationRepository,
    private messageRepo: MessageRepository,
    private tripRepo: TripLookup,
    private organizerProfileRepo: OrganizerProfileLookup,
    private logger: Logger,
    // Lazy getter — io doesn't exist yet when services are constructed
    private getIo: () => Server | null = () => null,
  ) {}

  /**
   * Get or create a trip conversation between a traveler and the trip organizer.
   *
   * Guards:
   * - Trip must exist
   * - User cannot be the organizer (they'd be chatting with themselves)
   */
  async getOrCreateTripConversation(tripId: string, userId: string) {
    const trip = await this.tripRepo.findById(tripId)
    if (!trip) throw new NotFoundError('Trip')

    const organizerProfileId = trip.organizerId

    const orgProfile = await this.organizerProfileRepo.findByUserId(userId)
    if (orgProfile && orgProfile.id === organizerProfileId) {
      throw new ValidationError('You cannot chat with yourself')
    }

    const conversation = await this.conversationRepo.findOrCreateTripChat(
      tripId,
      userId,
      organizerProfileId,
    )

    this.logger.info({ tripId, userId, conversationId: conversation.id }, 'Trip conversation accessed')
    return conversation
  }

  /**
   * Get or create a support conversation for a user to reach admin.
   */
  async getOrCreateSupportConversation(userId: string) {
    const conversation = await this.conversationRepo.findOrCreateSupportChat(userId)
    this.logger.info({ userId, conversationId: conversation.id }, 'Support conversation accessed')
    return conversation
  }

  /**
   * Send a message in a conversation.
   *
   * Guards:
   * - Conversation must exist
   * - Sender must be a participant
   * - Conversation must be ACTIVE
   *
   * Side effects:
   * - Anti-leakage filter applied
   * - Unread count incremented for the other participant
   * - Last message preview updated
   *
   * Idempotency: when dto.clientMsgId is set, a retried send (e.g. socket ack
   * timeout followed by REST fallback) returns the originally created message
   * instead of inserting a duplicate. Enforced by the DB unique constraint on
   * (conversationId, senderId, clientMsgId) — create-first, so concurrent
   * retries cannot race past a check.
   */
  async sendMessage(conversationId: string, senderId: string, dto: SendMessageDto) {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) throw new NotFoundError('Conversation')

    this.assertParticipant(conversation, senderId)

    if (conversation.status !== CONVERSATION_STATUS.ACTIVE) {
      throw new ValidationError('This conversation is closed')
    }

    let content = dto.content
    let originalContent: string | null = null
    let isFlagged = false

    if (dto.type === MESSAGE_TYPE.TEXT || !dto.type) {
      const filterResult = filterChatMessage(dto.content)
      content = filterResult.filtered
      originalContent = filterResult.originalContent
      isFlagged = filterResult.isFlagged

      if (isFlagged) {
        this.logger.warn({ conversationId, senderId }, 'Message flagged by anti-leakage filter')
      }
    }

    let message
    try {
      message = await this.messageRepo.create({
        conversationId,
        senderId,
        type: dto.type ?? MESSAGE_TYPE.TEXT,
        content,
        clientMsgId: dto.clientMsgId ?? null,
        originalContent,
        isFlagged,
        fileUrl: dto.fileUrl ?? null,
        fileName: dto.fileName ?? null,
        fileSize: dto.fileSize ?? null,
        replyToId: dto.replyToId ?? null,
      })
    } catch (err: unknown) {
      // P2002 = unique constraint violation -> this clientMsgId was already
      // persisted (retried send). Return the original row; counters and
      // broadcasts already ran for it, so skip the side effects.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && dto.clientMsgId) {
        const existing = await this.messageRepo.findByClientMsgId(conversationId, senderId, dto.clientMsgId)
        if (existing) {
          this.logger.info(
            { conversationId, messageId: existing.id, senderId, clientMsgId: dto.clientMsgId },
            'Duplicate send deduped via clientMsgId',
          )
          return existing
        }
        // Row was deleted between our INSERT attempt and this lookup (extremely rare
        // race). Throw a proper conflict error rather than leaking a raw Prisma P2002.
        throw new ConflictError('Message key conflict — please retry', 'DUPLICATE_MSG')
      }
      throw err
    }

    this.logger.info({ conversationId, messageId: message.id, senderId }, 'Message sent')

    // Broadcast from the service so every persistence path (socket AND the
    // REST fallback) reaches online participants. The dedup path above returns
    // early on purpose — the original insert already broadcast this message.
    this.broadcastNewMessage(conversationId, message)

    // Fire-and-forget: denormalized counter updates don't affect the returned message
    const senderRole = this.getSenderRole(conversation, senderId)
    void Promise.all([
      this.conversationRepo.incrementUnread(conversationId, senderRole),
      this.conversationRepo.updateLastMessage(conversationId, content, new Date()),
    ]).catch((err) => this.logger.error({ err, conversationId }, 'Failed to update conversation counters'))

    return message
  }

  private broadcastNewMessage(
    conversationId: string,
    message: { id: string; content: string; createdAt: Date | string },
  ) {
    const io = this.getIo()
    if (!io) return

    const room = `conversation:${conversationId}`
    io.to(room).emit('chat:message', message)
    io.to(room).emit('chat:conversation-update', {
      conversationId,
      lastMessagePreview: message.content.substring(0, MESSAGE_PREVIEW_LENGTH),
      lastMessageAt: message.createdAt,
    })
  }

  /**
   * Get paginated conversation list for a user.
   */
  async getConversations(userId: string, filters: ConversationListFilters) {
    const orgProfile = await this.organizerProfileRepo.findByUserId(userId)
    const page = filters.page ?? PAGINATION_DEFAULTS.page
    const limit = Math.min(filters.limit ?? PAGINATION_DEFAULTS.limit, PAGINATION_DEFAULTS.maxLimit)
    const offset = (page - 1) * limit

    const result = await this.conversationRepo.findByUserId(
      userId,
      orgProfile?.id ?? null,
      filters,
      { offset, limit },
    )

    return {
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    }
  }

  /**
   * Get paginated messages for a conversation.
   *
   * Guards:
   * - Conversation must exist
   * - Requester must be a participant
   *
   * Side effects:
   * - Marks messages as read for the requester
   * - Resets unread count for the requester
   */
  async getMessages(conversationId: string, userId: string, filters: MessageListFilters) {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) throw new NotFoundError('Conversation')

    this.assertParticipant(conversation, userId)

    const limit = filters.limit ?? 50

    const result = await this.messageRepo.findByConversationId(conversationId, {
      cursor: filters.cursor,
      limit,
    })

    // Fire-and-forget: mark-as-read side effects don't affect the response
    const readerRole = this.getSenderRole(conversation, userId)
    void Promise.all([
      this.messageRepo.markAsRead(conversationId, userId),
      this.conversationRepo.resetUnread(conversationId, readerRole),
    ]).catch((err) => this.logger.error({ err, conversationId }, 'Failed to mark messages as read'))

    return result
  }

  /**
   * Mark messages as read in a conversation.
   */
  async markAsRead(conversationId: string, userId: string) {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) throw new NotFoundError('Conversation')

    this.assertParticipant(conversation, userId)

    const { count, readAt } = await this.messageRepo.markAsRead(conversationId, userId)
    const readerRole = this.getSenderRole(conversation, userId)
    await this.conversationRepo.resetUnread(conversationId, readerRole)

    return { count, readAt }
  }

  /**
   * Search messages within a conversation.
   */
  async searchMessages(conversationId: string, userId: string, filters: MessageSearchFilters) {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) throw new NotFoundError('Conversation')

    this.assertParticipant(conversation, userId)

    const page = filters.page ?? 1
    const limit = Math.min(filters.limit ?? 20, 50)
    const offset = (page - 1) * limit

    const result = await this.messageRepo.search(conversationId, filters.query, { offset, limit })

    return {
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    }
  }

  /**
   * Add a reaction to a message.
   */
  async addReaction(conversationId: string, messageId: string, userId: string, emoji: string) {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) throw new NotFoundError('Conversation')

    this.assertParticipant(conversation, userId)

    const userName = this.getParticipantName(conversation, userId)
    const reaction: Reaction = {
      emoji,
      userId,
      userName,
      createdAt: new Date().toISOString(),
    }

    const message = await this.messageRepo.addReaction(messageId, reaction)
    if (!message) throw new NotFoundError('Message')

    return message
  }

  /**
   * Remove a reaction from a message.
   */
  async removeReaction(conversationId: string, messageId: string, userId: string, emoji: string) {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) throw new NotFoundError('Conversation')

    this.assertParticipant(conversation, userId)

    const message = await this.messageRepo.removeReaction(messageId, userId, emoji)
    if (!message) throw new NotFoundError('Message')

    return message
  }

  /**
   * Close a conversation (admin only).
   */
  async closeConversation(conversationId: string) {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) throw new NotFoundError('Conversation')

    return this.conversationRepo.updateStatus(conversationId, CONVERSATION_STATUS.CLOSED)
  }

  /**
   * Get total unread count for the header badge.
   */
  async getUnreadCount(userId: string) {
    const orgProfile = await this.organizerProfileRepo.findByUserId(userId)
    const totalUnread = await this.conversationRepo.getTotalUnreadCount(
      userId,
      orgProfile?.id ?? null,
    )
    return { totalUnread }
  }

  /**
   * Get flagged messages for admin review.
   */
  async getFlaggedMessages(pagination: { page: number; limit: number }) {
    const offset = (pagination.page - 1) * pagination.limit
    const result = await this.messageRepo.findFlaggedMessages({ offset, limit: pagination.limit })

    return {
      data: result.data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit),
      },
    }
  }

  /**
   * Public check — returns true if the user is a participant.
   * Used by socket handlers to gate room joins.
   */
  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) return false

    return (
      conversation.travelerId === userId ||
      conversation.organizerProfile?.user.id === userId ||
      conversation.adminId === userId
    )
  }

  /**
   * Verify the user is a participant of the conversation.
   */
  private assertParticipant(
    conversation: { travelerId: string; organizerProfile?: { user: { id: string } } | null; adminId?: string | null },
    userId: string,
  ) {
    const isParticipant =
      conversation.travelerId === userId ||
      conversation.organizerProfile?.user.id === userId ||
      conversation.adminId === userId

    if (!isParticipant) {
      throw new ForbiddenError('You are not a participant of this conversation')
    }
  }

  /**
   * Determine the sender's role in the conversation for unread counting.
   */
  private getSenderRole(
    conversation: { travelerId: string; organizerProfile?: { user: { id: string } } | null; adminId?: string | null },
    userId: string,
  ): 'traveler' | 'organizer' | 'admin' {
    if (conversation.organizerProfile?.user.id === userId) return 'organizer'
    if (conversation.adminId === userId) return 'admin'
    return 'traveler'
  }

  /**
   * Get participant display name from conversation data.
   */
  private getParticipantName(
    conversation: { traveler: { id: string; name: string }; organizerProfile?: { user: { id: string; name: string } } | null },
    userId: string,
  ): string {
    if (conversation.traveler.id === userId) return conversation.traveler.name
    if (conversation.organizerProfile?.user.id === userId) return conversation.organizerProfile.user.name
    return 'User'
  }
}
