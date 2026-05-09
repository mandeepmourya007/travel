import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import { MESSAGE_TYPE } from '@shared/types/chat.types'
import type { Reaction } from '@shared/types/chat.types'

const CHAT_USER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  role: true,
} as const

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  senderId: true,
  type: true,
  content: true,
  originalContent: true,
  isFlagged: true,
  readAt: true,
  fileUrl: true,
  fileName: true,
  fileSize: true,
  reactions: true,
  replyToId: true,
  replyTo: {
    select: {
      id: true,
      content: true,
      senderId: true,
      type: true,
      sender: { select: { name: true } },
    },
  },
  sender: { select: CHAT_USER_SELECT },
  createdAt: true,
} as const

export class MessageRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Create a new message in a conversation.
   */
  async create(data: {
    conversationId: string
    senderId: string
    type?: typeof MESSAGE_TYPE[keyof typeof MESSAGE_TYPE]
    content: string
    originalContent?: string | null
    isFlagged?: boolean
    fileUrl?: string | null
    fileName?: string | null
    fileSize?: number | null
    replyToId?: string | null
  }) {
    return this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        type: data.type ?? MESSAGE_TYPE.TEXT,
        content: data.content,
        originalContent: data.originalContent ?? null,
        isFlagged: data.isFlagged ?? false,
        fileUrl: data.fileUrl ?? null,
        fileName: data.fileName ?? null,
        fileSize: data.fileSize ?? null,
        replyToId: data.replyToId ?? null,
      },
      select: MESSAGE_SELECT,
    })
  }

  /**
   * Find messages in a conversation with cursor-based pagination.
   * Returns messages ordered by createdAt DESC (newest first).
   */
  async findByConversationId(
    conversationId: string,
    pagination: { cursor?: string; limit: number },
  ) {
    const where: Prisma.MessageWhereInput = {
      conversationId,
      isDeleted: false,
    }

    const messages = await this.prisma.message.findMany({
      where,
      select: MESSAGE_SELECT,
      take: pagination.limit + 1,
      orderBy: { createdAt: 'desc' },
      ...(pagination.cursor && {
        cursor: { id: pagination.cursor },
        skip: 1,
      }),
    })

    const hasMore = messages.length > pagination.limit
    const data = hasMore ? messages.slice(0, pagination.limit) : messages

    return {
      data,
      hasMore,
      nextCursor: hasMore ? data[data.length - 1]?.id : null,
    }
  }

  /**
   * Mark all unread messages in a conversation as read for a specific user.
   * Only marks messages NOT sent by the reader.
   */
  async markAsRead(conversationId: string, readerId: string) {
    const now = new Date()
    const result = await this.prisma.message.updateMany({
      where: {
        conversationId,
        readAt: null,
        senderId: { not: readerId },
        isDeleted: false,
      },
      data: { readAt: now },
    })
    return { count: result.count, readAt: now }
  }

  /**
   * Search messages within a conversation by content.
   */
  async search(
    conversationId: string,
    query: string,
    pagination: { offset: number; limit: number },
  ) {
    const where: Prisma.MessageWhereInput = {
      conversationId,
      isDeleted: false,
      content: { contains: query, mode: 'insensitive' },
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        select: MESSAGE_SELECT,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.count({ where }),
    ])

    return { data, total }
  }

  /**
   * Find a message by ID.
   */
  async findById(id: string) {
    return this.prisma.message.findFirst({
      where: { id, isDeleted: false },
      select: MESSAGE_SELECT,
    })
  }

  /**
   * Add a reaction to a message (append to JSON array).
   */
  async addReaction(messageId: string, reaction: Reaction) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { reactions: true },
    })

    if (!message) return null

    const reactions = (message.reactions as unknown as Reaction[]) || []
    const existing = reactions.find(
      (r) => r.emoji === reaction.emoji && r.userId === reaction.userId,
    )
    if (existing) return message

    const updated = [...reactions, reaction]

    return this.prisma.message.update({
      where: { id: messageId },
      data: { reactions: updated as unknown as Prisma.InputJsonValue },
      select: MESSAGE_SELECT,
    })
  }

  /**
   * Remove a reaction from a message.
   */
  async removeReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { reactions: true },
    })

    if (!message) return null

    const reactions = (message.reactions as unknown as Reaction[]) || []
    const updated = reactions.filter(
      (r) => !(r.emoji === emoji && r.userId === userId),
    )

    return this.prisma.message.update({
      where: { id: messageId },
      data: { reactions: updated as unknown as Prisma.InputJsonValue },
      select: MESSAGE_SELECT,
    })
  }

  /**
   * Get all flagged messages (admin monitoring view).
   */
  async findFlaggedMessages(pagination: { offset: number; limit: number }) {
    const where: Prisma.MessageWhereInput = {
      isFlagged: true,
      isDeleted: false,
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        select: {
          ...MESSAGE_SELECT,
          conversation: {
            select: {
              id: true,
              type: true,
              trip: { select: { title: true, slug: true } },
            },
          },
        },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.count({ where }),
    ])

    return { data, total }
  }

  /** Count flagged messages. Used by: AdminService.getPlatformStats() */
  async countFlagged(): Promise<number> {
    return this.prisma.message.count({ where: { isFlagged: true, isDeleted: false } })
  }
}
