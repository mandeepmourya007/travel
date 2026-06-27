import axios from 'axios'
import { API_BASE_URL } from '@/test/test-constants'

// Lightweight axios instance for tests — no interceptors, no Next.js store deps.
// MSW intercepts all requests at the network level, so this just needs to be a
// real axios instance pointed at the same base URL the handlers expect.
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

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
