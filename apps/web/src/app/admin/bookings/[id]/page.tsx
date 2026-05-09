'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, CreditCard, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAdminBookingDetail } from '@/hooks/use-admin-bookings'
import { formatCurrency } from '@/lib/format'
import { BOOKING_STATUS_VARIANT, PAYMENT_STATUS_VARIANT } from '@/lib/admin-utils'
import { ErrorState, EmptyState } from '@/components/shared/data-states'

export default function AdminBookingDetailPage() {
  const params = useParams<{ id: string }>()
  const { data, isLoading, error, refetch } = useAdminBookingDetail(params.id)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-6 w-48" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card-static p-6 space-y-4">
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-4 w-64" />
            <div className="skeleton h-4 w-48" />
            <div className="skeleton h-4 w-56" />
          </div>
          <div className="card-static p-6 space-y-4">
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-4 w-64" />
            <div className="skeleton h-4 w-48" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState
          title="Failed to load booking"
          message={error.message || 'Something went wrong.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <EmptyState message="Booking not found." />
      </div>
    )
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/bookings" className="text-neutral-400 hover:text-neutral-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-neutral-900">
            {data.bookingRef}
          </h1>
          <p className="text-sm text-neutral-500">
            <Link href={`/trips/${data.trip.slug}`} className="text-primary-600 hover:underline">
              {data.trip.title}
            </Link>
            {' · '}
            {formatDate(data.trip.startDate)} — {formatDate(data.trip.endDate)}
          </p>
        </div>
        <Badge variant={BOOKING_STATUS_VARIANT[data.bookingStatus] ?? 'outline'} className="ml-auto">
          {data.bookingStatus.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Booking Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" /> Booking Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Total Amount</span>
              <span className="font-mono font-medium">{formatCurrency(data.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Wallet Used</span>
              <span className="font-mono">{formatCurrency(data.walletAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Travelers</span>
              <span>{data.numTravelers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Booked On</span>
              <span>{formatDate(data.createdAt)}</span>
            </div>
            {data.cancellationReason && (
              <>
                <Separator />
                <div>
                  <span className="font-medium text-error-600">Cancellation Reason:</span>
                  <p className="mt-1 text-neutral-600">{data.cancellationReason}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* User Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Booked By
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Name</span>
              <span className="font-medium">{data.user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Email</span>
              <span>{data.user.email ?? 'N/A'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traveler Details */}
      {data.travelerDetails && data.travelerDetails.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              <Calendar className="mr-2 inline h-4 w-4" />
              Traveler Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Primary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.travelerDetails.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="font-mono text-sm">{t.phone ?? '—'}</TableCell>
                      <TableCell>{t.age ?? '—'}</TableCell>
                      <TableCell>{t.gender ?? '—'}</TableCell>
                      <TableCell>{t.isPrimary ? 'Yes' : 'No'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {data.travelerDetails.map((t) => (
                <div key={t.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
                  <p className="font-medium">{t.name}{t.isPrimary ? ' (Primary)' : ''}</p>
                  <p className="text-neutral-500">{t.phone ?? '—'} · Age {t.age ?? '—'} · {t.gender ?? '—'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Transactions */}
      {data.paymentTransactions && data.paymentTransactions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              <CreditCard className="mr-2 inline h-4 w-4" />
              Payment Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Razorpay ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.paymentTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{tx.type}</TableCell>
                      <TableCell>
                        <Badge variant={PAYMENT_STATUS_VARIANT[tx.status] ?? 'outline'} className="text-xs">
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell className="text-sm text-neutral-500">
                        {formatDate(tx.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-neutral-400">
                        {tx.razorpayPaymentId ?? tx.razorpayRefundId ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile */}
            <div className="space-y-3 md:hidden">
              {data.paymentTransactions.map((tx) => (
                <div key={tx.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{tx.type}</span>
                    <Badge variant={PAYMENT_STATUS_VARIANT[tx.status] ?? 'outline'} className="text-xs">
                      {tx.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex justify-between text-neutral-500">
                    <span>{formatDate(tx.createdAt)}</span>
                    <span className="font-mono">{formatCurrency(tx.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
