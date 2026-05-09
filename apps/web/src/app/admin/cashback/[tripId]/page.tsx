'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Gift, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableContainer,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { Spinner } from '@/components/shared/spinner'
import { useCashbackTripDetail, useIssueCashback } from '@/hooks/use-admin-cashback'
import { toast } from 'sonner'

interface CashbackInput {
  bookingId: string
  userId: string
  amount: string
}

export default function CashbackIssuePage() {
  const { tripId } = useParams<{ tripId: string }>()
  const { data: travelers, isLoading, error, refetch } = useCashbackTripDetail(tripId)
  const mutation = useIssueCashback()

  const [inputs, setInputs] = useState<Map<string, string>>(new Map())
  const [flatAmount, setFlatAmount] = useState('')

  const updateAmount = useCallback((bookingId: string, value: string) => {
    setInputs((prev) => {
      const next = new Map(prev)
      next.set(bookingId, value)
      return next
    })
  }, [])

  const applyFlat = useCallback(() => {
    if (!travelers || !flatAmount) return
    const next = new Map<string, string>()
    for (const t of travelers) {
      if (t.cashbackIssued === null) {
        const amt = Math.min(Number(flatAmount), t.totalAmount)
        next.set(t.bookingId, String(amt))
      }
    }
    setInputs(next)
  }, [travelers, flatAmount])

  const handleSubmit = useCallback(() => {
    if (!travelers) return

    const items: CashbackInput[] = []
    for (const t of travelers) {
      const rawAmt = inputs.get(t.bookingId)
      if (!rawAmt || t.cashbackIssued !== null) continue
      const amount = Number(rawAmt)
      if (amount <= 0 || amount > t.totalAmount) continue
      items.push({ bookingId: t.bookingId, userId: t.userId, amount: rawAmt })
    }

    if (items.length === 0) {
      toast.error('Enter valid amounts for at least one traveler')
      return
    }

    mutation.mutate(
      {
        tripId,
        items: items.map((i) => ({
          bookingId: i.bookingId,
          userId: i.userId,
          amount: Number(i.amount),
        })),
      },
      {
        onSuccess: (result) => {
          toast.success(`Cashback issued to ${result.issued} traveler(s) — ₹${result.totalAmount.toLocaleString('en-IN')}`)
          setInputs(new Map())
          setFlatAmount('')
        },
        onError: (err) => {
          toast.error(err.message || 'Failed to issue cashback')
        },
      },
    )
  }, [travelers, inputs, tripId, mutation])

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState title="Failed to load trip" message={error.message} onRetry={() => refetch()} />
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
        <h1 className="font-display text-xl font-bold text-neutral-900">Issue Cashback</h1>
      </div>

      {/* Flat amount input */}
      <div className="card-static flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Flat amount per traveler
          </label>
          <Input
            type="number"
            min={1}
            placeholder="e.g. 200"
            value={flatAmount}
            onChange={(e) => setFlatAmount(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={applyFlat} disabled={!flatAmount || !travelers?.length}>
          Apply to all
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      ) : !travelers?.length ? (
        <EmptyState message="No confirmed bookings for this trip." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Traveler</TableHead>
                  <TableHead className="text-right">Booking Amount</TableHead>
                  <TableHead className="text-center">Travelers</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-40">Cashback ₹</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {travelers.map((t) => {
                  const alreadyIssued = t.cashbackIssued !== null
                  return (
                    <TableRow key={t.bookingId} className={alreadyIssued ? 'opacity-60' : ''}>
                      <TableCell>
                        <p className="font-medium text-neutral-900">{t.userName}</p>
                        {t.email && <p className="text-xs text-neutral-500">{t.email}</p>}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ₹{t.totalAmount.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="text-center">{t.numTravelers}</TableCell>
                      <TableCell className="text-center">
                        {alreadyIssued ? (
                          <Badge className="bg-success-50 text-success-500">
                            <Check className="mr-1 h-3 w-3" />
                            ₹{t.cashbackIssued?.toLocaleString('en-IN')}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {alreadyIssued ? (
                          <span className="text-sm text-neutral-400">Issued</span>
                        ) : (
                          <Input
                            type="number"
                            min={1}
                            max={t.totalAmount}
                            placeholder="Amount"
                            value={inputs.get(t.bookingId) ?? ''}
                            onChange={(e) => updateAmount(t.bookingId, e.target.value)}
                            className="h-9"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </TableContainer>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {travelers.map((t) => {
              const alreadyIssued = t.cashbackIssued !== null
              return (
                <div
                  key={t.bookingId}
                  className={`card-static p-4 ${alreadyIssued ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">{t.userName}</p>
                      {t.email && <p className="text-xs text-neutral-500">{t.email}</p>}
                    </div>
                    {alreadyIssued ? (
                      <Badge className="bg-success-50 text-success-500">
                        <Check className="mr-1 h-3 w-3" />₹{t.cashbackIssued?.toLocaleString('en-IN')}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-neutral-600">
                    <span>Booking: ₹{t.totalAmount.toLocaleString('en-IN')}</span>
                    <span>{t.numTravelers} pax</span>
                  </div>
                  {!alreadyIssued && (
                    <div className="mt-3">
                      <Input
                        type="number"
                        min={1}
                        max={t.totalAmount}
                        placeholder="Cashback amount"
                        value={inputs.get(t.bookingId) ?? ''}
                        onChange={(e) => updateAmount(t.bookingId, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending || inputs.size === 0}
              className="gap-2"
            >
              {mutation.isPending ? (
                <>
                  <Spinner className="h-4 w-4" /> Issuing...
                </>
              ) : (
                <>
                  <Gift className="h-4 w-4" /> Issue Cashback
                </>
              )}
            </Button>
            {inputs.size > 0 && (
              <p className="text-sm text-neutral-500">
                {inputs.size} traveler(s) selected
              </p>
            )}
          </div>

          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-lg bg-error-50 p-3 text-sm text-error-500">
              <AlertCircle className="h-4 w-4" />
              {mutation.error.message}
            </div>
          )}
        </>
      )}
    </div>
  )
}
