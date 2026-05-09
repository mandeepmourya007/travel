import { AuthGuard } from '@/components/shared/auth-guard'
import { Header } from '@/components/layout/header'
import { AdminSidebar } from '@/components/admin/admin-sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <Header />
      <div className="flex min-h-[calc(100vh-65px)]">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto bg-neutral-50 p-4 pb-20 md:p-6 md:pb-6">
          {children}
        </main>
      </div>
    </AuthGuard>
  )
}
