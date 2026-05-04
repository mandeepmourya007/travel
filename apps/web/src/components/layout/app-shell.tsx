import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

interface AppShellProps {
  children: React.ReactNode
  hideFooter?: boolean
}

export function AppShell({ children, hideFooter }: AppShellProps) {
  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
      {!hideFooter && <Footer />}
    </>
  )
}
