/**
 * FEATURE BRIEF: In-App Chat System
 * ==================================
 * 1. What:      Real-time messaging (Traveler ↔ Organizer, User → Admin support)
 * 2. Who:       Traveler, Organizer, Admin
 * 3. Why:       Keep communication on-platform, prevent leakage
 *
 * 4. API Endpoints:
 *    POST /api/v1/chat/conversations/trip/:tripId     — get/create trip chat
 *    POST /api/v1/chat/conversations/support          — get/create support chat
 *    GET  /api/v1/chat/conversations                  — list my conversations
 *    GET  /api/v1/chat/conversations/:id/messages     — get messages (paginated)
 *    GET  /api/v1/chat/conversations/:id/messages/search — search messages
 *    POST /api/v1/chat/conversations/:id/messages/:msgId/reactions — add reaction
 *    DELETE /api/v1/chat/conversations/:id/messages/:msgId/reactions/:emoji — remove reaction
 *    PATCH /api/v1/chat/conversations/:id/close       — close conversation (admin)
 *    GET  /api/v1/chat/unread-count                   — total unread count
 *
 * 5. DB Tables:  Conversation (extended), Message (extended)
 * 6. Validations: content max 2000, file max 10MB, valid emoji
 * 7. Error Cases: Not found, forbidden (not participant), validation (closed conversation)
 * 8. Side Effects: Anti-leakage filter, unread count management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatService } from '../../../src/services/chat.service'
import { logger } from '../../../src/utils/logger'
import { NotFoundError, ForbiddenError, ValidationError } from '../../../src/errors/app-error'

// ─── Mock repositories ──────────────────────────────
const mockConversationRepo = {
  findOrCreateTripChat: vi.fn(),
  findOrCreateSupportChat: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  findByTripId: vi.fn(),
  findSupportConversations: vi.fn(),
  updateLastMessage: vi.fn(),
  incrementUnread: vi.fn(),
  resetUnread: vi.fn(),
  updateStatus: vi.fn(),
  getTotalUnreadCount: vi.fn(),
}

const mockMessageRepo = {
  create: vi.fn(),
  findByConversationId: vi.fn(),
  markAsRead: vi.fn(),
  search: vi.fn(),
  findById: vi.fn(),
  addReaction: vi.fn(),
  removeReaction: vi.fn(),
  findFlaggedMessages: vi.fn(),
}

const mockTripRepo = {
  findById: vi.fn(),
}

const mockOrganizerProfileRepo = {
  findByUserId: vi.fn(),
}

let service: ChatService

beforeEach(() => {
  vi.clearAllMocks()
  /* eslint-disable @typescript-eslint/no-explicit-any -- mock constructor injection */
  service = new ChatService(
    mockConversationRepo as any,
    mockMessageRepo as any,
    mockTripRepo as any,
    mockOrganizerProfileRepo as any,
    logger as any,
  )
  /* eslint-enable @typescript-eslint/no-explicit-any */
})

// ─── Test data factories ─────────────────────────────
const TRAVELER_ID = 'user-traveler-1'
const ORGANIZER_USER_ID = 'user-organizer-1'
const ORGANIZER_PROFILE_ID = 'org-profile-1'
const TRIP_ID = 'trip-1'
const CONVERSATION_ID = 'conv-1'
const MESSAGE_ID = 'msg-1'

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: CONVERSATION_ID,
    type: 'TRIP_CHAT',
    status: 'ACTIVE',
    tripId: TRIP_ID,
    travelerId: TRAVELER_ID,
    organizerProfileId: ORGANIZER_PROFILE_ID,
    adminId: null,
    lastMessageAt: null,
    lastMessagePreview: null,
    unreadCountTraveler: 0,
    unreadCountOrganizer: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    traveler: { id: TRAVELER_ID, name: 'Priya', avatarUrl: null, role: 'TRAVELER' },
    organizerProfile: {
      id: ORGANIZER_PROFILE_ID,
      businessName: 'TripVibes',
      user: { id: ORGANIZER_USER_ID, name: 'Rahul', avatarUrl: null, role: 'ORGANIZER' },
    },
    trip: { id: TRIP_ID, title: 'Goa Beach Trip', slug: 'goa-beach-trip' },
    ...overrides,
  }
}

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: MESSAGE_ID,
    conversationId: CONVERSATION_ID,
    senderId: TRAVELER_ID,
    type: 'TEXT',
    content: 'Hey! Excited about the trip!',
    originalContent: null,
    isFlagged: false,
    readAt: null,
    fileUrl: null,
    fileName: null,
    fileSize: null,
    reactions: [],
    replyToId: null,
    replyTo: null,
    sender: { id: TRAVELER_ID, name: 'Priya', avatarUrl: null, role: 'TRAVELER' },
    createdAt: '2025-01-01T10:00:00.000Z',
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────

