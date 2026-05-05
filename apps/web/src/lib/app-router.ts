import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

/**
 * Holds a reference to the Next.js App Router so non-component code
 * (e.g. axios interceptors) can do client-side navigation.
 *
 * Set once by <Providers> via `setAppRouter(useRouter())`.
 */
let router: AppRouterInstance | null = null

export function setAppRouter(r: AppRouterInstance) {
  router = r
}

export function getAppRouter(): AppRouterInstance | null {
  return router
}
