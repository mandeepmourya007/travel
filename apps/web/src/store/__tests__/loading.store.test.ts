import { describe, it, expect, beforeEach } from 'vitest'
import { useLoadingStore } from '../loading.store'

describe('useLoadingStore', () => {
  beforeEach(() => {
    useLoadingStore.setState({ isLoading: false, message: undefined, _pinned: false, epoch: 0 })
  })

  it('show() without a message is not pinned and can be hidden normally', () => {
    useLoadingStore.getState().show()
    expect(useLoadingStore.getState().isLoading).toBe(true)

    useLoadingStore.getState().hide()
    expect(useLoadingStore.getState().isLoading).toBe(false)
  })

  it('a pinned overlay (show with message) ignores non-forced hide', () => {
    useLoadingStore.getState().show('Session expired...')
    useLoadingStore.getState().hide()
    expect(useLoadingStore.getState().isLoading).toBe(true)

    useLoadingStore.getState().hide(true)
    expect(useLoadingStore.getState().isLoading).toBe(false)
  })

  it('increments epoch on every effective show()', () => {
    useLoadingStore.getState().show('First overlay')
    const first = useLoadingStore.getState().epoch

    useLoadingStore.getState().show('Second overlay')
    expect(useLoadingStore.getState().epoch).toBe(first + 1)
  })

  it('a stale epoch identifies an outdated force-hide (session-expiry safety timer)', () => {
    // Session-expiry overlay shown; its timer captures the epoch
    useLoadingStore.getState().show('Session expired...')
    const capturedEpoch = useLoadingStore.getState().epoch

    // User re-logs in quickly — a NEW pinned overlay appears
    useLoadingStore.getState().hide(true)
    useLoadingStore.getState().show('Signing in...')

    // The old timer must see the epoch moved on and leave the new overlay alone
    const store = useLoadingStore.getState()
    expect(store.epoch).not.toBe(capturedEpoch)
    if (store.epoch === capturedEpoch) store.hide(true) // (what api-client does)
    expect(useLoadingStore.getState().isLoading).toBe(true)
  })

  it('show() without message while pinned is a no-op and does not bump epoch', () => {
    useLoadingStore.getState().show('Pinned overlay')
    const epoch = useLoadingStore.getState().epoch

    useLoadingStore.getState().show()

    expect(useLoadingStore.getState().message).toBe('Pinned overlay')
    expect(useLoadingStore.getState().epoch).toBe(epoch)
  })
})
