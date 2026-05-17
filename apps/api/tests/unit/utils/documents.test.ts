/**
 * Pure function tests — zero mocks, zero side effects.
 */
import { describe, it, expect } from 'vitest'
import { mergeDocuments } from '../../../src/utils/documents'

describe('mergeDocuments', () => {
  it('adds new fields when existing is null', () => {
    const result = mergeDocuments(null, {
      aadhaarFront: 'https://example.com/front.jpg',
    })
    expect(result).toEqual({ aadhaarFront: 'https://example.com/front.jpg' })
  })

  it('merges incoming fields with existing ones', () => {
    const result = mergeDocuments(
      { aadhaarFront: 'https://example.com/front.jpg' },
      { panCard: 'https://example.com/pan.jpg' },
    )
    expect(result).toEqual({
      aadhaarFront: 'https://example.com/front.jpg',
      panCard: 'https://example.com/pan.jpg',
    })
  })

  it('overwrites existing field with new value', () => {
    const result = mergeDocuments(
      { aadhaarFront: 'https://old.com/front.jpg' },
      { aadhaarFront: 'https://new.com/front.jpg' },
    )
    expect(result).toEqual({ aadhaarFront: 'https://new.com/front.jpg' })
  })

  it('removes field when incoming value is empty string', () => {
    const result = mergeDocuments(
      { aadhaarFront: 'https://example.com/front.jpg', panCard: 'https://example.com/pan.jpg' },
      { aadhaarFront: '' },
    )
    expect(result).toEqual({ panCard: 'https://example.com/pan.jpg' })
    expect(result).not.toHaveProperty('aadhaarFront')
  })

  it('removes multiple fields at once', () => {
    const result = mergeDocuments(
      { aadhaarFront: 'https://f.jpg', aadhaarBack: 'https://b.jpg', panCard: 'https://p.jpg' },
      { aadhaarFront: '', panCard: '' },
    )
    expect(result).toEqual({ aadhaarBack: 'https://b.jpg' })
  })

  it('returns empty object when all fields are cleared', () => {
    const result = mergeDocuments(
      { aadhaarFront: 'https://f.jpg' },
      { aadhaarFront: '' },
    )
    expect(result).toEqual({})
  })

  it('returns empty object when existing is null and incoming is empty', () => {
    const result = mergeDocuments(null, {})
    expect(result).toEqual({})
  })

  it('does not mutate the existing object', () => {
    const existing = { aadhaarFront: 'https://f.jpg' }
    const frozen = Object.freeze({ ...existing })
    mergeDocuments(frozen, { panCard: 'https://p.jpg' })
    expect(existing).toEqual({ aadhaarFront: 'https://f.jpg' })
  })

  it('does not mutate the incoming object', () => {
    const incoming = { aadhaarFront: '' }
    const frozen = Object.freeze({ ...incoming })
    mergeDocuments({ aadhaarFront: 'https://f.jpg' }, frozen)
    expect(incoming).toEqual({ aadhaarFront: '' })
  })

  it('handles mixed add + update + remove in one call', () => {
    const result = mergeDocuments(
      { aadhaarFront: 'https://old-front.jpg', aadhaarBack: 'https://old-back.jpg' },
      { aadhaarFront: 'https://new-front.jpg', aadhaarBack: '', panCard: 'https://pan.jpg' },
    )
    expect(result).toEqual({
      aadhaarFront: 'https://new-front.jpg',
      panCard: 'https://pan.jpg',
    })
  })
})
