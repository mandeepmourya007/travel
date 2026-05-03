'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, Suspense } from 'react'
import { CompareQueueProvider } from '@/hooks/use-compare-queue'
import { GlobalCompareBar } from '@/components/trips/global-compare-bar'
import { ToastProvider } from '@/components/shared/toast'
import { RouteProgress } from '@/components/shared/route-progress'
import { GoogleOAuthProvider } from '@react-oauth/google'

export function Providers({ children }: { children: React.ReactNode }) {
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
