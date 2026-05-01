export type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'TRIP_REMINDER'
  | 'TRIP_CANCELLED'
  | 'REVIEW_RECEIVED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_RELEASED'
  | 'TRIP_REQUEST_RECEIVED'
  | 'TRIP_REQUEST_APPROVED'
  | 'TRIP_REQUEST_REJECTED'
  | 'TRIP_REQUEST_EXPIRED'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata?: Record<string, unknown>
  readAt?: string
  createdAt: string
}
