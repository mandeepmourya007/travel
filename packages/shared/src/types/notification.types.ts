export type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'REFUND_PROCESSED'
  | 'TRIP_REMINDER'
  | 'REVIEW_REQUEST'
  | 'CHAT_MESSAGE'
  | 'ORGANIZER_APPROVED'
  | 'ORGANIZER_REJECTED'
  | 'TRIP_REQUEST_RECEIVED'
  | 'TRIP_REQUEST_APPROVED'
  | 'TRIP_REQUEST_REJECTED'
  | 'TRIP_REQUEST_EXPIRED'
  | 'ADMIN_SUPPORT_MESSAGE'
  | 'SYSTEM_ALERT'

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP'

export interface NotificationListItem {
  id: string
  userId: string
  type: NotificationType
  channel: NotificationChannel
  title: string
  body: string
  data: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
}

export interface NotificationFilters {
  page?: number
  limit?: number
  unreadOnly?: boolean
}

export interface NotificationUnreadCountResponse {
  count: number
}

export interface MarkReadDto {
  notificationId: string
}

export interface NotificationSocketPayload {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data: Record<string, unknown> | null
  createdAt: string
}
