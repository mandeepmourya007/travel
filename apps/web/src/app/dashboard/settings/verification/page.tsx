'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Upload, Loader2, Eye, ShieldCheck, Clock, ShieldX, RefreshCw, MessageSquare, Send, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useProfile, useUpdateOrganizerProfile } from '@/hooks/use-profile'
import { BankAccountForm } from '@/components/dashboard/bank-account-form'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import { useOrganizerDocComments, useOrganizerAddDocComment } from '@/hooks/use-doc-review'
import { ImageLightbox, useLightbox } from '@/components/shared/image-lightbox'
import { useToast } from '@/components/shared/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { DOC_LABELS } from '@shared/constants/upload'
import type { OrganizerDocuments } from '@shared/types/user.types'
import type { DocumentReviewItem } from '@shared/types/admin.types'
import type { VerificationStatus } from '@shared/constants/verification-status'
import { MAX_UPLOAD_SIZE_BYTES, REQUIRED_DOC_COUNT } from '@shared/constants'

const DOC_FIELDS: { key: keyof OrganizerDocuments; label: string; description: string }[] = [
  { key: 'aadhaarFront', label: 'Aadhaar Card (Front)', description: 'Upload the front side of your Aadhaar card' },
  { key: 'aadhaarBack', label: 'Aadhaar Card (Back)', description: 'Upload the back side of your Aadhaar card' },
  { key: 'panCard', label: 'PAN Card', description: 'Upload your PAN card image' },
]

const STATUS_CONFIG: Record<VerificationStatus, { label: string; icon: typeof ShieldCheck; className: string; bg: string }> = {
  APPROVED: { label: 'Verified', icon: ShieldCheck, className: 'text-success-700', bg: 'bg-success-50 border-success-200' },
  PENDING: { label: 'Pending Review', icon: Clock, className: 'text-warning-700', bg: 'bg-warning-50 border-warning-200' },
  REJECTED: { label: 'Rejected', icon: ShieldX, className: 'text-error-700', bg: 'bg-error-50 border-error-200' },
  REVISION_REQUIRED: { label: 'Revision Required', icon: RefreshCw, className: 'text-warning-700', bg: 'bg-warning-50 border-warning-200' },
}

export default function VerificationDocsPage() {
  const { data: profile, isLoading } = useProfile()
  const mutation = useUpdateOrganizerProfile()
  const { upload, isUploading } = useCloudinaryUpload()
  const { toast } = useToast()
  const { isOpen, open: openLightbox, lightboxProps } = useLightbox()
  const [uploadingField, setUploadingField] = useState<keyof OrganizerDocuments | null>(null)

  const docs: OrganizerDocuments = (profile?.organizerProfile?.documents as OrganizerDocuments) ?? {}
  const verificationStatus = profile?.organizerProfile?.verificationStatus ?? 'PENDING'
  const docReviews: DocumentReviewItem[] = (profile?.organizerProfile?.documentReviews as DocumentReviewItem[]) ?? []
  const docReviewMap = Object.fromEntries(docReviews.map((dr) => [dr.docType, dr]))

  const handleUpload = async (field: keyof OrganizerDocuments, file: File) => {
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast({ variant: 'error', title: 'File too large. Max 5MB.' })
      return
    }

    setUploadingField(field)
    try {
      const url = await upload(file, 'verification-docs')
      mutation.mutate(
        { documents: { [field]: url } },
        {
          onSuccess: () => {
            toast({ variant: 'success', title: `${DOC_FIELDS.find((d) => d.key === field)?.label} uploaded` })
            setUploadingField(null)
          },
          onError: (err) => {
            toast({ variant: 'error', title: err.message })
            setUploadingField(null)
          },
        },
      )
    } catch {
      toast({ variant: 'error', title: 'Upload failed. Please try again.' })
      setUploadingField(null)
    }
  }

  const handleReUpload = (field: keyof OrganizerDocuments) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) handleUpload(field, file)
    }
    input.click()
  }

  const uploadedCount = DOC_FIELDS.filter((f) => docs[f.key]).length
  const statusCfg = STATUS_CONFIG[verificationStatus]
  const StatusIcon = statusCfg.icon

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="skeleton h-16 rounded-xl mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-36 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/profile" className="btn-ghost p-2" aria-label="Back to profile">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="font-display text-2xl font-bold text-neutral-900">Verification Documents</h2>
          <p className="text-sm text-neutral-500">
            Upload your identity documents for admin verification ({uploadedCount}/{REQUIRED_DOC_COUNT} uploaded)
          </p>
        </div>
      </div>

      {/* Verification Status Banner */}
      <div className={cn('mb-6 flex items-center gap-3 rounded-xl border p-4', statusCfg.bg)}>
        <StatusIcon className={cn('h-5 w-5 shrink-0', statusCfg.className)} />
        <div className="flex-1">
          <p className={cn('text-sm font-semibold', statusCfg.className)}>{statusCfg.label}</p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {verificationStatus === 'APPROVED' && 'Your identity has been verified. You can create trips.'}
            {verificationStatus === 'PENDING' && uploadedCount === REQUIRED_DOC_COUNT && 'All documents uploaded. Our team will review them shortly.'}
            {verificationStatus === 'PENDING' && uploadedCount < REQUIRED_DOC_COUNT && `Upload all ${REQUIRED_DOC_COUNT} documents to begin the review process.`}
            {verificationStatus === 'REJECTED' && 'Please re-upload clearer documents and our team will review again.'}
          </p>
        </div>
      </div>

      {/* Document Cards */}
      <div className="space-y-4">
        {DOC_FIELDS.map((field) => {
          const docUrl = docs[field.key]
          const isFieldUploading = uploadingField === field.key && (isUploading || mutation.isPending)
          const review = docReviewMap[field.key] as DocumentReviewItem | undefined

          return (
            <div
              key={field.key}
              className={cn(
                'card-static overflow-hidden',
                review?.status === 'REJECTED' && 'border-error-200',
              )}
            >
              <div className="flex items-start gap-4 p-5">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-neutral-800">{field.label}</h3>
                    <DocStatusBadge status={review?.status} hasDoc={!!docUrl} />
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">{field.description}</p>
                </div>

                {docUrl ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openLightbox([docUrl], 0)}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReUpload(field.key)}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
                      disabled={isFieldUploading || mutation.isPending}
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', isFieldUploading && 'animate-spin')} />
                      Replace
                    </button>
                  </div>
                ) : (
                  <label className="btn-outline flex cursor-pointer items-center gap-2 text-xs">
                    {isFieldUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {isFieldUploading ? 'Uploading...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isFieldUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(field.key, file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Rejection reason */}
              <DocRejectionReason docType={field.key} review={review} onReUpload={() => handleReUpload(field.key)} />

              {/* Document Thumbnail Preview */}
              {docUrl && (
                <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => openLightbox([docUrl], 0)}
                    className="group relative overflow-hidden rounded-lg border border-neutral-200 transition-shadow hover:shadow-md"
                  >
                    <Image
                      src={docUrl}
                      alt={field.label}
                      width={240}
                      height={160}
                      className="h-40 w-auto object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                      <Eye className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Comment Thread */}
      <DocCommentThread />

      <p className="mt-4 text-xs text-neutral-400">
        Documents are stored securely and used only for verification by our admin team.
        Aadhaar numbers will not be stored in plain text.
      </p>

      {/* Bank Account — shown below KYC docs on the same page */}
      <div className="mt-8">
        <h3 className="font-display text-lg font-semibold text-neutral-900 mb-1">Payout Bank Account</h3>
        <p className="text-sm text-neutral-500 mb-4">
          Link your bank account to receive payouts after trip completion.
        </p>
        <BankAccountForm bankAccountLinked={profile?.organizerProfile?.bankAccountLinked} />
      </div>

      {/* Lightbox */}
      {isOpen && lightboxProps && <ImageLightbox {...lightboxProps} />}
    </div>
  )
}

// ─── Per-doc status badge ─────────────────────────────
function DocStatusBadge({ status, hasDoc }: { status?: string; hasDoc: boolean }) {
  if (!status && !hasDoc) return null

  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </span>
    )
  }

  if (status === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-error-50 px-2 py-0.5 text-[10px] font-semibold text-error-700">
        <AlertTriangle className="h-3 w-3" />
        Rejected
      </span>
    )
  }

  if (status === 'PENDING' || hasDoc) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-semibold text-warning-700">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    )
  }

  return null
}

