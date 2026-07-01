import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import { CONVERSATION_TYPE, CONVERSATION_STATUS } from '@shared/types/chat.types'
import type { ConversationListFilters, ConversationType, ConversationStatus } from '@shared/types/chat.types'
import { CHAT_SENDER_ROLE } from '@shared/constants'
import type { ChatSenderRole } from '@shared/constants'

const CHAT_USER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  role: true,
} as const

const CONVERSATION_SELECT = {
  id: true,
  type: true,
  status: true,
  tripId: true,
  travelerId: true,
  organizerProfileId: true,
  adminId: true,
  lastMessageAt: true,
  lastMessagePreview: true,
  unreadCountTraveler: true,
  unreadCountOrganizer: true,
  createdAt: true,
  traveler: { select: CHAT_USER_SELECT },
  organizerProfile: {
    select: {
      id: true,
      businessName: true,
      user: { select: CHAT_USER_SELECT },
    },
  },
  trip: {
    select: {
      id: true,
      title: true,
      slug: true,
    },
  },
} as const

export class ConversationRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Find or create a trip conversation between a traveler and organizer.
   * Uses upsert on the unique constraint [type, tripId, travelerId].
   */
  async findOrCreateTripChat(tripId: string, travelerId: string, organizerProfileId: string) {
    return this.prisma.conversation.upsert({
      where: {
        type_tripId_travelerId: {
          type: CONVERSATION_TYPE.TRIP_CHAT,
          tripId,
          travelerId,
        },
      },
      create: {
        type: CONVERSATION_TYPE.TRIP_CHAT,
        tripId,
        travelerId,
        organizerProfileId,
      },
      update: {},
      select: CONVERSATION_SELECT,
    })
  }

  /**
   * Find or create an admin support conversation for a user.
   * Since support conversations don't have a tripId, we use null.
   */
  async findOrCreateSupportChat(userId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: CONVERSATION_TYPE.ADMIN_SUPPORT,
        travelerId: userId,
        status: CONVERSATION_STATUS.ACTIVE,
        isDeleted: false,
      },
      select: CONVERSATION_SELECT,
    })

    if (existing) return existing

    try {
      return await this.prisma.conversation.create({
        data: {
          type: CONVERSATION_TYPE.ADMIN_SUPPORT,
          travelerId: userId,
          status: CONVERSATION_STATUS.ACTIVE,
        },
        select: CONVERSATION_SELECT,
      })
    } catch (err) {
      // Concurrent request won the race — unique constraint (P2002) means
      // the row now exists; re-fetch and return it.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.prisma.conversation.findFirstOrThrow({
          where: { type: CONVERSATION_TYPE.ADMIN_SUPPORT, travelerId: userId, isDeleted: false },
          select: CONVERSATION_SELECT,
        })
      }
      throw err
    }
  }

  /**
   * Find a conversation by ID with full relations.
   */
  async findById(id: string) {
    return this.prisma.conversation.findFirst({
      where: { id, isDeleted: false },
      select: CONVERSATION_SELECT,
    })
  }

  /**
   * List conversations for a user (as traveler OR as organizer).
   * Returns paginated results ordered by lastMessageAt desc.
   */
  async findByUserId(
    userId: string,
    organizerProfileId: string | null,
    filters: ConversationListFilters,
    pagination: { offset: number; limit: number },
  ) {
    const where: Prisma.ConversationWhereInput = {
      isDeleted: false,
      ...(filters.type && { type: filters.type as ConversationType }),
      ...(filters.status && { status: filters.status as ConversationStatus }),
      OR: [
        { travelerId: userId },
        ...(organizerProfileId ? [{ organizerProfileId }] : []),
        { adminId: userId },
      ],
    }

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        select: CONVERSATION_SELECT,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      }),
      this.prisma.conversation.count({ where }),
    ])

    return { data, total }
  }

  /**
   * List conversations for a specific trip (organizer view).
   * Bounded to 200 rows — a single trip is unlikely to exceed this, but
   * prevents unbounded memory growth if it ever does.
   */
  async findByTripId(tripId: string) {
    return this.prisma.conversation.findMany({
      where: { tripId, isDeleted: false },
      select: CONVERSATION_SELECT,
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      take: 200,
    })
  }

  /**
   * Find all active support conversations (admin view).
   */
  async findSupportConversations(pagination: { offset: number; limit: number }) {
    const where: Prisma.ConversationWhereInput = {
      type: CONVERSATION_TYPE.ADMIN_SUPPORT,
      isDeleted: false,
    }

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        select: CONVERSATION_SELECT,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      }),
      this.prisma.conversation.count({ where }),
    ])

    return { data, total }
  }

  /**
   * Update the last message preview and timestamp (denormalized).
   */
  async updateLastMessage(id: string, preview: string, timestamp: Date) {
    return this.prisma.conversation.update({
      where: { id },
      data: {
        lastMessagePreview: preview.substring(0, 100),
        lastMessageAt: timestamp,
      },
    })
  }

  /**
   * Increment unread count for the other participant.
   * role = who SENT the message (increment the OTHER person's counter).
   */
  async incrementUnread(id: string, senderRole: ChatSenderRole) {
    if (senderRole === CHAT_SENDER_ROLE.TRAVELER) {
      return this.prisma.conversation.update({
        where: { id },
        data: { unreadCountOrganizer: { increment: 1 } },
      })
    }
    return this.prisma.conversation.update({
      where: { id },
      data: { unreadCountTraveler: { increment: 1 } },
    })
  }

  /**
   * Reset unread count for a user when they read messages.
   */
  async resetUnread(id: string, readerRole: ChatSenderRole) {
    if (readerRole === CHAT_SENDER_ROLE.TRAVELER || readerRole === CHAT_SENDER_ROLE.ADMIN) {
      return this.prisma.conversation.update({
        where: { id },
        data: { unreadCountTraveler: 0 },
      })
    }
    return this.prisma.conversation.update({
      where: { id },
      data: { unreadCountOrganizer: 0 },
    })
  }

  /**
   * Update conversation status (admin closes support threads).
   */
  async updateStatus(id: string, status: ConversationStatus) {
    return this.prisma.conversation.update({
      where: { id },
      data: { status },
      select: CONVERSATION_SELECT,
    })
  }

  /**
   * Get total unread count for a user across all conversations.
   */
  async getTotalUnreadCount(userId: string, organizerProfileId: string | null) {
    const travelerUnread = await this.prisma.conversation.aggregate({
      where: {
        travelerId: userId,
        isDeleted: false,
        status: CONVERSATION_STATUS.ACTIVE,
      },
      _sum: { unreadCountTraveler: true },
    })

    let organizerUnread = 0
    if (organizerProfileId) {
      const result = await this.prisma.conversation.aggregate({
        where: {
          organizerProfileId,
          isDeleted: false,
          status: CONVERSATION_STATUS.ACTIVE,
        },
        _sum: { unreadCountOrganizer: true },
      })
      organizerUnread = result._sum.unreadCountOrganizer ?? 0
    }

    return (travelerUnread._sum.unreadCountTraveler ?? 0) + organizerUnread
  }
}
