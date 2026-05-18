'use client'

import Link from 'next/link'
import { useAuthStore } from '@/store/auth.store'
import { Spinner } from '@/components/shared/spinner'
import type { UserRole } from '@shared/types/user.types'

/**
 * Guards a page or section so only users with the specified roles can access it.
 * Shows a loading spinner during hydration, and an "Access Denied" message for unauthorized users.
 */
interface RoleGuardProps {
  roles: UserRole[]
  children: React.ReactNode
}

export function RoleGuard({ roles, children }: RoleGuardProps) {
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)

  if (!hasHydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" label="Loading..." />
      </div>
    )
  }

  if (!user || !roles.includes(user.role as UserRole)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-5xl">🔒</p>
        <h2 className="text-lg font-semibold text-neutral-900">Access Denied</h2>
        <p className="text-sm text-neutral-500">You don&apos;t have permission to view this page.</p>
        <Link href="/" prefetch={false} className="btn-outline mt-2">
          Go to Home
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
