import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import { ChatService } from '../services/chat.service'
import type {
  ConversationListFilters,
  MessageListFilters,
  MessageSearchFilters,
  SendMessageDto,
  AddReactionDto,
} from '@shared/types/chat.types'

export class ChatController {
  constructor(private chatService: ChatService) {}

  /** POST /chat/conversations/trip/:tripId — Get or create a trip conversation */
  getOrCreateTripConversation = asyncHandler(async (req: Request, res: Response) => {
    const conversation = await this.chatService.getOrCreateTripConversation(
      req.params.tripId,
      req.user!.userId,
    )
    res.status(200).json({ success: true, data: conversation })
  })

  /** POST /chat/conversations/support — Get or create a support conversation */
  getOrCreateSupportConversation = asyncHandler(async (req: Request, res: Response) => {
    const conversation = await this.chatService.getOrCreateSupportConversation(req.user!.userId)
    res.status(200).json({ success: true, data: conversation })
  })

  /** GET /chat/conversations — List my conversations */
  getConversations = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.chatService.getConversations(
      req.user!.userId,
      req.query as ConversationListFilters,
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /chat/conversations/:id/messages — Get messages (paginated) */
  getMessages = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.chatService.getMessages(
      req.params.id,
      req.user!.userId,
      req.query as MessageListFilters,
    )
    res.json({ success: true, data: result.data, hasMore: result.hasMore, nextCursor: result.nextCursor })
  })

  /** GET /chat/conversations/:id/messages/search — Search messages */
  searchMessages = asyncHandler(async (req: Request, res: Response) => {
    const filters: MessageSearchFilters = {
      query: req.query.query as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    }
    const result = await this.chatService.searchMessages(
      req.params.id,
      req.user!.userId,
      filters,
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** POST /chat/conversations/:id/messages — Send a message (REST fallback) */
  sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const message = await this.chatService.sendMessage(
      req.params.id,
      req.user!.userId,
      req.body as SendMessageDto,
    )
    res.status(201).json({ success: true, data: message })
  })

  /** POST /chat/conversations/:id/messages/:msgId/reactions — Add reaction */
  addReaction = asyncHandler(async (req: Request, res: Response) => {
    const { emoji } = req.body as AddReactionDto
    const message = await this.chatService.addReaction(
      req.params.id,
      req.params.msgId,
      req.user!.userId,
      emoji,
    )
    res.json({ success: true, data: message })
  })

  /** DELETE /chat/conversations/:id/messages/:msgId/reactions/:emoji — Remove reaction */
  removeReaction = asyncHandler(async (req: Request, res: Response) => {
    const message = await this.chatService.removeReaction(
      req.params.id,
      req.params.msgId,
      req.user!.userId,
      req.params.emoji,
    )
    res.json({ success: true, data: message })
  })

  /** PATCH /chat/conversations/:id/close — Close conversation (admin) */
  closeConversation = asyncHandler(async (req: Request, res: Response) => {
    const conversation = await this.chatService.closeConversation(req.params.id)
    res.json({ success: true, data: conversation })
  })

  /** GET /chat/unread-count — Total unread count */
  getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.chatService.getUnreadCount(req.user!.userId)
    res.json({ success: true, data: result })
  })

  /** GET /chat/flagged — Get flagged messages (admin) */
  getFlaggedMessages = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)
    const result = await this.chatService.getFlaggedMessages({ page, limit })
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })
}
