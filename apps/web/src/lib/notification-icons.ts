import type { NotificationType } from '@shared/types/notification.types'
import { NOTIFICATION_TYPE } from '@shared/constants'

const NT = NOTIFICATION_TYPE

/** Emoji icons for each notification type — single source of truth for bell + page */
export const NOTIFICATION_TYPE_ICON: Record<NotificationType, string> = {
  [NT.BOOKING_CONFIRMED]: '✅',
  [NT.BOOKING_CANCELLED]: '❌',
  [NT.PAYMENT_RECEIVED]: '💰',
  [NT.PAYMENT_FAILED]: '⚠️',
  [NT.REFUND_PROCESSED]: '💸',
  [NT.TRIP_REMINDER]: '🔔',
  [NT.REVIEW_REQUEST]: '⭐',
  [NT.CHAT_MESSAGE]: '💬',
  [NT.ORGANIZER_APPROVED]: '🎉',
  [NT.ORGANIZER_REJECTED]: '😔',
  [NT.TRIP_REQUEST_RECEIVED]: '📩',
  [NT.TRIP_REQUEST_APPROVED]: '👍',
  [NT.TRIP_REQUEST_REJECTED]: '👎',
  [NT.TRIP_REQUEST_EXPIRED]: '⏰',
  [NT.ADMIN_SUPPORT_MESSAGE]: '🛡️',
  [NT.SYSTEM_ALERT]: '📢',
}
