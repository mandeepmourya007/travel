import { Header } from '@/components/layout/header'
import { AuthGuard } from '@/components/shared/auth-guard'
import { RoleGuard } from '@/components/shared/role-guard'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'

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
              {children}
            </main>
          </div>
        </div>
      </RoleGuard>
    </AuthGuard>
  )
}
