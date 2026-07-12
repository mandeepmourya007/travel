import { describe, it, expect } from 'vitest'
import { getEmailTemplate } from '../../../src/templates'

describe('getEmailTemplate', () => {
  it('has no emoji in the TRIP_REQUEST_APPROVED subject (spam-filter trigger)', () => {
    const result = getEmailTemplate('TRIP_REQUEST_APPROVED', 'Approved', 'Your request was approved.', {
      tripName: 'Goa Beach Getaway',
      tripSlug: 'goa-beach-getaway',
    })

    // eslint-disable-next-line no-control-regex
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(result.subject)).toBe(false)
    expect(result.subject).toBe('Your request for Goa Beach Getaway is approved — complete payment now')
  })

  it('includes a real support contact address in every template footer', () => {
    const result = getEmailTemplate('BOOKING_CONFIRMED', 'Booking Confirmed', 'Your booking is confirmed.', {
      tripName: 'Goa Beach Getaway',
    })

    expect(result.html).toContain('support@safarnama.store')
    expect(result.html).toContain('mailto:support@safarnama.store')
  })
})
