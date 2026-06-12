'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Users, CheckCircle } from 'lucide-react'
import { SeatSelectionCard } from '@/components/booking/seat-selection-card'
import { HoldCountdownBanner } from '@/components/booking/hold-countdown-banner'
import { AuthGuard } from '@/components/shared/auth-guard'
import { ErrorState } from '@/components/shared/data-states'
import { useToast } from '@/components/shared/toast'
import { useTripDetail } from '@/hooks/use-trip-detail'
import { useCreateBooking } from '@/hooks/use-create-booking'
import { getErrorMessage } from '@/lib/api-client'
import { getBookingConflictKind } from '@/lib/booking-errors'
import { vehicleKeys } from '@/lib/query-keys'
import { useVerifyPayment } from '@/hooks/use-verify-payment'
import { useAuthStore } from '@/store/auth.store'
import { loadRazorpayScript } from '@/lib/razorpay'
import { TravelerForm, type TravelerFormValues } from '@/components/booking/traveler-form'
import { PriceSummary } from '@/components/booking/price-summary'
import { BookingSuccess } from '@/components/booking/booking-success'
import { BookingPageSkeleton } from './loading'
import { formatCurrency } from '@/lib/format'
import { APP_NAME } from '@/lib/constants'
import type { TripRequestTraveler } from '@shared/types/trip-request.types'