// ─── Per-doc rejection reason ─────────────────────────
function DocRejectionReason({ docType, review, onReUpload }: { docType: string; review?: DocumentReviewItem; onReUpload: () => void }) {
  const { data: comments } = useOrganizerDocComments()

  if (review?.status !== 'REJECTED') return null

  // Find the latest admin comment for this doc type
  const latestRejectionComment = comments
    ?.filter((c) => c.authorRole === 'ADMIN' && c.docType === docType)
    .at(-1)

  return (
    <div className="mx-5 mb-4 rounded-lg border border-error-200 bg-error-50 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error-600" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-error-700">Document rejected</p>
          {latestRejectionComment ? (
            <p className="mt-0.5 text-xs text-error-600">
              Reason: {latestRejectionComment.comment}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-error-600">
              Please re-upload a clearer document.
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 border-error-300 text-xs text-error-700 hover:bg-error-100"
            onClick={onReUpload}
          >
            <Upload className="mr-1 h-3 w-3" />
            Re-upload
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Comment thread sub-component ─────────────────────
function DocCommentThread() {
  const { data: comments, isLoading } = useOrganizerDocComments()
  const addComment = useOrganizerAddDocComment()
  const [text, setText] = useState('')

  const handleSend = () => {
    if (!text.trim()) return
    addComment.mutate({ comment: text.trim() }, {
      onSuccess: () => setText(''),
    })
  }

  if (isLoading) {
    return (
      <div className="mt-6">
        <div className="skeleton h-6 w-40 mb-3" />
        <div className="skeleton h-20 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-neutral-500" />
        <h3 className="font-display text-sm font-semibold text-neutral-800">Review Comments</h3>
        {comments && comments.length > 0 && (
          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
            {comments.length}
          </span>
        )}
      </div>

      {(!comments || comments.length === 0) ? (
        <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-neutral-300" />
          <p className="mt-2 text-sm text-neutral-500">No comments yet</p>
          <p className="text-xs text-neutral-400">Admin comments about your documents will appear here</p>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 max-h-64 overflow-y-auto">
          {comments.map((c) => (
            <div
              key={c.id}
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                c.authorRole === 'ADMIN'
                  ? 'mr-8 bg-white border border-neutral-200'
                  : 'ml-8 bg-primary-50 border border-primary-100',
              )}
            >
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span className="font-medium text-neutral-700">
                  {c.authorRole === 'ADMIN' ? 'Admin' : 'You'}
                </span>
                {c.docType && (
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                    {DOC_LABELS[c.docType as keyof typeof DOC_LABELS] ?? c.docType}
                  </span>
                )}
                <span>{new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="mt-1 text-neutral-700">{c.comment}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      <div className="mt-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply to admin..."
          className="flex-1"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!text.trim() || addComment.isPending}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
