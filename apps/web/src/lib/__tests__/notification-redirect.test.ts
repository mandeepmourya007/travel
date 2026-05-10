import { describe, it, expect } from 'vitest'
import { getNotificationRedirectUrl } from '../notification-redirect'
import { NOTIFICATION_TYPE } from '@shared/constants'

const NT = NOTIFICATION_TYPE

describe('getNotificationRedirectUrl', () => {
  // ── Booking-related → /my-bookings ──
  it.each([
    NT.BOOKING_CONFIRMED,
    NT.BOOKING_CANCELLED,
    NT.PAYMENT_FAILED,
    NT.REFUND_PROCESSED,
  ])('%s → /my-bookings', (type) => {
    expect(getNotificationRedirectUrl(type, null)).toBe('/my-bookings')
  })

  // ── Payment received → /my-payments ──
  it('PAYMENT_RECEIVED → /my-payments', () => {
    expect(getNotificationRedirectUrl(NT.PAYMENT_RECEIVED, null)).toBe('/my-payments')
  })

  // ── Trip reminder / review → /trips/:slug ──
  it('TRIP_REMINDER with tripSlug → /trips/:slug', () => {
    expect(getNotificationRedirectUrl(NT.TRIP_REMINDER, { tripSlug: 'goa-beach' })).toBe('/trips/goa-beach')
  })

  it('TRIP_REMINDER without tripSlug → /my-bookings fallback', () => {
    expect(getNotificationRedirectUrl(NT.TRIP_REMINDER, null)).toBe('/my-bookings')
  })

  it('REVIEW_REQUEST with tripSlug → /trips/:slug', () => {
    expect(getNotificationRedirectUrl(NT.REVIEW_REQUEST, { tripSlug: 'ladakh-ride' })).toBe('/trips/ladakh-ride')
  })

  it('REVIEW_REQUEST without tripSlug → /my-bookings fallback', () => {
    expect(getNotificationRedirectUrl(NT.REVIEW_REQUEST, {})).toBe('/my-bookings')
  })

  // ── Chat message → /messages ──
  it('CHAT_MESSAGE with conversationId → /messages?conversation=:id', () => {
    expect(getNotificationRedirectUrl(NT.CHAT_MESSAGE, { conversationId: 'conv-1' })).toBe('/messages?conversation=conv-1')
  })

  it('CHAT_MESSAGE without conversationId → /messages', () => {
    expect(getNotificationRedirectUrl(NT.CHAT_MESSAGE, null)).toBe('/messages')
  })

  // ── Organizer status → /dashboard ──
  it.each([
    NT.ORGANIZER_APPROVED,
    NT.ORGANIZER_REJECTED,
  ])('%s → /dashboard', (type) => {
    expect(getNotificationRedirectUrl(type, null)).toBe('/dashboard')
  })

  // ── Trip requests (organizer) → /dashboard/requests ──
  it.each([
    NT.TRIP_REQUEST_RECEIVED,
    NT.TRIP_REQUEST_EXPIRED,
  ])('%s → /dashboard/requests', (type) => {
    expect(getNotificationRedirectUrl(type, null)).toBe('/dashboard/requests')
  })

  // ── Trip request approved → /trips/:slug/book ──
  it('TRIP_REQUEST_APPROVED with tripSlug → /trips/:slug/book', () => {
    expect(getNotificationRedirectUrl(NT.TRIP_REQUEST_APPROVED, { tripSlug: 'ladakh-bike' })).toBe('/trips/ladakh-bike/book')
  })

  it('TRIP_REQUEST_APPROVED without tripSlug → /my-bookings fallback', () => {
    expect(getNotificationRedirectUrl(NT.TRIP_REQUEST_APPROVED, null)).toBe('/my-bookings')
  })

  // ── Trip request rejected → /trips ──
  it('TRIP_REQUEST_REJECTED → /trips', () => {
    expect(getNotificationRedirectUrl(NT.TRIP_REQUEST_REJECTED, null)).toBe('/trips')
  })

  // ── Admin support → /admin ──
  it('ADMIN_SUPPORT_MESSAGE → /admin', () => {
    expect(getNotificationRedirectUrl(NT.ADMIN_SUPPORT_MESSAGE, null)).toBe('/admin')
  })

  // ── System alert → null ──
  it('SYSTEM_ALERT → null', () => {
    expect(getNotificationRedirectUrl(NT.SYSTEM_ALERT, null)).toBeNull()
  })

  // ── Edge: unknown type → null ──
  it('unknown type → null', () => {
    expect(getNotificationRedirectUrl('UNKNOWN' as never, null)).toBeNull()
  })

  // ── Edge: non-string tripSlug ignored ──
  it('non-string tripSlug falls back', () => {
    expect(getNotificationRedirectUrl(NT.TRIP_REMINDER, { tripSlug: 123 })).toBe('/my-bookings')
  })

  // ── Edge: non-string conversationId ignored ──
  it('non-string conversationId falls back to /messages', () => {
    expect(getNotificationRedirectUrl(NT.CHAT_MESSAGE, { conversationId: 42 })).toBe('/messages')
  })
})
