'use client'

import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import {
  CheckCircle,
  AlertCircle,
  MapPin,
  Calendar,
  Users,
  Zap,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Clock,
  Tag,
  Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDateRange } from '@/lib/format'
import { useDestinations } from '@/hooks/use-destinations'
import type { CreateTripDto, ItineraryDay, CreateTransferPointDto } from '@shared/types/trip.types'

const CANCELLATION_LABELS: Record<string, string> = {
  FLEXIBLE: 'Flexible — Full refund up to 7 days before',
  MODERATE: 'Moderate — Full refund up to 14 days before',
  STRICT: 'Strict — No refunds after booking',
}

// Inclusions/exclusions are stored as newline-joined strings by the <textarea>
// but may arrive as string[] when rehydrated from a JSON draft — handle both.
function toList(val: string | string[] | undefined): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  return val.split('\n').map((s) => s.trim()).filter(Boolean)
}

export function ReviewTab() {
  const { watch, formState: { errors } } = useFormContext<CreateTripDto>()
  const { data: destinations } = useDestinations()
  const values = watch()
  const errorCount = Object.keys(errors).length

  const {
    title,
    destinationId,
    tripType,
    bookingMode,
    description,
    startDate,
    endDate,
    pricePerPerson,
    earlyBirdPrice,
    earlyBirdDeadline,
    minGroupSize,
    maxGroupSize,
    cancellationPolicy,
    inclusions: rawInclusions = [],
    exclusions: rawExclusions = [],
    itinerary = [],
    photos = [],
    pickupPoints = [],
    dropPoints = [],
    itineraryDocUrl,
  } = values

  const destinationName = destinations?.find((d) => d.id === destinationId)?.name ?? destinationId ?? '—'
  const inclusions = toList(rawInclusions as string | string[])
  const exclusions = toList(rawExclusions as string | string[])

  const hasDateRange = startDate && endDate
  const hasEarlyBird = earlyBirdPrice && earlyBirdDeadline
  const hasInclusions = inclusions.length > 0
  const hasExclusions = exclusions.length > 0
  const hasItinerary = itinerary.length > 0
  const hasPhotos = photos.length > 0
  const hasPickup = pickupPoints.filter((p) => p.label).length > 0
  const hasDrop = dropPoints.filter((p) => p.label).length > 0
  const hasTransfers = hasPickup || hasDrop

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Validation banner */}
      <ValidationBanner errorCount={errorCount} />

      {/* Hero */}
      <section className="card-static overflow-hidden">
        <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3 sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Trip Preview</p>
        </div>
        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <h2 className="font-display text-xl font-bold text-neutral-900 sm:text-2xl">
            {title || <span className="text-neutral-400 italic">No title yet</span>}
          </h2>

          <div className="mt-3 flex flex-wrap gap-2">
            {tripType && (
              <span className="badge badge-primary flex items-center gap-1 text-xs">
                <Tag className="h-3 w-3" />
                {tripType}
              </span>
            )}
            {bookingMode && (
              <span className={cn(
                'badge flex items-center gap-1 text-xs',
                bookingMode === 'INSTANT' ? 'badge-success' : 'badge-warning',
              )}>
                {bookingMode === 'INSTANT'
                  ? <><Zap className="h-3 w-3" /> Instant Book</>
                  : <><ClipboardList className="h-3 w-3" /> Request Based</>
                }
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <InfoChip
              icon={<MapPin className="h-4 w-4 shrink-0 text-primary-500" />}
              label="Destination"
              value={destinationName}
            />
            <InfoChip
              icon={<Calendar className="h-4 w-4 shrink-0 text-primary-500" />}
              label="Dates"
              value={hasDateRange ? formatDateRange(startDate, endDate) : '—'}
            />
            <InfoChip
              icon={<Users className="h-4 w-4 shrink-0 text-primary-500" />}
              label="Group Size"
              value={minGroupSize && maxGroupSize ? `${minGroupSize}–${maxGroupSize} people` : '—'}
            />
          </div>
        </div>
      </section>

      {/* Pricing + Description — stacked on mobile, 2-col on md */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-6">
        {/* Pricing card */}
        <div className="card-static md:col-span-2">
          <SectionHeader title="Pricing & Policy" />
          <div className="divide-y divide-neutral-100">
            <PriceRow
              label="Price / person"
              value={pricePerPerson ? formatCurrency(pricePerPerson) : '—'}
              highlight
            />
            {hasEarlyBird && (
              <PriceRow
                label="Early bird price"
                value={formatCurrency(earlyBirdPrice!)}
              />
            )}
            {hasEarlyBird && earlyBirdDeadline && (
              <PriceRow
                label="Early bird deadline"
                value={new Date(earlyBirdDeadline).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
              />
            )}
            <PriceRow
              label="Cancellation"
              value={cancellationPolicy ? CANCELLATION_LABELS[cancellationPolicy] ?? cancellationPolicy : '—'}
              small
            />
          </div>
        </div>

        {/* Description */}
        <div className="card-static md:col-span-3">
          <SectionHeader title="Description" />
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            {description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">
                {description}
              </p>
            ) : (
              <p className="text-sm italic text-neutral-400">No description added.</p>
            )}
            {itineraryDocUrl && (
              <a
                href={itineraryDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                View itinerary document →
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Inclusions + Exclusions — stacked on mobile, 2-col on md */}
      {(hasInclusions || hasExclusions) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          {hasInclusions && (
            <div className="card-static">
              <SectionHeader title="What's Included" />
              <ul className="divide-y divide-neutral-100">
                {inclusions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 px-4 py-2.5 sm:px-5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-500" />
                    <span className="text-sm text-neutral-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasExclusions && (
            <div className="card-static">
              <SectionHeader title="Not Included" />
              <ul className="divide-y divide-neutral-100">
                {exclusions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 px-4 py-2.5 sm:px-5">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-error-500" />
                    <span className="text-sm text-neutral-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Itinerary */}
      {hasItinerary && (
        <div className="card-static overflow-hidden">
          <SectionHeader title={`Itinerary (${itinerary.length} day${itinerary.length !== 1 ? 's' : ''})`} />
          <div className="divide-y divide-neutral-100">
            {itinerary.map((day, idx) => (
              <ItineraryDayRow key={day.day ?? idx} day={day} defaultOpen={idx < 2} />
            ))}
          </div>
        </div>
      )}

      {/* Pickup + Drop — stacked on mobile, 2-col on md */}
      {hasTransfers && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          {hasPickup && (
            <div className="card-static">
              <SectionHeader title="Pickup Points" />
              <ul className="divide-y divide-neutral-100">
                {pickupPoints.filter((p) => p.label).map((point, i) => (
                  <TransferRow key={i} point={point} />
                ))}
              </ul>
            </div>
          )}
          {hasDrop && (
            <div className="card-static">
              <SectionHeader title="Drop Points" />
              <ul className="divide-y divide-neutral-100">
                {dropPoints.filter((p) => p.label).map((point, i) => (
                  <TransferRow key={i} point={point} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Photos */}
      {hasPhotos && (
        <div className="card-static overflow-hidden">
          <SectionHeader title={`Photos (${photos.length})`} />
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.slice(0, 6).map((url, i) => (
                <div
                  key={i}
                  className="relative aspect-video overflow-hidden rounded-lg bg-neutral-100"
                >
                  {url ? (
                    <img
                      src={url}
                      alt={`Trip photo ${i + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-neutral-300" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {photos.length > 6 && (
              <p className="mt-2 text-center text-xs text-neutral-400">
                +{photos.length - 6} more photo{photos.length - 6 !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ValidationBanner({ errorCount }: { errorCount: number }) {
  if (errorCount === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-success-200 bg-success-50 px-4 py-3 sm:px-5 sm:py-4">
        <CheckCircle className="h-5 w-5 shrink-0 text-success-600" />
        <p className="text-sm font-medium text-success-700">
          All fields look good — ready to create!
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 sm:px-5 sm:py-4">
      <AlertCircle className="h-5 w-5 shrink-0 text-error-600" />
      <p className="text-sm font-medium text-error-700">
        {errorCount} validation error{errorCount !== 1 ? 's' : ''} — fix them in the tabs above before submitting.
      </p>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-neutral-100 px-4 py-3 sm:px-5">
      <p className="text-sm font-semibold text-neutral-800">{title}</p>
    </div>
  )
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-neutral-50 px-3 py-2.5">
      {icon}
      <div className="min-w-0">
        <p className="text-xs text-neutral-400">{label}</p>
        <p className="truncate text-sm font-medium text-neutral-800">{value}</p>
      </div>
    </div>
  )
}

function PriceRow({ label, value, highlight, small }: { label: string; value: string; highlight?: boolean; small?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 sm:px-5">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className={cn(
        'text-right',
        highlight ? 'text-lg font-bold text-primary-600' : small ? 'max-w-[55%] text-xs font-medium text-neutral-600 text-right leading-snug' : 'text-sm font-semibold text-neutral-800',
      )}>
        {value}
      </span>
    </div>
  )
}

function ItineraryDayRow({ day, defaultOpen }: { day: ItineraryDay; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const hasActivities = day.activities && day.activities.length > 0

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 sm:px-5"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
            {day.day}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-800">
              {day.title || `Day ${day.day}`}
            </p>
            {day.subtitle && (
              <p className="truncate text-xs text-neutral-400">{day.subtitle}</p>
            )}
          </div>
        </div>
        {open ? (
          <ChevronUp className="ml-2 h-4 w-4 shrink-0 text-neutral-400" />
        ) : (
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-neutral-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-neutral-50 bg-neutral-50/50 px-4 pb-4 pt-3 sm:px-5">
          {day.description && (
            <p className="text-sm leading-relaxed text-neutral-600">{day.description}</p>
          )}
          {hasActivities && (
            <ul className="mt-3 space-y-2">
              {day.activities.map((act, i) => (
                <li key={i} className="flex items-start gap-2">
                  {act.time && (
                    <span className="flex items-center gap-0.5 shrink-0 text-xs text-neutral-400 pt-0.5">
                      <Clock className="h-3 w-3" />
                      {act.time}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-medium text-neutral-700">{act.title}</p>
                    {act.description && (
                      <p className="text-xs text-neutral-500">{act.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function TransferRow({ point }: { point: CreateTransferPointDto }) {
  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-neutral-800">{point.label}</p>
        {point.extraCharge ? (
          <span className="shrink-0 text-xs font-medium text-accent-600">
            +{formatCurrency(point.extraCharge)}
          </span>
        ) : null}
      </div>
      {point.address && <p className="mt-0.5 text-xs text-neutral-400">{point.address}</p>}
      {point.time && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-400">
          <Clock className="h-3 w-3" /> {point.time}
        </p>
      )}
    </li>
  )
}
