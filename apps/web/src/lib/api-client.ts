import axios from 'axios'
import type { ApiError } from '@shared/types/api-response.types'
import { useLoadingStore } from '@/store/loading.store'
import { useAuthStore } from '@/store/auth.store'
import { getAppRouter } from '@/lib/app-router'
import { feLogger } from '@/lib/logger'
import { API_TIMEOUT_MS } from '@/lib/constants'
import { useConnectionStore } from '@/store/connection.store'

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// ── Request Interceptor ──────────────────────────────
apiClient.interceptors.request.use((config) => {
  // Correlation ID — links FE logs with BE request-scoped logs
  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
  config.headers['X-Request-Id'] = requestId

  // Attach JWT from Zustand-persisted auth store
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  feLogger.debug('API Request', { method: config.method, url: config.url, requestId })
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
        useAuthStore.setState({ accessToken: token })
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
  (response) => {
    if (useConnectionStore.getState().isServerDown) useConnectionStore.getState().markUp()
    feLogger.debug('API Response', { status: response.status, url: response.config.url })
    return response
  },
  async (error) => {
    const originalRequest = error.config

    // Token refresh on 401 — use mutex to avoid concurrent refreshes
    // Skip refresh for auth endpoints (401 = real credential error, not expired token)
    const isAuthEndpoint = /\/auth\/(login|signup|otp\/|google-auth|logout)/.test(originalRequest?.url || '')
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true

      if (!refreshPromise) {
        refreshPromise = doRefresh()
      }
      const newToken = await refreshPromise

      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      }

      useLoadingStore.getState().show('Session expired...')
      useAuthStore.getState().clearAuth()
      const appRouter = getAppRouter()
      if (appRouter) {
        const returnTo = window.location.pathname + window.location.search
        appRouter.replace(`/login/email?returnTo=${encodeURIComponent(returnTo)}`)
      }
    }

    // Log API errors at warn level (not error — those are for unhandled exceptions)
    feLogger.warn('API Error', {
      status: error.response?.status,
      url: error.config?.url,
      code: error.response?.data?.error?.code,
    })

    // Detect server-down: no response means the server is unreachable
    const isNetworkError = !error.response && (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || error.message === 'Network Error')
    if (isNetworkError) {
      useConnectionStore.getState().markDown()
    }

    // Extract user-friendly message from API response
    const apiError: ApiError = error.response?.data || {
      success: false,
      error: {
        code: isNetworkError ? 'SERVER_DOWN' : 'NETWORK_ERROR',
        message: isNetworkError
          ? 'Server is unreachable. Please try again in a moment.'
          : (error.message || 'Network error. Please check your connection.'),
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
