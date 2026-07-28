'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/shared/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/format'
import { useAdminReleasePayout } from '@/hooks/use-admin-payouts'
import type { AdminPendingPayoutItem } from '@shared/types/admin.types'

interface SendPayoutModalProps {
  open: boolean
  onClose: () => void
  organizer: AdminPendingPayoutItem | null
}

export function SendPayoutModal({ open, onClose, organizer }: SendPayoutModalProps) {
  const [amount, setAmount] = useState('')
  const { mutate, isPending } = useAdminReleasePayout()

  // Reset the input to the organizer's full pending balance every time the modal opens
  // for a (possibly different) organizer.
  useEffect(() => {
    if (open && organizer) setAmount(String(organizer.balance))
  }, [open, organizer])

  if (!organizer) return null

  const numericAmount = Number(amount)
  const isValidNumber = amount.trim() !== '' && Number.isFinite(numericAmount) && numericAmount > 0
  const exceedsBalance = isValidNumber && numericAmount > organizer.balance
  const canSubmit = isValidNumber && !exceedsBalance && !isPending

  function handleSubmit() {
    if (!canSubmit || !organizer) return
    mutate(
      { organizerId: organizer.organizerId, amount: Math.round(numericAmount) },
      {
        // Only dismiss the modal when the payout actually went through — on
        // 'insufficient_balance' (a race: the balance changed since this modal opened)
        // or 'failed', keep it open so the admin sees the toast and can re-check/retry.
        onSuccess: (result) => {
          if (result.status === 'released') onClose()
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={`Send Payout to ${organizer.businessName}`}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          Pending balance: <span className="font-semibold text-neutral-900">{formatCurrency(organizer.balance)}</span>
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="payout-amount">Amount to send</Label>
          <Input
            id="payout-amount"
            type="number"
            min={1}
            max={organizer.balance}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {exceedsBalance && (
            <p className="text-xs font-medium text-error-600">
              Exceeds pending balance of {formatCurrency(organizer.balance)}
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAmount(String(organizer.balance))}
        >
          Pay Full ({formatCurrency(organizer.balance)})
        </Button>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
          {isPending ? 'Sending…' : 'Send Payout'}
        </Button>
      </div>
    </Modal>
  )
}
