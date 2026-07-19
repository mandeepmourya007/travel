'use client'

import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/shared/modal'
import { HERO_COPY, HERO_TRUST_BADGES } from '@/lib/home-content'

const WELCOME_SEEN_KEY = 'home_welcome_seen'
const AUTO_HIDE_MS = 3000

export function WelcomeModal() {
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (sessionStorage.getItem(WELCOME_SEEN_KEY)) return

    sessionStorage.setItem(WELCOME_SEEN_KEY, '1')
    setOpen(true)
    timerRef.current = setTimeout(() => setOpen(false), AUTO_HIDE_MS)

    return () => clearTimeout(timerRef.current)
  }, [])

  function handleClose() {
    clearTimeout(timerRef.current)
    setOpen(false)
  }

  return (
    <Modal open={open} onClose={handleClose} title={HERO_COPY.eyebrow}>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
        {HERO_COPY.headlinePart1}{' '}
        <span className="text-primary-600">{HERO_COPY.headlinePart2}</span>
      </h2>

      <p className="mt-4 text-base text-neutral-500 leading-relaxed">{HERO_COPY.subheadline}</p>

      <div className="mt-6 flex flex-col gap-3">
        {HERO_TRUST_BADGES.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-start gap-2 text-sm text-neutral-500">
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary-500 mt-0.5" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}
