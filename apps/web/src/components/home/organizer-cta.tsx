'use client'

import { useState } from 'react'
import { OrganizerWaitlistModal } from './organizer-waitlist-modal'

interface OrganizerCtaProps {
  label: string
}

export function OrganizerCta({ label }: OrganizerCtaProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 inline-block rounded-lg bg-white px-8 py-3 text-sm font-semibold text-primary-700 shadow-sm transition-all hover:bg-neutral-50"
      >
        {label}
      </button>
      <OrganizerWaitlistModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
