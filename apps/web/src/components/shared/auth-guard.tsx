'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { Spinner } from '@/components/shared/spinner'
import { VERIFY_PHONE_ROUTE } from '@/lib/constants'
import type { UserRole } from '@shared/constants'

interface AuthGuardProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const userRole = useAuthStore((s) => s.user?.role)
  const phoneVerified = useAuthStore((s) => s.user?.phoneVerified)
  // `!== true` (not `=== false`) is deliberate: zustand's persist middleware
  // merges the persisted `user` into the store *before* `_hasHydrated` ever
  // flips true (see auth.store.ts `onRehydrateStorage`), so there is no
  // legitimate transient window where `hasHydrated` is true but `phoneVerified`
  // hasn't "arrived yet." An `undefined` value at that point can only mean the
  // session's persisted AuthUser predates this field being added — i.e. an
  // already-logged-in user who must still be gated (no grandfathering). `!==
  // true` treats that the same as an explicit `false`.
  const needsPhone = isAuthenticated && phoneVerified !== true

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace('/login/email')
    }
    if (hasHydrated && needsPhone) {
      router.replace(VERIFY_PHONE_ROUTE)
    }
    if (hasHydrated && isAuthenticated && allowedRoles && userRole && !allowedRoles.includes(userRole)) {
      router.replace('/')
    }
  }, [hasHydrated, isAuthenticated, needsPhone, allowedRoles, userRole, router])

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

  if (needsPhone) {
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
