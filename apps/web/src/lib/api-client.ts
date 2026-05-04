import axios from 'axios'
import type { ApiError } from '@shared/types/api-response.types'

export interface AppApiError extends Error {
  code?: string
  status?: number
  details?: { field: string; message: string }[]
}

export function isAppApiError(err: unknown): err is AppApiError {
  return err instanceof Error && 'status' in err && typeof (err as AppApiError).status === 'number'
}

/** Extract a user-friendly error message from an API error or fallback to a default. */
export function getErrorMessage(err: Error | null, fallback = 'Something went wrong'): string | undefined {
  if (!err) return undefined
  return isAppApiError(err) ? err.message : fallback
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// ── Request Interceptor ──────────────────────────────
apiClient.interceptors.request.use((config) => {
  // Read from Zustand-persisted auth store
  const stored = typeof window !== 'undefined' ? localStorage.getItem('travel-auth') : null
  const token = stored ? JSON.parse(stored)?.state?.accessToken : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Refresh Mutex ────────────────────────────────────
let refreshPromise: Promise<string | null> | null = null

function doRefresh(): Promise<string | null> {
  return axios
    .post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
    .then(({ data }) => {
      const rawToken = data.data?.accessToken
      const token = typeof rawToken === 'string' ? rawToken : undefined
      if (token) {
        const raw = localStorage.getItem('travel-auth')
        if (raw) {
          const parsed = JSON.parse(raw)
          parsed.state.accessToken = token
          localStorage.setItem('travel-auth', JSON.stringify(parsed))
        }
        return token
      }
      return null
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null
    })
}

// ── Response Interceptor ─────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Token refresh on 401 — use mutex to avoid concurrent refreshes
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      if (!refreshPromise) {
        refreshPromise = doRefresh()
      }
      const newToken = await refreshPromise

      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      }

      localStorage.removeItem('travel-auth')
      if (typeof window !== 'undefined') {
        const returnTo = window.location.pathname + window.location.search
        window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`
      }
    }

    // Extract user-friendly message from API response
    const apiError: ApiError = error.response?.data || {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Network error. Please check your connection.',
      },
    }

    const friendlyError = new Error(
      apiError.error?.message || 'Something went wrong. Please try again.',
    )
    // Attach original details for components that need them
    const extended = friendlyError as AppApiError
    extended.code = apiError.error?.code
    extended.status = error.response?.status
    extended.details = apiError.error?.details as AppApiError['details']

    return Promise.reject(friendlyError)
  },
)
