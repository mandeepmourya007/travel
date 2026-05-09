'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import type { ApproveRejectAction } from '@shared/constants/verification-status'

interface ApprovalActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: ApproveRejectAction
  businessName: string
  onConfirm: (reason?: string) => void
  isPending: boolean
}

export function ApprovalActionDialog({
  open,
  onOpenChange,
  action,
  businessName,
  onConfirm,
  isPending,
}: ApprovalActionDialogProps) {
  const [reason, setReason] = useState('')
  const isApprove = action === 'APPROVED'

  const handleConfirm = () => {
    onConfirm(isApprove ? undefined : reason || undefined)
    setReason('')
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isApprove ? 'Approve Organizer' : 'Reject Organizer'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isApprove
              ? `Are you sure you want to approve "${businessName}"? They will be able to create and publish trips immediately.`
              : `Rejecting "${businessName}". You can provide an optional reason below.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!isApprove && (
          <div className="py-2">
            <Textarea
              placeholder="Reason for rejection (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className={!isApprove ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {isPending ? 'Processing...' : isApprove ? 'Confirm Approve' : 'Confirm Reject'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
