'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Upload, X, FileCheck, Loader2, Eye, ShieldCheck, Clock, ShieldX, RefreshCw } from 'lucide-react'
import { useProfile, useUpdateOrganizerProfile } from '@/hooks/use-profile'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import { ImageLightbox, useLightbox } from '@/components/shared/image-lightbox'
import { useToast } from '@/components/shared/toast'
import { cn } from '@/lib/utils'
import type { OrganizerDocuments } from '@shared/types/user.types'
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

  const handleRemove = (field: keyof OrganizerDocuments) => {
    mutation.mutate(
      { documents: { [field]: '' } },
      {
        onSuccess: () => {
          toast({ variant: 'success', title: 'Document removed' })
        },
      },
    )
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
        <Link href="/profile" className="btn-ghost p-2">
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

          return (
            <div
              key={field.key}
              className="card-static overflow-hidden"
            >
              <div className="flex items-start gap-4 p-5">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-neutral-800">{field.label}</h3>
                    {docUrl && <FileCheck className="h-4 w-4 text-success-500" />}
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
                    <button
                      type="button"
                      onClick={() => handleRemove(field.key)}
                      className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-error-500"
                      disabled={mutation.isPending}
                    >
                      <X className="h-4 w-4" />
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

      <p className="mt-4 text-xs text-neutral-400">
        Documents are stored securely and used only for verification by our admin team.
        Aadhaar numbers will not be stored in plain text.
      </p>

      {/* Lightbox */}
      {isOpen && lightboxProps && <ImageLightbox {...lightboxProps} />}
    </div>
  )
}
