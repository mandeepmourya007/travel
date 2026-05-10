import { AsyncLocalStorage } from 'async_hooks'
import type { Logger } from 'pino'

interface RequestStore {
  logger: Logger
  requestId: string
  userId?: string
  role?: string
}

export const requestContext = new AsyncLocalStorage<RequestStore>()

/** Returns the request-scoped child logger, or undefined if outside request */
export function getRequestLogger(): Logger | undefined {
  return requestContext.getStore()?.logger
}

/** Returns request context bindings (requestId, userId) for manual enrichment */
export function getRequestContext(): Partial<RequestStore> {
  const store = requestContext.getStore()
  return store
    ? { requestId: store.requestId, userId: store.userId, role: store.role }
    : {}
}
