'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, XCircle, Clock, MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/shared/data-states'
import { useDocReviewDetail, useReviewDocument, useAdminAddDocComment } from '@/hooks/use-doc-review'
import { DOC_LABELS, DOC_TYPES } from '@shared/constants/upload'
import type { DocumentReviewItem, DocumentReviewCommentItem } from '@shared/types/admin.types'

const DOC_STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  APPROVED: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success-600 bg-success-50', label: 'Approved' },
  REJECTED: { icon: <XCircle className="h-4 w-4" />, color: 'text-error-600 bg-error-50', label: 'Rejected' },
  PENDING: { icon: <Clock className="h-4 w-4" />, color: 'text-warning-600 bg-warning-50', label: 'Pending' },
}

const PROFILE_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  APPROVED: 'default',
  REJECTED: 'destructive',
  REVISION_REQUIRED: 'secondary',
}

export default function OrganizerDocReviewPage() {
  const params = useParams()
  const router = useRouter()
  const organizerId = params.id as string

  const { data, isLoading, error, refetch } = useDocReviewDetail(organizerId)
  const reviewMutation = useReviewDocument()
  const commentMutation = useAdminAddDocComment()

  const [commentText, setCommentText] = useState('')
  const [commentDocType, setCommentDocType] = useState<string | undefined>(undefined)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-64 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-48 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState title="Failed to load document review" message={error.message} onRetry={() => refetch()} />
      </div>
    )
  }

  if (!data) return null

  const handleReview = (docType: string, action: 'APPROVED' | 'REJECTED', comment?: string) => {
    reviewMutation.mutate({ organizerId, docType, action, comment })
  }

  const handleAddComment = () => {
    if (!commentText.trim()) return
    commentMutation.mutate(
      { organizerId, comment: commentText.trim(), docType: commentDocType },
      { onSuccess: () => { setCommentText(''); setCommentDocType(undefined) } },
    )
  }

  const initials = data.user?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/organizers')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Organizer Info */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary-100 text-primary-700 font-medium text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold text-neutral-900">
                {data.user?.name ?? 'Unknown'}
              </h1>
              <Badge variant={PROFILE_STATUS_VARIANT[data.verificationStatus] ?? 'outline'}>
                {data.verificationStatus === 'REVISION_REQUIRED' ? 'Revision Required' : data.verificationStatus}
              </Badge>
            </div>
            <p className="text-sm text-neutral-500">{data.businessName} &middot; {data.user?.email}</p>
          </div>
        </CardHeader>
      </Card>

      {/* Document Review Grid */}
      <h2 className="font-display text-lg font-semibold text-neutral-900">Document Review</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {(data.documentReviews ?? []).map((dr: DocumentReviewItem) => {
          const config = DOC_STATUS_CONFIG[dr.status] ?? DOC_STATUS_CONFIG.PENDING
          return (
            <Card key={dr.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{DOC_LABELS[dr.docType as keyof typeof DOC_LABELS] ?? dr.docType}</CardTitle>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
                    {config.icon}
                    {config.label}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {dr.currentUrl ? (
                  <a href={dr.currentUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={dr.currentUrl}
                      alt={DOC_LABELS[dr.docType as keyof typeof DOC_LABELS] ?? dr.docType}
                      className="h-36 w-full rounded-lg border border-neutral-200 object-cover transition-transform hover:scale-[1.02]"
                    />
                  </a>
                ) : (
                  <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-sm text-neutral-400">
                    No document uploaded
                  </div>
                )}

                {dr.status === 'PENDING' && dr.currentUrl && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleReview(dr.docType, 'APPROVED')}
                      disabled={reviewMutation.isPending}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <DocRejectButton
                      docType={dr.docType}
                      onReject={(comment) => handleReview(dr.docType, 'REJECTED', comment)}
                      isPending={reviewMutation.isPending}
                    />
                  </div>
                )}

                {dr.reviewedAt && (
                  <p className="text-xs text-neutral-400">
                    Reviewed {new Date(dr.reviewedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Comment Thread */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Review Comments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.reviewComments?.length === 0 && (
            <p className="text-sm text-neutral-400">No comments yet.</p>
          )}

          <div className="max-h-80 space-y-3 overflow-y-auto">
            {(data.reviewComments ?? []).map((c: DocumentReviewCommentItem) => (
              <div
                key={c.id}
                className={`rounded-lg p-3 text-sm ${
                  c.authorRole === 'ADMIN'
                    ? 'ml-4 bg-primary-50 border border-primary-100'
                    : 'mr-4 bg-neutral-50 border border-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="font-medium text-neutral-700">
                    {c.authorRole === 'ADMIN' ? 'Admin' : 'Organizer'}
                  </span>
                  {c.docType && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {DOC_LABELS[c.docType as keyof typeof DOC_LABELS] ?? c.docType}
                    </Badge>
                  )}
                  <span>{new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="mt-1 text-neutral-700">{c.comment}</p>
              </div>
            ))}
          </div>

          {/* Add Comment */}
          <div className="flex gap-2 pt-2 border-t border-neutral-100">
            <Select value={commentDocType ?? 'general'} onValueChange={(v) => setCommentDocType(v === 'general' ? undefined : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="General" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                {DOC_TYPES.map((dt) => (
                  <SelectItem key={dt} value={dt}>{DOC_LABELS[dt]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment() }}
            />
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!commentText.trim() || commentMutation.isPending}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Reject with reason sub-component ─────────────────
function DocRejectButton({
  docType,
  onReject,
  isPending,
}: {
  docType: string
  onReject: (comment?: string) => void
  isPending: boolean
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const docLabel = DOC_LABELS[docType as keyof typeof DOC_LABELS] ?? docType

  const handleConfirm = () => {
    onReject(reason || undefined)
    setOpen(false)
    setReason('')
  }

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        className="flex-1"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        <XCircle className="mr-1 h-3.5 w-3.5" />
        Reject
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setReason('') }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {docLabel}?</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this document? The organizer will be notified and asked to re-upload.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection (optional)..."
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setOpen(false); setReason('') }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
              Reject Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
