import axios from 'axios'
import type { AxiosError } from 'axios'
import { API_BASE_URL } from '@/test/test-constants'

// Lightweight axios instance for tests — no Next.js store deps.
// MSW intercepts all requests at the network level.
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Mirror the production error interceptor so CONFLICT (409) errors are parsed
// into AppApiError with code/subCode — required for getBookingConflictKind to work.
apiClient.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ success: boolean; error?: { code?: string; subCode?: string; message?: string } }>) => {
    const apiError = error.response?.data || { success: false, error: { code: 'NETWORK_ERROR', message: error.message } }
    const friendlyError = new Error(apiError.error?.message || 'Something went wrong.')
    const extended = friendlyError as AppApiError
    extended.code = apiError.error?.code
    extended.subCode = apiError.error?.subCode
    extended.status = error.response?.status
    return Promise.reject(friendlyError)
  },
)

export interface AppApiError extends Error {
  code?: string
  subCode?: string
  status?: number
  details?: { field: string; message: string }[]
}

export function isAppApiError(err: unknown): err is AppApiError {
  return err instanceof Error && 'status' in err && typeof (err as AppApiError).status === 'number'
}

export function getErrorMessage(
  err: Error | null,
  fallback = 'Something went wrong',
): string | undefined {
  if (!err) return undefined
  return err.message || fallback
}
