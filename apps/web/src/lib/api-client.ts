import axios from 'axios'
import type { ApiError } from '@shared/types/api-response.types'

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

// ── Response Interceptor ─────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Token refresh on 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        )
        if (data.data?.accessToken) {
          // Update Zustand-persisted store
          const raw = localStorage.getItem('travel-auth')
          if (raw) {
            const parsed = JSON.parse(raw)
            parsed.state.accessToken = data.data.accessToken
            localStorage.setItem('travel-auth', JSON.stringify(parsed))
          }
          originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`
          return apiClient(originalRequest)
        }
      } catch {
        localStorage.removeItem('travel-auth')
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
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
    const extended = friendlyError as Error & { code?: string; status?: number; details?: unknown }
    extended.code = apiError.error?.code
    extended.status = error.response?.status
    extended.details = apiError.error?.details

    return Promise.reject(friendlyError)
  },
)
