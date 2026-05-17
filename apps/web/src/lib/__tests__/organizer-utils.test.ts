import { describe, it, expect } from 'vitest'
import { getDocCount, areDocsComplete } from '../organizer-utils'
import type { OrganizerDocuments } from '@shared/types/user.types'

describe('getDocCount', () => {
  it('returns 0 for null', () => {
    expect(getDocCount(null)).toBe(0)
  })

  it('returns 0 for undefined', () => {
    expect(getDocCount(undefined)).toBe(0)
  })

  it('returns 0 for empty object', () => {
    expect(getDocCount({})).toBe(0)
  })

  it('counts only truthy fields', () => {
    const docs: OrganizerDocuments = {
      aadhaarFront: 'https://example.com/front.jpg',
      aadhaarBack: undefined,
      panCard: undefined,
    }
    expect(getDocCount(docs)).toBe(1)
  })

  it('returns 2 for two uploaded docs', () => {
    const docs: OrganizerDocuments = {
      aadhaarFront: 'https://example.com/front.jpg',
      aadhaarBack: 'https://example.com/back.jpg',
    }
    expect(getDocCount(docs)).toBe(2)
  })

  it('returns 3 when all docs are uploaded', () => {
    const docs: OrganizerDocuments = {
      aadhaarFront: 'https://example.com/front.jpg',
      aadhaarBack: 'https://example.com/back.jpg',
      panCard: 'https://example.com/pan.jpg',
    }
    expect(getDocCount(docs)).toBe(3)
  })

  it('does not count empty strings as uploaded', () => {
    const docs: OrganizerDocuments = {
      aadhaarFront: '',
      aadhaarBack: 'https://example.com/back.jpg',
      panCard: '',
    }
    expect(getDocCount(docs)).toBe(1)
  })
})

describe('areDocsComplete', () => {
  it('returns false for null', () => {
    expect(areDocsComplete(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(areDocsComplete(undefined)).toBe(false)
  })

  it('returns false when only 2 of 3 docs uploaded', () => {
    expect(areDocsComplete({
      aadhaarFront: 'https://example.com/front.jpg',
      aadhaarBack: 'https://example.com/back.jpg',
    })).toBe(false)
  })

  it('returns true when all 3 docs uploaded', () => {
    expect(areDocsComplete({
      aadhaarFront: 'https://example.com/front.jpg',
      aadhaarBack: 'https://example.com/back.jpg',
      panCard: 'https://example.com/pan.jpg',
    })).toBe(true)
  })

  it('returns false when a doc is empty string', () => {
    expect(areDocsComplete({
      aadhaarFront: 'https://example.com/front.jpg',
      aadhaarBack: 'https://example.com/back.jpg',
      panCard: '',
    })).toBe(false)
  })
})
