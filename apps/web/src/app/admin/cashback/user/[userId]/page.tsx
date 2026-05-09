'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Gift } from 'lucide-react'
import {
  Table,
  TableContainer,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pagination } from '@/components/shared/pagination'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { useCashbackUserDetail } from '@/hooks/use-admin-cashback'

export default function CashbackUserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useCashbackUserDetail(userId, { page, limit: 20 })

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState title="Failed to load" message={error.message} onRetry={() => refetch()} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/cashback"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Cashback
      </Link>

      <div className="flex items-center gap-3">
        <Gift className="h-6 w-6 text-primary-600" />
        <h1 className="font-display text-xl font-bold text-neutral-900">User Cashback Detail</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-lg" />
          ))}
        </div>
      ) : !data?.data.length ? (
        <EmptyState message="No cashback found for this user." />
      ) : (
        <>
          {/* Summary */}
          <div className="card-static grid grid-cols-2 gap-4 p-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-neutral-500">Total Cashback</p>
              <p className="font-mono text-lg font-bold text-primary-700">
                ₹{data.data.reduce((s, d) => s + d.amount, 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Trips</p>
              <p className="text-lg font-bold text-neutral-900">{data.pagination.total}</p>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip</TableHead>
                  <TableHead className="text-right">Booking Amount</TableHead>
                  <TableHead className="text-right">Cashback</TableHead>
                  <TableHead className="text-right">Issued At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((row) => (
                  <TableRow key={row.bookingId}>
                    <TableCell className="font-medium text-neutral-900">{row.tripTitle}</TableCell>
                    <TableCell className="text-right font-mono">
                      ₹{row.bookingAmount.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right font-mono text-primary-700">
                      ₹{row.amount.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right text-sm text-neutral-500">
                      {new Date(row.issuedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data.data.map((row) => (
              <div key={row.bookingId} className="card-static p-4">
                <p className="font-medium text-neutral-900">{row.tripTitle}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Booking: ₹{row.bookingAmount.toLocaleString('en-IN')}</span>
                  <span className="font-mono font-semibold text-primary-700">₹{row.amount.toLocaleString('en-IN')}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-400">
                  {new Date(row.issuedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={data.pagination.page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
