// ─── Enums (const objects — usable at runtime in both BE & FE) ────

export const CONVERSATION_TYPE = {
  TRIP_CHAT: 'TRIP_CHAT',
  ADMIN_SUPPORT: 'ADMIN_SUPPORT',
} as const

export const MESSAGE_TYPE = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  FILE: 'FILE',
  SYSTEM: 'SYSTEM',
} as const

export const CONVERSATION_STATUS = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  CLOSED: 'CLOSED',
} as const

export type ConversationType = (typeof CONVERSATION_TYPE)[keyof typeof CONVERSATION_TYPE]
export type MessageType = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE]
export type ConversationStatus = (typeof CONVERSATION_STATUS)[keyof typeof CONVERSATION_STATUS]

// ─── Core Entities ────────────────────────────────────────

export interface ChatUser {
  id: string
  name: string
  avatarUrl?: string | null
  role: 'TRAVELER' | 'ORGANIZER' | 'ADMIN'
}

export interface Conversation {
  id: string
  type: ConversationType
  status: ConversationStatus
  tripId?: string | null
  travelerId: string
  organizerProfileId?: string | null
  adminId?: string | null
  lastMessageAt?: string | null
  lastMessagePreview?: string | null
  unreadCountTraveler: number
  unreadCountOrganizer: number
  createdAt: string
  traveler: ChatUser
  organizerProfile?: {
    id: string
    businessName: string
    user: ChatUser
  } | null
  trip?: {
    id: string
    title: string
    slug: string
  } | null
}

export interface ConversationListItem {
  id: string
  type: ConversationType
  status: ConversationStatus
  tripId?: string | null
  lastMessageAt?: string | null
  lastMessagePreview?: string | null
  unreadCount: number
  otherParticipant: ChatUser | null
  trip?: {
    title: string
    slug: string
  } | null
  createdAt: string
}

export interface Reaction {
  emoji: string
  userId: string
  userName: string
  createdAt: string
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  type: MessageType
  content: string
  originalContent?: string | null
  isFlagged: boolean
  readAt?: string | null
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  reactions: Reaction[]
  replyToId?: string | null
  replyTo?: {
    id: string
    content: string
    senderId: string
    senderName: string
    type: MessageType
  } | null
  sender: ChatUser
  createdAt: string
}

// ─── DTOs ─────────────────────────────────────────────────

export interface SendMessageDto {
  content: string
  type?: MessageType
  fileUrl?: string
  fileName?: string
  fileSize?: number
  replyToId?: string
}

export interface CreateTripConversationDto {
  tripId: string
}

export interface AddReactionDto {
  emoji: string
}

// ─── Filters ──────────────────────────────────────────────

export interface ConversationListFilters {
  type?: ConversationType
  status?: ConversationStatus
  page?: number
  limit?: number
}

export interface MessageListFilters {
  cursor?: string
  limit?: number
}

export interface MessageSearchFilters {
  query: string
  page?: number
  limit?: number
}

// ─── Responses ────────────────────────────────────────────

export interface ChatSummary {
  totalConversations: number
  totalUnread: number
  tripChats: number
  supportChats: number
}

export interface UnreadCountResponse {
  totalUnread: number
  conversations: Array<{
    conversationId: string
    unreadCount: number
  }>
}

// ─── Socket Events ────────────────────────────────────────

export interface ChatSocketEvents {
  // Client → Server
  'chat:join': { conversationId: string }
  'chat:leave': { conversationId: string }
  'chat:send': SendMessageDto & { conversationId: string }
  'chat:typing': { conversationId: string }
  'chat:stop-typing': { conversationId: string }
  'chat:read': { conversationId: string }
  'chat:react': { conversationId: string; messageId: string; emoji: string }
  'chat:unreact': { conversationId: string; messageId: string; emoji: string }

  // Server → Client
  'chat:message': Message
  'chat:typing-indicator': { conversationId: string; userId: string; userName: string }
  'chat:stop-typing-indicator': { conversationId: string; userId: string }
  'chat:read-receipt': { conversationId: string; userId: string; readAt: string }
  'chat:reaction-update': { conversationId: string; messageId: string; reactions: Reaction[] }
  'chat:conversation-update': { conversationId: string; lastMessagePreview: string; lastMessageAt: string }

  // Presence
  'presence:online': { userId: string }
  'presence:offline': { userId: string }
  'presence:check': { userIds: string[] }
  'presence:status': { online: string[] }
}
