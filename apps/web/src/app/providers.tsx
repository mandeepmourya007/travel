'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setAppRouter } from '@/lib/app-router'
import { CompareQueueProvider } from '@/hooks/use-compare-queue'
import { GlobalCompareBar } from '@/components/trips/global-compare-bar'
import { ToastProvider } from '@/components/shared/toast'
import { RouteProgress } from '@/components/shared/route-progress'
import { FullScreenLoader } from '@/components/shared/full-screen-loader'
import { DismissLoader } from '@/components/shared/dismiss-loader'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { SocketConnector } from '@/components/shared/socket-connector'
import { ServerDownBanner } from '@/components/shared/server-down-banner'

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  useEffect(() => { setAppRouter(router) }, [router])

  // Hide the pre-hydration inline loader once React mounts
  // Note: use display:none instead of el.remove() to avoid React removeChild crash
  useEffect(() => {
    const el = document.getElementById('__initial-loader')
    if (el) {
      el.style.display = 'none'
      el.setAttribute('aria-hidden', 'true')
    }
  }, [])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: (failureCount, error) => {
              if ((error as { status?: number }).status === 404) return false
              return failureCount < 2
            },
          },
          mutations: {
            retry: false,
          },
        },
      }),
  )

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  const content = (
    <QueryClientProvider client={queryClient}>
      <ServerDownBanner />
      <SocketConnector />
      <FullScreenLoader />
      <DismissLoader />
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>
      <CompareQueueProvider>
        <ToastProvider>
          {children}
          <GlobalCompareBar />
        </ToastProvider>
      </CompareQueueProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )

  if (googleClientId) {
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        {content}
      </GoogleOAuthProvider>
    )
  }

  return content
}
