'use client'

import { useRouter } from 'next/navigation'
import { LogIn } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface LoginRequiredDialogProps {
  open: boolean
  onClose: () => void
  returnTo: string
}

export function LoginRequiredDialog({ open, onClose, returnTo }: LoginRequiredDialogProps) {
  const router = useRouter()

  const handleLoginClick = () => {
    router.push(`/login/email?returnTo=${encodeURIComponent(returnTo)}`)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
            <LogIn className="h-6 w-6 text-primary-500" />
          </div>
          <DialogTitle className="text-center">Login Required</DialogTitle>
          <DialogDescription className="text-center">
            You need to sign in to book this trip. After logging in, you&apos;ll be redirected back to continue.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-6"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLoginClick}
            className="btn-primary px-6"
          >
            Sign In
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
