import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'

interface AppShellProps {
  children: React.ReactNode
  hideFooter?: boolean
}

export function AppShell({ children, hideFooter }: AppShellProps) {
  return (
    <>
      <Header />
      <main className="min-h-screen pb-20 md:pb-0">{children}</main>
      {!hideFooter && <Footer />}
      <MobileBottomNav />
    </>
  )
}