describe('ChatService', () => {
  describe('getOrCreateTripConversation', () => {
    it('should create a trip conversation for a valid traveler', async () => {
      const conversation = makeConversation()
      mockTripRepo.findById.mockResolvedValue({ id: TRIP_ID, organizerId: ORGANIZER_PROFILE_ID })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(null)
      mockConversationRepo.findOrCreateTripChat.mockResolvedValue(conversation)

      const result = await service.getOrCreateTripConversation(TRIP_ID, TRAVELER_ID)

      expect(result.id).toBe(CONVERSATION_ID)
      expect(mockConversationRepo.findOrCreateTripChat).toHaveBeenCalledWith(
        TRIP_ID, TRAVELER_ID, ORGANIZER_PROFILE_ID,
      )
    })

    it('should throw NotFoundError if trip does not exist', async () => {
      mockTripRepo.findById.mockResolvedValue(null)

      await expect(service.getOrCreateTripConversation('bad-id', TRAVELER_ID))
        .rejects.toThrow(NotFoundError)
    })

    it('should throw ValidationError if organizer tries to chat with themselves', async () => {
      mockTripRepo.findById.mockResolvedValue({ id: TRIP_ID, organizerId: ORGANIZER_PROFILE_ID })
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: ORGANIZER_PROFILE_ID })

      await expect(service.getOrCreateTripConversation(TRIP_ID, ORGANIZER_USER_ID))
        .rejects.toThrow(ValidationError)
    })
  })

  describe('getOrCreateSupportConversation', () => {
    it('should create a support conversation', async () => {
      const conversation = makeConversation({ type: 'ADMIN_SUPPORT', tripId: null, organizerProfileId: null })
      mockConversationRepo.findOrCreateSupportChat.mockResolvedValue(conversation)

      const result = await service.getOrCreateSupportConversation(TRAVELER_ID)

      expect(result.type).toBe('ADMIN_SUPPORT')
      expect(mockConversationRepo.findOrCreateSupportChat).toHaveBeenCalledWith(TRAVELER_ID)
    })
  })

  describe('sendMessage', () => {
    it('should send a clean text message', async () => {
      const conversation = makeConversation()
      const message = makeMessage()
      mockConversationRepo.findById.mockResolvedValue(conversation)
      mockMessageRepo.create.mockResolvedValue(message)
      mockConversationRepo.incrementUnread.mockResolvedValue(undefined)
      mockConversationRepo.updateLastMessage.mockResolvedValue(undefined)

      const result = await service.sendMessage(CONVERSATION_ID, TRAVELER_ID, {
        content: 'Hey! Excited about the trip!',
      })

      expect(result.content).toBe('Hey! Excited about the trip!')
      expect(mockMessageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: CONVERSATION_ID,
          senderId: TRAVELER_ID,
          content: 'Hey! Excited about the trip!',
          isFlagged: false,
          originalContent: null,
        }),
      )
    })

    it('should flag message with phone number and redact content', async () => {
      const conversation = makeConversation()
      const message = makeMessage({ content: '[contact info hidden]', isFlagged: true })
      mockConversationRepo.findById.mockResolvedValue(conversation)
      mockMessageRepo.create.mockResolvedValue(message)
      mockConversationRepo.incrementUnread.mockResolvedValue(undefined)
      mockConversationRepo.updateLastMessage.mockResolvedValue(undefined)

      await service.sendMessage(CONVERSATION_ID, TRAVELER_ID, {
        content: 'Call me at 9876543210',
      })

      expect(mockMessageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isFlagged: true,
          originalContent: 'Call me at 9876543210',
        }),
      )
    })

    it('should increment unread for organizer when traveler sends', async () => {
      const conversation = makeConversation()
      mockConversationRepo.findById.mockResolvedValue(conversation)
      mockMessageRepo.create.mockResolvedValue(makeMessage())
      mockConversationRepo.incrementUnread.mockResolvedValue(undefined)
      mockConversationRepo.updateLastMessage.mockResolvedValue(undefined)

      await service.sendMessage(CONVERSATION_ID, TRAVELER_ID, { content: 'hi' })

      expect(mockConversationRepo.incrementUnread).toHaveBeenCalledWith(CONVERSATION_ID, 'traveler')
    })

    it('should increment unread for traveler when organizer sends', async () => {
      const conversation = makeConversation()
      mockConversationRepo.findById.mockResolvedValue(conversation)
      mockMessageRepo.create.mockResolvedValue(makeMessage({ senderId: ORGANIZER_USER_ID }))
      mockConversationRepo.incrementUnread.mockResolvedValue(undefined)
      mockConversationRepo.updateLastMessage.mockResolvedValue(undefined)

      await service.sendMessage(CONVERSATION_ID, ORGANIZER_USER_ID, { content: 'Welcome!' })

      expect(mockConversationRepo.incrementUnread).toHaveBeenCalledWith(CONVERSATION_ID, 'organizer')
    })

    it('should throw NotFoundError if conversation does not exist', async () => {
      mockConversationRepo.findById.mockResolvedValue(null)

      await expect(service.sendMessage('bad-id', TRAVELER_ID, { content: 'hi' }))
        .rejects.toThrow(NotFoundError)
    })

    it('should throw ForbiddenError if user is not a participant', async () => {
      const conversation = makeConversation()
      mockConversationRepo.findById.mockResolvedValue(conversation)

      await expect(service.sendMessage(CONVERSATION_ID, 'stranger-id', { content: 'hi' }))
        .rejects.toThrow(ForbiddenError)
    })

    it('should throw ValidationError if conversation is closed', async () => {
      const conversation = makeConversation({ status: 'CLOSED' })
      mockConversationRepo.findById.mockResolvedValue(conversation)

      await expect(service.sendMessage(CONVERSATION_ID, TRAVELER_ID, { content: 'hi' }))
        .rejects.toThrow(ValidationError)
    })

    it('should not apply filter for IMAGE type messages', async () => {
      const conversation = makeConversation()
      const message = makeMessage({ type: 'IMAGE', content: 'photo.jpg', fileUrl: 'https://cloudinary.com/img.jpg' })
      mockConversationRepo.findById.mockResolvedValue(conversation)
      mockMessageRepo.create.mockResolvedValue(message)
      mockConversationRepo.incrementUnread.mockResolvedValue(undefined)
      mockConversationRepo.updateLastMessage.mockResolvedValue(undefined)

      await service.sendMessage(CONVERSATION_ID, TRAVELER_ID, {
        content: 'photo.jpg',
        type: 'IMAGE',
        fileUrl: 'https://cloudinary.com/img.jpg',
      })

      expect(mockMessageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isFlagged: false,
          originalContent: null,
        }),
      )
    })
  })

  describe('getMessages', () => {
    it('should return paginated messages and mark as read', async () => {
      const conversation = makeConversation()
      const messages = [makeMessage(), makeMessage({ id: 'msg-2' })]
      mockConversationRepo.findById.mockResolvedValue(conversation)
      mockMessageRepo.findByConversationId.mockResolvedValue({ data: messages, hasMore: false, nextCursor: null })
      mockMessageRepo.markAsRead.mockResolvedValue({ count: 1, readAt: new Date() })
      mockConversationRepo.resetUnread.mockResolvedValue(undefined)

      const result = await service.getMessages(CONVERSATION_ID, TRAVELER_ID, { limit: 50 })

      expect(result.data).toHaveLength(2)
      expect(mockMessageRepo.markAsRead).toHaveBeenCalledWith(CONVERSATION_ID, TRAVELER_ID)
      expect(mockConversationRepo.resetUnread).toHaveBeenCalledWith(CONVERSATION_ID, 'traveler')
    })

    it('should throw ForbiddenError if user is not a participant', async () => {
      const conversation = makeConversation()
      mockConversationRepo.findById.mockResolvedValue(conversation)

      await expect(service.getMessages(CONVERSATION_ID, 'stranger-id', {}))
        .rejects.toThrow(ForbiddenError)
    })
  })

  describe('markAsRead', () => {
    it('should mark messages as read and reset unread count', async () => {
      const conversation = makeConversation()
      mockConversationRepo.findById.mockResolvedValue(conversation)
      mockMessageRepo.markAsRead.mockResolvedValue({ count: 3, readAt: new Date() })
      mockConversationRepo.resetUnread.mockResolvedValue(undefined)

      const result = await service.markAsRead(CONVERSATION_ID, TRAVELER_ID)

      expect(result.count).toBe(3)
      expect(mockConversationRepo.resetUnread).toHaveBeenCalledWith(CONVERSATION_ID, 'traveler')
    })
  })

  describe('searchMessages', () => {
    it('should search messages within a conversation', async () => {
      const conversation = makeConversation()
      mockConversationRepo.findById.mockResolvedValue(conversation)
      mockMessageRepo.search.mockResolvedValue({ data: [makeMessage()], total: 1 })

      const result = await service.searchMessages(CONVERSATION_ID, TRAVELER_ID, { query: 'excited' })

      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })

    it('should throw ForbiddenError for non-participant', async () => {
      const conversation = makeConversation()
      mockConversationRepo.findById.mockResolvedValue(conversation)

      await expect(service.searchMessages(CONVERSATION_ID, 'stranger', { query: 'hi' }))
        .rejects.toThrow(ForbiddenError)
    })
  })

  describe('addReaction', () => {
    it('should add a reaction to a message', async () => {
      const conversation = makeConversation()
      const message = makeMessage({ reactions: [{ emoji: '👍', userId: TRAVELER_ID, userName: 'Priya', createdAt: '2025-01-01T10:00:00.000Z' }] })
      mockConversationRepo.findById.mockResolvedValue(conversation)
      mockMessageRepo.addReaction.mockResolvedValue(message)

      const result = await service.addReaction(CONVERSATION_ID, MESSAGE_ID, TRAVELER_ID, '👍')

      expect(mockMessageRepo.addReaction).toHaveBeenCalledWith(
        MESSAGE_ID,
        expect.objectContaining({ emoji: '👍', userId: TRAVELER_ID }),
      )
      expect(result).toBeDefined()
    })

    it('should throw NotFoundError if message does not exist', async () => {
      const conversation = makeConversation()
      mockConversationRepo.findById.mockResolvedValue(conversation)
      mockMessageRepo.addReaction.mockResolvedValue(null)

      await expect(service.addReaction(CONVERSATION_ID, 'bad-msg', TRAVELER_ID, '👍'))
        .rejects.toThrow(NotFoundError)
    })
  })

  describe('removeReaction', () => {
    it('should remove a reaction from a message', async () => {
      const conversation = makeConversation()
      const message = makeMessage({ reactions: [] })
      mockConversationRepo.findById.mockResolvedValue(conversation)
      mockMessageRepo.removeReaction.mockResolvedValue(message)

      const result = await service.removeReaction(CONVERSATION_ID, MESSAGE_ID, TRAVELER_ID, '👍')

      expect(mockMessageRepo.removeReaction).toHaveBeenCalledWith(MESSAGE_ID, TRAVELER_ID, '👍')
      expect(result).toBeDefined()
    })
  })

  describe('closeConversation', () => {
    it('should close a conversation', async () => {
      const conversation = makeConversation()
      mockConversationRepo.findById.mockResolvedValue(conversation)
      mockConversationRepo.updateStatus.mockResolvedValue({ ...conversation, status: 'CLOSED' })

      const result = await service.closeConversation(CONVERSATION_ID)

      expect(mockConversationRepo.updateStatus).toHaveBeenCalledWith(CONVERSATION_ID, 'CLOSED')
      expect(result.status).toBe('CLOSED')
    })

    it('should throw NotFoundError if conversation does not exist', async () => {
      mockConversationRepo.findById.mockResolvedValue(null)

      await expect(service.closeConversation('bad-id'))
        .rejects.toThrow(NotFoundError)
    })
  })

  describe('getUnreadCount', () => {
    it('should return total unread count for a user', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(null)
      mockConversationRepo.getTotalUnreadCount.mockResolvedValue(5)

      const result = await service.getUnreadCount(TRAVELER_ID)

      expect(result.totalUnread).toBe(5)
    })

    it('should include organizer unread for organizer users', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: ORGANIZER_PROFILE_ID })
      mockConversationRepo.getTotalUnreadCount.mockResolvedValue(8)

      const result = await service.getUnreadCount(ORGANIZER_USER_ID)

      expect(result.totalUnread).toBe(8)
      expect(mockConversationRepo.getTotalUnreadCount).toHaveBeenCalledWith(
        ORGANIZER_USER_ID, ORGANIZER_PROFILE_ID,
      )
    })
  })

  describe('getConversations', () => {
    it('should return paginated conversation list', async () => {
      const conversations = [makeConversation()]
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(null)
      mockConversationRepo.findByUserId.mockResolvedValue({ data: conversations, total: 1 })

      const result = await service.getConversations(TRAVELER_ID, { page: 1, limit: 20 })

      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })

    it('should pass organizer profile ID for organizer users', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: ORGANIZER_PROFILE_ID })
      mockConversationRepo.findByUserId.mockResolvedValue({ data: [], total: 0 })

      await service.getConversations(ORGANIZER_USER_ID, {})

      expect(mockConversationRepo.findByUserId).toHaveBeenCalledWith(
        ORGANIZER_USER_ID,
        ORGANIZER_PROFILE_ID,
        expect.any(Object),
        expect.any(Object),
      )
    })
  })
})