type BookingRenderState = 'loading' | 'error' | 'fullyBooked' | 'deadlinePassed' | 'notAccepting' | 'success' | 'alreadyBooked' | 'form'


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
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const { data: trip, isLoading, error, refetch } = useTripDetail(slug)
  const createBooking = useCreateBooking()
  const verifyPayment = useVerifyPayment()

  // Pre-fill from approved request if coming from Payment Pending tab
  const requestId = searchParams.get('requestId')
  const prefillCount = Number(searchParams.get('numTravelers')) || 1
  const lockedTravelers = !!requestId
  const [numTravelers, setNumTravelers] = useState(prefillCount)

  // Load traveler details from sessionStorage (stashed by handlePayNow)
  const savedTravelers = useMemo<TripRequestTraveler[] | null>(() => {
    if (!requestId || typeof window === 'undefined') return null
    try {
      const raw = sessionStorage.getItem(`request-travelers-${requestId}`)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }, [requestId])

  // True when we have both requestId AND saved travelers → show pay-only mode
  const isPayOnlyMode = lockedTravelers && !!savedTravelers?.length
  const [phase, setPhase] = useState<'form' | 'success' | 'alreadyBooked'>('form')
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Seat selection state
  const showSeatStep = !!trip?.seatSelectionEnabled
  const [bookingStep, setBookingStep] = useState<'travelers' | 'seats'>('travelers')
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
  // Set once a booking is created — backend holds seats until this timestamp
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null)
  // Bumped on seat conflicts to remount the seat picker (clears its internal selection)
  const [seatMapResetKey, setSeatMapResetKey] = useState(0)
  const [pendingTravelerData, setPendingTravelerData] = useState<{
    travelers: TravelerFormValues['travelers']
    pickupPointId?: string
    dropPointId?: string
  } | null>(null)

  const handleSeatSelectionChange = useCallback((ids: string[]) => {
    setSelectedSeatIds(ids)
  }, [])

  // H3: Reset seat selection when traveler count changes
  useEffect(() => {
    setSelectedSeatIds([])
  }, [numTravelers])

  // H4: Derive render state to avoid complex inline conditions
  const seatsLeft = trip ? Math.max(0, trip.maxGroupSize - trip.currentBookings) : 0
  const deadlinePassed = trip?.bookingDeadline ? new Date(trip.bookingDeadline) < new Date() : false
  const renderState: BookingRenderState =
    isLoading ? 'loading'
    : (error || !trip) ? 'error'
    : phase === 'success' ? 'success'
    : phase === 'alreadyBooked' ? 'alreadyBooked'
    : seatsLeft === 0 ? 'fullyBooked'
    : deadlinePassed ? 'deadlinePassed'
    : !trip.acceptingBookings ? 'notAccepting'
    : 'form'

  function handleTravelerFormSubmit(data: { travelers: TravelerFormValues['travelers']; pickupPointId?: string; dropPointId?: string }) {
    if (showSeatStep) {
      setPendingTravelerData({ travelers: data.travelers, pickupPointId: data.pickupPointId, dropPointId: data.dropPointId })
      setBookingStep('seats')
    } else {
      startPayment(data.travelers, data.pickupPointId, data.dropPointId)
    }
  }

  async function startPayment(travelers: TravelerFormValues['travelers'], pickupPointId?: string, dropPointId?: string) {
    if (!trip || !user) return
    setIsProcessing(true)

    try {
      const result = await createBooking.mutateAsync({
        tripId: trip.id,
        numTravelers,
        travelers,
        pickupPointId: pickupPointId || undefined,
        dropPointId: dropPointId || undefined,
        seatIds: selectedSeatIds.length > 0 ? selectedSeatIds : undefined,
      })

      if (!result.razorpayKeyId) {
        toast({ variant: 'error', title: 'Payment not configured. Please contact support.' })
        setIsProcessing(false)
        return
      }

      // Seats are now held — surface the payment deadline to the user (P1-1)
      setHoldExpiresAt(result.expiresAt)

      // Inner try: booking already created at this point. Any failure here
      // (CDN blocked, Razorpay init error) must surface the booking ref so
      // the user isn't left wondering whether money was taken.
      try {
        const RazorpayClass = await loadRazorpayScript()

        new RazorpayClass({
          key: result.razorpayKeyId,
          amount: result.amountInRupees * 100,
          currency: 'INR',
          order_id: result.razorpayOrderId,
          name: APP_NAME,
          description: `Booking for ${trip.title}`,
          prefill: { name: user.name, email: user.email },

          handler: async (response) => {
            try {
              await verifyPayment.mutateAsync({
                bookingId: result.bookingId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                tripSlug: trip.slug,
                tripId: trip.id,
              })
              setBookingResult({
                bookingRef: result.bookingRef,
                tripTitle: trip.title,
                tripDates: { start: trip.startDate, end: trip.endDate },
                numTravelers,
                amountPaid: result.amountInRupees,
              })
              // Clear stashed traveler details after successful payment
              if (requestId) sessionStorage.removeItem(`request-travelers-${requestId}`)
              setHoldExpiresAt(null)
              setPhase('success')
            } catch {
              // Money may already be debited — give the user their booking ref
              // and refund reassurance instead of a bare "contact support"
              toast({
                variant: 'error',
                title: 'Payment verification failed',
                description: `Keep your booking reference ${result.bookingRef}. If money was deducted, it will be refunded automatically. Contact support if it doesn't reflect within a few days.`,
                duration: 15000,
              })
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
        // Script load failure or Razorpay init error — booking is already created,
        // so surface the ref so the user can contact support if needed.
        toast({
          variant: 'error',
          title: 'Could not open payment',
          description: `Your booking (ref: ${result.bookingRef}) is reserved. Please try again or contact support.`,
          duration: 15000,
        })
        setIsProcessing(false)
      }
    } catch (err) {
      const conflictKind = getBookingConflictKind(err)
      if (conflictKind === 'seat-conflict') {
        // Someone else grabbed the seats mid-flow — NOT a duplicate booking.
        // Refresh the seat map, clear the stale selection, and send the user
        // back to the seat step to re-pick.
        toast({
          variant: 'warning',
          title: 'Those seats were just taken',
          description: 'Someone booked one of your selected seats. Please pick different seats.',
        })
        setSelectedSeatIds([])
        setSeatMapResetKey((k) => k + 1)
        if (showSeatStep) setBookingStep('seats')
        queryClient.invalidateQueries({ queryKey: vehicleKeys.seatMap(trip.id) })
      } else if (conflictKind === 'already-booked') {
        setPhase('alreadyBooked')
      } else {
        toast({ variant: 'error', title: getErrorMessage(err as Error, 'Failed to create booking. Please try again.')! })
      }
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

        {renderState === 'alreadyBooked' && (
          <div className="text-center py-16">
            <CheckCircle className="mx-auto h-12 w-12 text-primary-500 mb-4" />
            <h2 className="text-xl font-display font-bold text-neutral-800">
              You&apos;ve Already Booked This Trip
            </h2>
            <p className="text-neutral-500 mt-2 max-w-md mx-auto">
              You already have a confirmed booking for this trip. Check your bookings to view details.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Link
                href={`/trips/${slug}`}
                className="btn-secondary inline-flex items-center gap-2 text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Trip
              </Link>
              <Link
                href="/my-bookings"
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                View My Bookings
              </Link>
            </div>
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
              <h1 className="text-2xl font-display font-bold text-neutral-900 mt-2">
                {isPayOnlyMode ? 'Confirm & Pay' : 'Complete Your Booking'}
              </h1>
            </div>

            {/* Seat-hold countdown — appears once a booking is created */}
            {holdExpiresAt && (
              <div className="mb-6">
                <HoldCountdownBanner expiresAt={holdExpiresAt} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                {isPayOnlyMode && savedTravelers ? (
                  /* ── Pay-only mode: show read-only traveler summary ── */
                  <div className="space-y-4">
                    <div className="card-static p-4">
                      <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5 mb-3">
                        <Users className="h-4 w-4 text-primary-500" />
                        {savedTravelers.length} Traveler{savedTravelers.length > 1 ? 's' : ''}
                      </h3>
                      <div className="space-y-2">
                        {savedTravelers.map((t, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-neutral-800">
                                {t.name} {t.isPrimary && <span className="text-xs text-primary-500">(You)</span>}
                              </p>
                              <p className="text-xs text-neutral-500">
                                {t.age} yrs &middot; {t.gender.charAt(0) + t.gender.slice(1).toLowerCase()} &middot; {t.phone}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card-static p-4">
                      <PriceSummary trip={trip} numTravelers={numTravelers} />
                    </div>

                    {showSeatStep && (
                      <SeatSelectionCard
                        key={seatMapResetKey}
                        tripId={trip.id}
                        numTravelers={numTravelers}
                        onSelectionChange={handleSeatSelectionChange}
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => startPayment(
                        savedTravelers.map((t, i) => ({
                          name: t.name,
                          phone: t.phone,
                          age: t.age,
                          gender: t.gender,
                          isPrimary: i === 0,
                          emergencyContactName: t.emergencyContactName ?? '',
                          emergencyContactPhone: t.emergencyContactPhone ?? '',
                        })),
                      )}
                      disabled={isProcessing || (showSeatStep && selectedSeatIds.length !== numTravelers)}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Processing...
                        </>
                      ) : (
                        `Pay ${formatCurrency(trip.pricePerPerson * numTravelers)}`
                      )}
                    </button>
                  </div>
                ) : bookingStep === 'seats' && pendingTravelerData ? (
                  /* ── Seat selection step ── */
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                      <button
                        type="button"
                        onClick={() => setBookingStep('travelers')}
                        className="inline-flex items-center gap-1 hover:text-neutral-700"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back to traveler details
                      </button>
                    </div>

                    <SeatSelectionCard
                      key={seatMapResetKey}
                      tripId={trip.id}
                      numTravelers={numTravelers}
                      onSelectionChange={handleSeatSelectionChange}
                    />

                    <button
                      type="button"
                      onClick={() => startPayment(
                        pendingTravelerData.travelers,
                        pendingTravelerData.pickupPointId,
                        pendingTravelerData.dropPointId,
                      )}
                      disabled={isProcessing || selectedSeatIds.length !== numTravelers}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Processing...
                        </>
                      ) : (
                        `Continue to Payment — ${formatCurrency(trip.pricePerPerson * numTravelers)}`
                      )}
                    </button>
                  </div>
                ) : (
                  /* ── Standard form mode ── */
                  <TravelerForm
                    trip={trip}
                    numTravelers={numTravelers}
                    onNumTravelersChange={setNumTravelers}
                    onSubmit={handleTravelerFormSubmit}
                    isPending={isProcessing}
                    lockedTravelers={lockedTravelers}
                  />
                )}
              </div>
              {!isPayOnlyMode && (
                <div className="lg:col-span-1">
                  <PriceSummary trip={trip} numTravelers={numTravelers} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  )
}
