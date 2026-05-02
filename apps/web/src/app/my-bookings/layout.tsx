import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

export default function MyBookingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  )
}
