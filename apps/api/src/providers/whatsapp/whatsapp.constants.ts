/**
 * WhatsApp / MSG91 constants — single source of truth for this provider module.
 * See `index.ts` for the public barrel export used by the rest of the app.
 */

/** Single MSG91 endpoint for all WhatsApp messages (OTP, transactional, promotional) */
export const MSG91_WA_API_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/'

/** Maps NotificationType → the env var name holding its Meta-approved template name. */
export const WHATSAPP_TEMPLATE_ENV_KEY = {
  BOOKING_CONFIRMED:          'MSG91_WA_TPL_BOOKING_CONFIRMED',
  BOOKING_CANCELLED:          'MSG91_WA_TPL_BOOKING_CANCELLED',
  PAYMENT_RECEIVED:           'MSG91_WA_TPL_PAYMENT_RECEIVED',
  PAYMENT_FAILED:             'MSG91_WA_TPL_PAYMENT_FAILED',
  REFUND_PROCESSED:           'MSG91_WA_TPL_REFUND_PROCESSED',
  TRIP_REMINDER:              'MSG91_WA_TPL_TRIP_REMINDER',
  ORGANIZER_APPROVED:         'MSG91_WA_TPL_ORGANIZER_APPROVED',
  ORGANIZER_REJECTED:         'MSG91_WA_TPL_ORGANIZER_REJECTED',
  TRIP_REQUEST_APPROVED:      'MSG91_WA_TPL_TRIP_REQUEST_APPROVED',
  DOCUMENT_REUPLOAD_REQUIRED: 'MSG91_WA_TPL_DOCUMENT_REUPLOAD_REQUIRED',
  WALLET_CREDIT_EXPIRING:     'MSG91_WA_TPL_WALLET_CREDIT_EXPIRING',
  TRIP_TYPE_REQUEST_APPROVED: 'MSG91_WA_TPL_TRIP_TYPE_REQUEST_APPROVED',
} as const

export const BROADCAST_TARGET_TYPE = {
  ALL_USERS:  'ALL_USERS',
  BY_ROLE:    'BY_ROLE',
  PHONE_LIST: 'PHONE_LIST',
} as const

export const BROADCAST_STATUS = {
  PENDING:    'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED:  'COMPLETED',
  FAILED:     'FAILED',
} as const

export const WHATSAPP_PROMO_MAX_RECIPIENTS = 500
// 50ms between sends ≈ 20 req/s — well within MSG91 limits.
// ⚠️  500 recipients × ~50ms delay = ~25s overhead (+ network latency per call).
// Render's 30s request timeout is tight at high counts. Phase 2: move to async queue.
export const WHATSAPP_PROMO_SEND_DELAY_MS = 50
