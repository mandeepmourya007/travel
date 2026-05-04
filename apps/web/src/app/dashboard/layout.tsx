'use client'

import { useAuthStore } from '@/store/auth.store'
import { useLogout } from '@/hooks/use-logout'
import { APP_NAME } from '@/lib/constants'
import { AuthGuard } from '@/components/shared/auth-guard'
import { RoleGuard } from '@/components/shared/role-guard'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const { logout: handleLogout, loggingOut } = useLogout('/')

  return (
    <AuthGuard>
      <RoleGuard roles={['ORGANIZER']}>
        <div className="flex min-h-screen flex-col bg-neutral-50">
          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
            <div className="flex items-center justify-between px-4 py-3 md:px-6">
              <h1 className="font-display text-lg font-bold text-primary-600">{APP_NAME}</h1>
              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-neutral-800">{user?.name}</p>
                  <p className="text-xs text-neutral-400">{user?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="btn-ghost text-sm flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {loggingOut ? <><span className="spinner spinner-sm" /> Logging out...</> : 'Logout'}
                </button>
              </div>
            </div>
          </header>

          {/* Body: sidebar + content */}
          <div className="flex flex-1">
            <DashboardSidebar />
            <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-8 md:pb-8">
              {children}
            </main>
          </div>
        </div>
      </RoleGuard>
    </AuthGuard>
  )
}
