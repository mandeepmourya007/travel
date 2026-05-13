'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { Spinner } from '@/components/shared/spinner'

interface AuthGuardProps {
  children: React.ReactNode
  allowedRoles?: ('TRAVELER' | 'ORGANIZER' | 'ADMIN')[]
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const userRole = useAuthStore((s) => s.user?.role)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace('/login/email')
    }
    if (hasHydrated && isAuthenticated && allowedRoles && userRole && !allowedRoles.includes(userRole)) {
      router.replace('/')
    }
  }, [hasHydrated, isAuthenticated, allowedRoles, userRole, router])

  if (!hasHydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" label="Loading..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" label="Redirecting..." />
      </div>
    )
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" label="Redirecting..." />
      </div>
    )
  }

  return <>{children}</>
}
