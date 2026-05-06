import { z } from 'zod'
import { CONVERSATION_TYPE, CONVERSATION_STATUS, MESSAGE_TYPE } from '../types/chat.types'

export const CHAT_MAX_MESSAGE_LENGTH = 2000
export const CHAT_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(CHAT_MAX_MESSAGE_LENGTH, `Message must be under ${CHAT_MAX_MESSAGE_LENGTH} characters`).trim(),
  type: z.enum([MESSAGE_TYPE.TEXT, MESSAGE_TYPE.IMAGE, MESSAGE_TYPE.FILE, MESSAGE_TYPE.SYSTEM]).default(MESSAGE_TYPE.TEXT),
  fileUrl: z.string().url().optional(),
  fileName: z.string().max(255).optional(),
  fileSize: z.number().int().min(1).max(CHAT_MAX_FILE_SIZE).optional(),
  replyToId: z.string().cuid().optional(),
})

export const createTripConversationSchema = z.object({
  tripId: z.string().cuid(),
})

export const addReactionSchema = z.object({
  emoji: z.string().min(1).max(8),
})

export const conversationListFiltersSchema = z.object({
  type: z.enum([CONVERSATION_TYPE.TRIP_CHAT, CONVERSATION_TYPE.ADMIN_SUPPORT]).optional(),
  status: z.enum([CONVERSATION_STATUS.ACTIVE, CONVERSATION_STATUS.ARCHIVED, CONVERSATION_STATUS.CLOSED]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const messageListFiltersSchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const messageSearchFiltersSchema = z.object({
  query: z.string().min(1).max(100).trim(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
