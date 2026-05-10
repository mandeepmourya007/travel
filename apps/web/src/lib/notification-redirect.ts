import type { NotificationType } from '@shared/types/notification.types'
import { NOTIFICATION_TYPE } from '@shared/constants'

const NT = NOTIFICATION_TYPE

/**
 * Derives a redirect URL from a notification's type + data payload.
 * Returns null for notification types that have no meaningful destination.
 */
export function getNotificationRedirectUrl(
  type: NotificationType,
  data: Record<string, unknown> | null,
): string | null {
  const d = data ?? {}

  switch (type) {
    // ── Booking-related → /my-bookings ──
    case NT.BOOKING_CONFIRMED:
    case NT.BOOKING_CANCELLED:
    case NT.PAYMENT_FAILED:
    case NT.REFUND_PROCESSED:
      return '/my-bookings'

    // ── Payment received → organizer dashboard or bookings ──
    case NT.PAYMENT_RECEIVED:
      return '/my-payments'

    // ── Trip reminder / review → trip detail page ──
    case NT.TRIP_REMINDER:
    case NT.REVIEW_REQUEST:
      return typeof d.tripSlug === 'string' ? `/trips/${d.tripSlug}` : '/my-bookings'

    // ── Chat message → messages page ──
    case NT.CHAT_MESSAGE:
      return typeof d.conversationId === 'string'
        ? `/messages?conversation=${d.conversationId}`
        : '/messages'

    // ── Organizer status → organizer dashboard ──
    case NT.ORGANIZER_APPROVED:
    case NT.ORGANIZER_REJECTED:
      return '/dashboard'

    // ── Trip request received → organizer requests page ──
    case NT.TRIP_REQUEST_RECEIVED:
    case NT.TRIP_REQUEST_EXPIRED:
      return '/dashboard/requests'

    // ── Trip request approved → traveler should pay ──
    case NT.TRIP_REQUEST_APPROVED:
      return typeof d.tripSlug === 'string' ? `/trips/${d.tripSlug}/book` : '/my-bookings'

    // ── Trip request rejected → browse trips ──
    case NT.TRIP_REQUEST_REJECTED:
      return '/trips'

    // ── Admin support → admin organizers page ──
    case NT.ADMIN_SUPPORT_MESSAGE:
      return '/admin'

    // ── System alerts → no specific page ──
    case NT.SYSTEM_ALERT:
      return null

    default:
      return null
  }
}
