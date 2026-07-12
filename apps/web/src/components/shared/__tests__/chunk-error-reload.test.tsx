import { useEffect } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ChunkErrorReload } from '../chunk-error-reload'

function dispatchRejection(message: string, stack?: string) {
  const event = new Event('unhandledrejection') as PromiseRejectionEvent & { reason?: unknown }
  const error = new Error(message)
  if (stack !== undefined) error.stack = stack
  Object.defineProperty(event, 'reason', { value: error })
  window.dispatchEvent(event)
}

/** Renders ChunkErrorReload inside a real QueryClientProvider so useQueryClient() resolves. */
function renderWithQueryClient(queryClient = new QueryClient()) {
  render(
    <QueryClientProvider client={queryClient}>
      <ChunkErrorReload />
    </QueryClientProvider>,
  )
  return queryClient
}

/** Starts a mutation that never resolves, so queryClient.isMutating() stays > 0. */
function startPendingMutation(queryClient: QueryClient) {
  function PendingMutation() {
    const { mutate } = useMutation({ mutationFn: () => new Promise(() => {}) })
    useEffect(() => { mutate() }, [mutate])
    return null
  }
  render(
    <QueryClientProvider client={queryClient}>
      <PendingMutation />
    </QueryClientProvider>,
  )
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
    renderWithQueryClient()

    dispatchRejection(
      "Cannot read properties of undefined (reading 'call')",
      "TypeError: Cannot read properties of undefined (reading 'call')\n    at __webpack_require__ (/_next/static/chunks/webpack.js:1:1)",
    )

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('does not reload for a generic "reading call" error without a webpack stack signature', () => {
    renderWithQueryClient()

    dispatchRejection(
      "Cannot read properties of undefined (reading 'call')",
      "TypeError: Cannot read properties of undefined (reading 'call')\n    at someUnrelatedHandler (/app/src/feature.ts:10:5)",
    )

    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('reloads on a classic ChunkLoadError message', () => {
    renderWithQueryClient()

    dispatchRejection('ChunkLoadError: Loading chunk 42 failed.')

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('reloads on a "Loading chunk N failed" message with no stack', () => {
    renderWithQueryClient()

    dispatchRejection('Loading chunk 7 failed.')

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('does not reload for an unrelated rejection', () => {
    renderWithQueryClient()

    dispatchRejection('Network request failed')

    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('does not reload a second time within the guard window (no reload loop)', () => {
    renderWithQueryClient()

    const stack = "TypeError: Cannot read properties of undefined (reading 'call')\n    at __webpack_require__ (/_next/static/chunks/webpack.js:1:1)"
    dispatchRejection("Cannot read properties of undefined (reading 'call')", stack)
    dispatchRejection("Cannot read properties of undefined (reading 'call')", stack)

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('does not reload while a mutation is in flight (never cancel a user-initiated request)', () => {
    const queryClient = renderWithQueryClient()
    startPendingMutation(queryClient)

    dispatchRejection(
      "Cannot read properties of undefined (reading 'call')",
      "TypeError: Cannot read properties of undefined (reading 'call')\n    at __webpack_require__ (/_next/static/chunks/webpack.js:1:1)",
    )

    expect(reloadSpy).not.toHaveBeenCalled()
  })
})
