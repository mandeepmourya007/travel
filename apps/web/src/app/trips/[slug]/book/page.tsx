'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AuthGuard } from '@/components/shared/auth-guard'
import { ErrorState } from '@/components/shared/data-states'
import { useToast } from '@/components/shared/toast'
import { useTripDetail } from '@/hooks/use-trip-detail'
import { useCreateBooking } from '@/hooks/use-create-booking'
import { useVerifyPayment } from '@/hooks/use-verify-payment'
import { useAuthStore } from '@/store/auth.store'
import { loadRazorpayScript } from '@/lib/razorpay'
import { TravelerForm, type TravelerFormValues } from '@/components/booking/traveler-form'
import { PriceSummary } from '@/components/booking/price-summary'
import { BookingSuccess } from '@/components/booking/booking-success'
import { BookingPageSkeleton } from './loading'

interface BookingResult {
  bookingRef: string
  tripTitle: string
  tripDates: { start: string; end: string }
  numTravelers: number
  amountPaid: number
}

export default function BookingPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)

  const { data: trip, isLoading, error, refetch } = useTripDetail(slug)
  const createBooking = useCreateBooking()
  const verifyPayment = useVerifyPayment()

  const [numTravelers, setNumTravelers] = useState(1)
  const [phase, setPhase] = useState<'form' | 'success'>('form')
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // H4: Derive render state to avoid complex inline conditions
  const seatsLeft = trip ? Math.max(0, trip.maxGroupSize - trip.currentBookings) : 0
  const deadlinePassed = trip?.bookingDeadline ? new Date(trip.bookingDeadline) < new Date() : false
  const renderState: 'loading' | 'error' | 'fullyBooked' | 'deadlinePassed' | 'notAccepting' | 'success' | 'form' =
    isLoading ? 'loading'
    : (error || !trip) ? 'error'
    : phase === 'success' ? 'success'
    : seatsLeft === 0 ? 'fullyBooked'
    : deadlinePassed ? 'deadlinePassed'
    : !trip.acceptingBookings ? 'notAccepting'
    : 'form'

  async function handleSubmit(data: { travelers: TravelerFormValues['travelers'] }) {
    if (!trip || !user) return
    setIsProcessing(true)

    try {
      const result = await createBooking.mutateAsync({
        tripId: trip.id,
        numTravelers,
        travelers: data.travelers,
      })

      if (!result.razorpayKeyId) {
        toast({ variant: 'error', title: 'Payment not configured. Please contact support.' })
        setIsProcessing(false)
        return
      }

      const RazorpayClass = await loadRazorpayScript()

      new RazorpayClass({
        key: result.razorpayKeyId,
        amount: result.amountInRupees * 100,
        currency: 'INR',
        order_id: result.razorpayOrderId,
        name: 'TripCompare',
        description: `Booking for ${trip.title}`,
        prefill: { name: user.name, email: user.email },

        handler: async (response) => {
          try {
            await verifyPayment.mutateAsync({
              bookingId: result.bookingId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            setBookingResult({
              bookingRef: result.bookingRef,
              tripTitle: trip.title,
              tripDates: { start: trip.startDate, end: trip.endDate },
              numTravelers,
              amountPaid: result.amountInRupees,
            })
            setPhase('success')
          } catch {
            // verifyPayment hook already shows error toast
          } finally {
            setIsProcessing(false)
          }
        },

        modal: {
          ondismiss: () => {
            toast({ variant: 'warning', title: 'Payment cancelled. You can try again.' })
            setIsProcessing(false)
          },
        },
      }).open()
    } catch {
      // createBooking hook already shows error toast
      setIsProcessing(false)
    }
  }

  return (
    <AuthGuard>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {renderState === 'loading' && <BookingPageSkeleton />}

        {renderState === 'error' && (
          <ErrorState
            title="Failed to load trip"
            message="Please try again."
            onRetry={refetch}
          />
        )}

        {renderState === 'fullyBooked' && (
          <div className="text-center py-16">
            <h2 className="text-xl font-display font-bold text-neutral-800">Fully Booked</h2>
            <p className="text-neutral-500 mt-2">This trip has no seats available.</p>
            <Link
              href={`/trips/${slug}`}
              className="btn-secondary inline-flex items-center gap-2 text-sm mt-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Trip
            </Link>
          </div>
        )}

        {renderState === 'deadlinePassed' && (
          <div className="text-center py-16">
            <h2 className="text-xl font-display font-bold text-neutral-800">Booking Deadline Passed</h2>
            <p className="text-neutral-500 mt-2">The booking deadline for this trip has passed.</p>
            <Link
              href={`/trips/${slug}`}
              className="btn-secondary inline-flex items-center gap-2 text-sm mt-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Trip
            </Link>
          </div>
        )}

        {renderState === 'notAccepting' && (
          <div className="text-center py-16">
            <h2 className="text-xl font-display font-bold text-neutral-800">Bookings Closed</h2>
            <p className="text-neutral-500 mt-2">This trip is not accepting bookings at the moment.</p>
            <Link
              href={`/trips/${slug}`}
              className="btn-secondary inline-flex items-center gap-2 text-sm mt-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Trip
            </Link>
          </div>
        )}

        {renderState === 'success' && bookingResult && (
          <BookingSuccess {...bookingResult} />
        )}

        {renderState === 'form' && trip && (
          <>
            <div className="mb-6">
              <Link
                href={`/trips/${slug}`}
                className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to {trip.title}
              </Link>
              <h1 className="text-2xl font-display font-bold text-neutral-900 mt-2">Complete Your Booking</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <TravelerForm
                  trip={trip}
                  numTravelers={numTravelers}
                  onNumTravelersChange={setNumTravelers}
                  onSubmit={handleSubmit}
                  isPending={isProcessing}
                />
              </div>
              <div className="lg:col-span-1">
                <PriceSummary trip={trip} numTravelers={numTravelers} />
              </div>
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  )
}
