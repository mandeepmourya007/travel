import { describe, it, expect, beforeEach } from 'vitest'
import { useSearchStore } from '../search.store'

describe('useSearchStore', () => {
  beforeEach(() => {
    useSearchStore.getState().reset()
  })

  it('starts with an empty query', () => {
    expect(useSearchStore.getState().query).toBe('')
  })

  it('setQuery stores the text verbatim (no trimming while typing)', () => {
    useSearchStore.getState().setQuery('goa ')
    expect(useSearchStore.getState().query).toBe('goa ')
  })

  it('reset clears the query', () => {
    useSearchStore.getState().setQuery('goa')
    useSearchStore.getState().reset()
    expect(useSearchStore.getState().query).toBe('')
  })
})
