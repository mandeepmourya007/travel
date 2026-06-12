'use client'

import { useEffect, useState } from 'react'
import { Timer, AlertCircle } from 'lucide-react'

/** Switch from info (blue) to warning (orange) banner when under 5 minutes remain */
const URGENCY_THRESHOLD_SECONDS = 5 * 60

interface HoldCountdownBannerProps {
  /** ISO timestamp when the booking / seat hold expires */
  expiresAt: string
}

function getSecondsLeft(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

/**
 * Countdown banner shown once a booking has been created (seats are held).
 * The backend holds seats for the booking-expiry window — if payment isn't
 * completed in time the hold is released and the booking expires.
 */
export function HoldCountdownBanner({ expiresAt }: HoldCountdownBannerProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsLeft(expiresAt))

  useEffect(() => {
    setSecondsLeft(getSecondsLeft(expiresAt))
    const interval = setInterval(() => {
      const left = getSecondsLeft(expiresAt)
      setSecondsLeft(left)
      if (left <= 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  if (secondsLeft <= 0) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 px-4 py-2.5 text-sm font-medium text-error-500"
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        Your seat hold has expired. Please go back and select seats again.
      </div>
    )
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeLabel = `${minutes}:${String(seconds).padStart(2, '0')}`
  const urgent = secondsLeft <= URGENCY_THRESHOLD_SECONDS

  return (
    <div
      role="status"
      className={
        urgent
          ? 'flex items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-2.5 text-sm font-medium text-warning-500'
          : 'flex items-center gap-2 rounded-lg border border-info-200 bg-info-50 px-4 py-2.5 text-sm font-medium text-info-500'
      }
    >
      <Timer className="h-4 w-4 shrink-0" />
      <span>
        Your seats are reserved — complete payment within{' '}
        <strong className="font-mono">{timeLabel}</strong>
      </span>
    </div>
  )
}
