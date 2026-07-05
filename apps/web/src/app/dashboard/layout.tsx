import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { AuthGuard } from '@/components/shared/auth-guard'
import { RoleGuard } from '@/components/shared/role-guard'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'
import { DashboardAlerts } from '@/components/dashboard/dashboard-alerts'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <RoleGuard roles={['ORGANIZER']}>
        <div className="flex min-h-screen flex-col bg-neutral-50">
          <Header />

          {/* Body: sidebar + content */}
          <div className="flex flex-1">
            <DashboardSidebar />
            <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-8 md:pb-8">
              <DashboardAlerts />
              {children}
            </main>
          </div>
          <MobileBottomNav />
        </div>
      </RoleGuard>
    </AuthGuard>
  )
}
