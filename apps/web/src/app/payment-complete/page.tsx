'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, Shield } from 'lucide-react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import type { VerifyPaymentResponse } from '@shared/types/payment.types'

type PageState = 'verifying' | 'success' | 'failed' | 'missing-params'

const CASHFREE_BOOKING_KEY = 'cashfree_pending_booking_id'

/**
 * Post-payment return page for Cashfree checkout.
 *
 * Cashfree redirects here after payment with ?order_id=... in the URL.
 * The bookingId is read from sessionStorage (stashed before the redirect in book/page.tsx).
 * Then we call POST /bookings/:id/verify-payment to confirm with the backend.
 */
export default function PaymentCompletePage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id')

  const [state, setState] = useState<PageState>('verifying')
  const [bookingRef, setBookingRef] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const bookingId = sessionStorage.getItem(CASHFREE_BOOKING_KEY)

    if (!orderId || !bookingId) {
      setState('missing-params')
      return
    }

    apiClient
      .post<{ success: true; data: VerifyPaymentResponse }>(
        `/bookings/${bookingId}/verify-payment`,
        { orderId, provider: 'cashfree' },
      )
      .then((res) => {
        const status = res.data.data.bookingStatus
        if (status === 'CONFIRMED') {
          sessionStorage.removeItem(CASHFREE_BOOKING_KEY)
          setBookingRef(res.data.data.bookingRef)
          setState('success')
        } else {
          setErrorMsg(`Payment not confirmed — booking status: ${status}. If money was deducted, it will be refunded automatically.`)
          setState('failed')
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Verification failed'
        setErrorMsg(`${msg}. If money was deducted, it will be refunded automatically. Contact support if needed.`)
        setState('failed')
      })
  }, [orderId])

  if (state === 'verifying') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 text-primary-500 mx-auto animate-spin" />
          <p className="text-neutral-600 font-medium">Confirming your payment…</p>
          <p className="text-sm text-neutral-400">Please don&apos;t close this tab</p>
        </div>
      </div>
    )
  }

  if (state === 'missing-params') {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-4">
        <XCircle className="h-12 w-12 text-error-500 mx-auto mb-4" />
        <h1 className="text-xl font-display font-bold text-neutral-900 mb-2">Invalid Page Access</h1>
        <p className="text-neutral-500 text-sm mb-6">
          This page should only be accessed after completing a Cashfree payment. If you were in the middle of a payment, check your bookings.
        </p>
        <Link href="/my-bookings" className="btn-primary">View My Bookings</Link>
      </div>
    )
  }

  if (state === 'failed') {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-4">
        <div className="card p-8 space-y-4">
          <XCircle className="h-12 w-12 text-error-500 mx-auto" />
          <h1 className="text-xl font-display font-bold text-neutral-900">Payment Verification Failed</h1>
          <p className="text-sm text-neutral-500">{errorMsg}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/my-bookings" className="btn-secondary">View My Bookings</Link>
            <Link href="/trips" className="btn-primary">Browse Trips</Link>
          </div>
        </div>
      </div>
    )
  }

  // success
  return (
    <div className="max-w-lg mx-auto text-center py-12 px-4">
      <div className="card p-8 space-y-6">
        <CheckCircle className="h-16 w-16 text-success-500 mx-auto" />
        <h1 className="text-2xl font-display font-bold text-neutral-900">Booking Confirmed!</h1>

        {bookingRef && (
          <p className="font-mono text-sm text-neutral-500">Booking Ref: #{bookingRef}</p>
        )}

        <div className="inline-flex items-center gap-2 bg-success-50 text-success-700 px-4 py-2 rounded-full text-sm">
          <Shield className="h-4 w-4" />
          Payment held safely via SafePay
        </div>

        <div className="text-left bg-neutral-50 rounded-lg p-4">
          <h2 className="font-display font-semibold text-sm text-neutral-900 mb-2">What&apos;s Next</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm text-neutral-600">
            <li>You&apos;ll receive a confirmation email shortly</li>
            <li>The organizer will share trip details before departure</li>
            <li>Your payment is safely held via SafePay until trip completion</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/my-bookings" prefetch={false} className="btn-primary">
            View My Bookings
          </Link>
          <Link href="/trips" prefetch={false} className="btn-secondary">
            Browse More Trips
          </Link>
        </div>
      </div>
    </div>
  )
}
