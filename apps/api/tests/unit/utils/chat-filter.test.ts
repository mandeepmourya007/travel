import { describe, it, expect } from 'vitest'
import { filterChatMessage } from '../../../src/utils/chat-filter'

describe('filterChatMessage', () => {
  describe('clean messages', () => {
    it('should pass through clean messages unchanged', () => {
      const result = filterChatMessage('Hey! Excited about the Goa trip!')
      expect(result.filtered).toBe('Hey! Excited about the Goa trip!')
      expect(result.isFlagged).toBe(false)
      expect(result.originalContent).toBeNull()
    })

    it('should pass through messages with numbers less than 10 digits', () => {
      const result = filterChatMessage('We leave at 6AM. Group of 12 people.')
      expect(result.filtered).toBe('We leave at 6AM. Group of 12 people.')
      expect(result.isFlagged).toBe(false)
    })
  })

  describe('phone number detection', () => {
    it('should detect 10-digit Indian phone numbers', () => {
      const result = filterChatMessage('Call me at 9876543210')
      expect(result.isFlagged).toBe(true)
      expect(result.filtered).toContain('[contact info hidden]')
      expect(result.filtered).not.toContain('9876543210')
      expect(result.originalContent).toBe('Call me at 9876543210')
    })

    it('should detect phone with +91 prefix', () => {
      const result = filterChatMessage('My number is +91 9876543210')
      expect(result.isFlagged).toBe(true)
      expect(result.filtered).not.toContain('9876543210')
    })

    it('should detect phone with +91- prefix', () => {
      const result = filterChatMessage('Reach me at +91-8765432109')
      expect(result.isFlagged).toBe(true)
      expect(result.filtered).not.toContain('8765432109')
    })

    it('should not flag numbers starting with 0-5', () => {
      const result = filterChatMessage('Pin code is 4110481234')
      expect(result.isFlagged).toBe(false)
    })
  })

  describe('UPI ID detection', () => {
    it('should detect common UPI IDs', () => {
      const result = filterChatMessage('Pay me at rahul@ybl')
      expect(result.isFlagged).toBe(true)
      expect(result.filtered).not.toContain('rahul@ybl')
    })

    it('should detect paytm UPI', () => {
      const result = filterChatMessage('Send to priya.s@paytm')
      expect(result.isFlagged).toBe(true)
      expect(result.filtered).not.toContain('priya.s@paytm')
    })

    it('should detect bank-specific UPI', () => {
      const result = filterChatMessage('UPI: user@okhdfcbank')
      expect(result.isFlagged).toBe(true)
      expect(result.filtered).not.toContain('user@okhdfcbank')
    })
  })

  describe('Instagram handle detection', () => {
    it('should detect Instagram handles', () => {
      const result = filterChatMessage('Follow me @trip_organizer')
      expect(result.isFlagged).toBe(true)
      expect(result.filtered).not.toContain('@trip_organizer')
    })

    it('should detect handles with dots', () => {
      const result = filterChatMessage('Check out @travel.buddy.pune')
      expect(result.isFlagged).toBe(true)
      expect(result.filtered).not.toContain('@travel.buddy.pune')
    })
  })

  describe('WhatsApp link detection', () => {
    it('should detect wa.me links', () => {
      const result = filterChatMessage('Message me on wa.me/919876543210')
      expect(result.isFlagged).toBe(true)
      expect(result.filtered).not.toContain('wa.me/919876543210')
    })
  })

  describe('email detection', () => {
    it('should detect email addresses', () => {
      const result = filterChatMessage('Email me at organizer@gmail.com')
      expect(result.isFlagged).toBe(true)
      expect(result.filtered).not.toContain('organizer@gmail.com')
    })
  })

  describe('URL detection', () => {
    it('should detect URLs with http', () => {
      const result = filterChatMessage('Check https://mysite.com/trips')
      expect(result.isFlagged).toBe(true)
      expect(result.filtered).not.toContain('https://mysite.com/trips')
    })

    it('should detect URLs without protocol', () => {
      const result = filterChatMessage('Visit mytrips.in for details')
      expect(result.isFlagged).toBe(true)
      expect(result.filtered).not.toContain('mytrips.in')
    })
  })

  describe('multiple violations', () => {
    it('should redact all violations in a single message', () => {
      const result = filterChatMessage('Call 9876543210 or email me@gmail.com or @insta_handle')
      expect(result.isFlagged).toBe(true)
      expect(result.filtered).not.toContain('9876543210')
      expect(result.filtered).not.toContain('me@gmail.com')
      expect(result.filtered).not.toContain('@insta_handle')
      expect(result.originalContent).toBe('Call 9876543210 or email me@gmail.com or @insta_handle')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = filterChatMessage('')
      expect(result.filtered).toBe('')
      expect(result.isFlagged).toBe(false)
    })

    it('should preserve surrounding text', () => {
      const result = filterChatMessage('Before 9876543210 after')
      expect(result.filtered).toBe('Before [contact info hidden] after')
      expect(result.isFlagged).toBe(true)
    })
  })
})
