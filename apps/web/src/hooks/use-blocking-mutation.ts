import { useLoadingStore } from '@/store/loading.store'
import { useCallback } from 'react'

/**
 * Returns helpers to show/hide a full-screen blocking overlay.
 *
 * Use `withBlocking` to wrap any async operation (e.g. mutateAsync)
 * so the overlay appears while the promise is in-flight.
 *
 * Usage:
 *   const { withBlocking } = useBlockingLoader('Creating booking...')
 *   const createBooking = useCreateBooking()
 *
 *   await withBlocking(createBooking.mutateAsync(input))
 */
export function useBlockingLoader(defaultMessage?: string) {
  const { show, hide } = useLoadingStore()

  const withBlocking = useCallback(
    async <T>(promise: Promise<T>, message?: string): Promise<T> => {
      show(message ?? defaultMessage)
      try {
        return await promise
      } finally {
        hide()
      }
    },
    [show, hide, defaultMessage],
  )

  return { show, hide, withBlocking }
}
