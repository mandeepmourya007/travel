import { describe, it, expect } from 'vitest'
import { tokenizeQuery, MAX_SEARCH_TOKENS, MIN_TOKEN_LENGTH } from '../../../src/utils/search'

describe('tokenizeQuery', () => {
  describe('basic splitting', () => {
    it('should return single-word query as a single token', () => {
      expect(tokenizeQuery('amritsar')).toEqual(['amritsar'])
    })

    it('should split two-word query into two tokens', () => {
      expect(tokenizeQuery('weekend amritsar')).toEqual(['weekend', 'amritsar'])
    })

    it('should split four-word query into four tokens', () => {
      expect(tokenizeQuery('adventure rajasthan desert camping')).toEqual([
        'adventure', 'rajasthan', 'desert', 'camping',
      ])
    })
  })

  describe('normalisation', () => {
    it('should lowercase all tokens', () => {
      expect(tokenizeQuery('Weekend Amritsar')).toEqual(['weekend', 'amritsar'])
    })

    it('should trim leading and trailing whitespace', () => {
      expect(tokenizeQuery('  weekend amritsar  ')).toEqual(['weekend', 'amritsar'])
    })

    it('should collapse multiple spaces between words', () => {
      expect(tokenizeQuery('weekend   amritsar')).toEqual(['weekend', 'amritsar'])
    })

    it('should split on comma without space', () => {
      expect(tokenizeQuery('weekend,amritsar')).toEqual(['weekend', 'amritsar'])
    })

    it('should split on comma with space (natural list syntax)', () => {
      expect(tokenizeQuery('weekend, amritsar')).toEqual(['weekend', 'amritsar'])
    })

    it('should split on semicolon', () => {
      expect(tokenizeQuery('weekend;amritsar')).toEqual(['weekend', 'amritsar'])
    })

    it('should split on pipe', () => {
      expect(tokenizeQuery('weekend|amritsar')).toEqual(['weekend', 'amritsar'])
    })

    it('should handle mixed delimiters', () => {
      expect(tokenizeQuery('goa, beach | trek')).toEqual(['goa', 'beach', 'trek'])
    })
  })

  describe(`minimum token length (< ${MIN_TOKEN_LENGTH} chars dropped)`, () => {
    it('should drop single-character tokens', () => {
      expect(tokenizeQuery('a trip')).toEqual(['trip'])
    })

    it('should return [] when all tokens are too short', () => {
      expect(tokenizeQuery('a b c')).toEqual([])
    })

    it('should return [] for an empty string', () => {
      expect(tokenizeQuery('')).toEqual([])
    })

    it('should return [] for a whitespace-only string', () => {
      expect(tokenizeQuery('   ')).toEqual([])
    })

    it('should keep tokens of exactly MIN_TOKEN_LENGTH characters', () => {
      expect(tokenizeQuery('go')).toEqual(['go'])
    })
  })

  describe('deduplication', () => {
    it('should remove exact duplicate tokens', () => {
      expect(tokenizeQuery('trip trip')).toEqual(['trip'])
    })

    it('should deduplicate case-insensitively', () => {
      expect(tokenizeQuery('Trip trip TRIP')).toEqual(['trip'])
    })

    it('should keep distinct tokens that differ after lowercasing', () => {
      expect(tokenizeQuery('trek trekking')).toEqual(['trek', 'trekking'])
    })
  })

  describe(`token cap (max ${MAX_SEARCH_TOKENS})`, () => {
    it('should return at most MAX_SEARCH_TOKENS tokens', () => {
      const q = 'one two three four five six seven eight nine ten eleven twelve'
      const result = tokenizeQuery(q)
      expect(result.length).toBe(MAX_SEARCH_TOKENS)
    })

    it('should return the first MAX_SEARCH_TOKENS unique tokens in order', () => {
      const words = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh', 'ii', 'jj', 'kk']
      const result = tokenizeQuery(words.join(' '))
      expect(result).toEqual(words.slice(0, MAX_SEARCH_TOKENS))
    })
  })
})
