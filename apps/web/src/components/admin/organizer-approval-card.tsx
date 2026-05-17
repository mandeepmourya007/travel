'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building2, Calendar, FileText, Mail, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ApprovalActionDialog } from '@/components/admin/approval-action-dialog'
import type { OrganizerApprovalItem } from '@shared/types/admin.types'
import type { OrganizerDocuments } from '@shared/types/user.types'
import { getDocCount } from '@/lib/organizer-utils'

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
  REVISION_REQUIRED: 'secondary',
}

export function OrganizerApprovalCard({ organizer, onApprove, onReject, isPending }: OrganizerApprovalCardProps) {
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)

  const docs = organizer.documents as OrganizerDocuments | null
  const docCount = getDocCount(docs)
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

          {docCount > 0 && docs && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-neutral-500">Verification Documents</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(docs).map(([key, url]) =>
                  url ? (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative overflow-hidden rounded-lg border border-neutral-200"
                    >
                      <img
                        src={url}
                        alt={key}
                        className="h-20 w-28 object-cover transition-transform group-hover:scale-105"
                      />
                      <span className="absolute bottom-0 left-0 right-0 bg-neutral-900/60 px-1.5 py-0.5 text-[10px] text-white">
                        {key === 'aadhaarFront' ? 'Aadhaar Front' : key === 'aadhaarBack' ? 'Aadhaar Back' : 'PAN Card'}
                      </span>
                    </a>
                  ) : null,
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Link href={`/admin/organizers/${organizer.id}`}>
              <Button size="sm" variant="outline">
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Review Documents
              </Button>
            </Link>
            {(organizer.verificationStatus === 'PENDING' || organizer.verificationStatus === 'REVISION_REQUIRED') && (
              <>
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
              </>
            )}
          </div>
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
