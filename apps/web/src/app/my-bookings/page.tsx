'use client'

import { AuthGuard } from '@/components/shared/auth-guard'
import { MyBookingsList } from '@/components/bookings/my-bookings-list'

export default function MyBookingsPage() {
  return (
    <AuthGuard>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-8">
        <h1 className="mb-4 text-xl font-bold text-neutral-900 md:mb-6 md:text-2xl">My Bookings</h1>
        <MyBookingsList />
      </div>
    </AuthGuard>
  )
}
