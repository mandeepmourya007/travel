import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ChunkErrorReload } from '../chunk-error-reload'

function dispatchRejection(message: string, stack?: string) {
  const event = new Event('unhandledrejection') as PromiseRejectionEvent & { reason?: unknown }
  const error = new Error(message)
  if (stack !== undefined) error.stack = stack
  Object.defineProperty(event, 'reason', { value: error })
  window.dispatchEvent(event)
}

describe('ChunkErrorReload', () => {
  let reloadSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sessionStorage.clear()
    reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reloads once on a stale webpack chunk error', () => {
    render(<ChunkErrorReload />)

    dispatchRejection(
      "Cannot read properties of undefined (reading 'call')",
      "TypeError: Cannot read properties of undefined (reading 'call')\n    at __webpack_require__ (/_next/static/chunks/webpack.js:1:1)",
    )

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('does not reload for a generic "reading call" error without a webpack stack signature', () => {
    render(<ChunkErrorReload />)

    dispatchRejection(
      "Cannot read properties of undefined (reading 'call')",
      "TypeError: Cannot read properties of undefined (reading 'call')\n    at someUnrelatedHandler (/app/src/feature.ts:10:5)",
    )

    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('reloads on a classic ChunkLoadError message', () => {
    render(<ChunkErrorReload />)

    dispatchRejection('ChunkLoadError: Loading chunk 42 failed.')

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('reloads on a "Loading chunk N failed" message with no stack', () => {
    render(<ChunkErrorReload />)

    dispatchRejection('Loading chunk 7 failed.')

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('does not reload for an unrelated rejection', () => {
    render(<ChunkErrorReload />)

    dispatchRejection('Network request failed')

    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('does not reload a second time within the guard window (no reload loop)', () => {
    render(<ChunkErrorReload />)

    const stack = "TypeError: Cannot read properties of undefined (reading 'call')\n    at __webpack_require__ (/_next/static/chunks/webpack.js:1:1)"
    dispatchRejection("Cannot read properties of undefined (reading 'call')", stack)
    dispatchRejection("Cannot read properties of undefined (reading 'call')", stack)

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })
})
