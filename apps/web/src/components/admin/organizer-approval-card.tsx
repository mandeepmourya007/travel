'use client'

import { useState } from 'react'
import { Building2, Calendar, FileText, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ApprovalActionDialog } from '@/components/admin/approval-action-dialog'
import type { OrganizerApprovalItem } from '@shared/types/admin.types'

interface OrganizerApprovalCardProps {
  organizer: OrganizerApprovalItem
  onApprove: (id: string) => void
  onReject: (id: string, reason?: string) => void
  isPending: boolean
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  APPROVED: 'default',
  REJECTED: 'destructive',
}

export function OrganizerApprovalCard({ organizer, onApprove, onReject, isPending }: OrganizerApprovalCardProps) {
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)

  const docs = organizer.documents as Record<string, unknown> | null
  const docCount = docs ? Object.keys(docs).length : 0
  const initials = organizer.user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary-100 text-primary-700 font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold text-neutral-900">
                {organizer.user.name}
              </h3>
              <Badge variant={STATUS_VARIANT[organizer.verificationStatus] ?? 'outline'}>
                {organizer.verificationStatus}
              </Badge>
            </div>
            <div className="flex flex-col gap-1 text-sm text-neutral-500 sm:flex-row sm:gap-4">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {organizer.user.email ?? 'No email'}
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {organizer.businessName}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Applied: {new Date(organizer.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {docCount} document{docCount !== 1 ? 's' : ''} uploaded
            </span>
          </div>

          {organizer.description && (
            <p className="text-sm text-neutral-500 line-clamp-2">{organizer.description}</p>
          )}

          {organizer.verificationStatus === 'PENDING' && (
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => setShowApprove(true)}
                disabled={isPending}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowReject(true)}
                disabled={isPending}
              >
                Reject
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ApprovalActionDialog
        open={showApprove}
        onOpenChange={setShowApprove}
        action="APPROVED"
        businessName={organizer.businessName}
        onConfirm={() => {
          onApprove(organizer.id)
          setShowApprove(false)
        }}
        isPending={isPending}
      />

      <ApprovalActionDialog
        open={showReject}
        onOpenChange={setShowReject}
        action="REJECTED"
        businessName={organizer.businessName}
        onConfirm={(reason?: string) => {
          onReject(organizer.id, reason)
          setShowReject(false)
        }}
        isPending={isPending}
      />
    </>
  )
}
