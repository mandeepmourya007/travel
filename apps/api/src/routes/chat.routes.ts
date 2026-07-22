import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import { USER_ROLE } from '@shared/constants'
import { ChatController } from '../controllers/chat.controller'
import { validate } from '../middleware/validate.middleware'
import {
  sendMessageSchema,
  addReactionSchema,
  conversationListFiltersSchema,
  messageListFiltersSchema,
  messageSearchFiltersSchema,
} from '@shared/validators/chat.schema'
import { cuidParamSchema, tripIdParamSchema } from '@shared/validators/common.schema'

export function createChatRoutes(
  chatController: ChatController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
  requirePhoneVerified: RequestHandler,
) {
  const router = Router()

  // All chat routes require authentication
  router.use(authMiddleware)

  // GET /chat/unread-count — Total unread badge count
  router.get('/unread-count', chatController.getUnreadCount)

  // POST /chat/conversations/trip/:tripId — Get or create trip conversation
  router.post(
    '/conversations/trip/:tripId',
    validate(tripIdParamSchema, 'params'),
    chatController.getOrCreateTripConversation,
  )

  // POST /chat/conversations/support — Get or create support conversation
  router.post('/conversations/support', chatController.getOrCreateSupportConversation)

  // GET /chat/conversations — List my conversations
  router.get(
    '/conversations',
    validate(conversationListFiltersSchema, 'query'),
    chatController.getConversations,
  )

  // GET /chat/conversations/:id/messages/search — Search messages (before :id/messages)
  router.get(
    '/conversations/:id/messages/search',
    validate(cuidParamSchema, 'params'),
    validate(messageSearchFiltersSchema, 'query'),
    chatController.searchMessages,
  )

  // GET /chat/conversations/:id/messages — Get messages (paginated)
  router.get(
    '/conversations/:id/messages',
    validate(cuidParamSchema, 'params'),
    validate(messageListFiltersSchema, 'query'),
    chatController.getMessages,
  )

  // POST /chat/conversations/:id/messages — Send a message (REST fallback)
  router.post(
    '/conversations/:id/messages',
    requirePhoneVerified,
    validate(cuidParamSchema, 'params'),
    validate(sendMessageSchema),
    chatController.sendMessage,
  )

  // POST /chat/conversations/:id/messages/:msgId/reactions — Add reaction
  router.post(
    '/conversations/:id/messages/:msgId/reactions',
    validate(addReactionSchema),
    chatController.addReaction,
  )

  // DELETE /chat/conversations/:id/messages/:msgId/reactions/:emoji — Remove reaction
  router.delete(
    '/conversations/:id/messages/:msgId/reactions/:emoji',
    chatController.removeReaction,
  )

  // PATCH /chat/conversations/:id/close — Close conversation (admin only)
  router.patch(
    '/conversations/:id/close',
    requireRole(USER_ROLE.ADMIN),
    validate(cuidParamSchema, 'params'),
    chatController.closeConversation,
  )

  // GET /chat/flagged — Get flagged messages (admin only)
  router.get(
    '/flagged',
    requireRole(USER_ROLE.ADMIN),
    chatController.getFlaggedMessages,
  )

  return router
}
