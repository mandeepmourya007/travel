'use client'

import * as React from 'react'
import { DatePicker } from '@/components/shared/date-picker'
import { DateRangePicker } from '@/components/shared/date-range-picker'
import { DateTimePicker } from '@/components/shared/date-time-picker'
import { TimePicker } from '@/components/shared/time-picker'

// ── helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-neutral-200 pb-2 font-display text-base font-bold text-neutral-800 sm:text-lg">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-white p-3 sm:p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      {children}
    </div>
  )
}

function ValueBadge({ value }: { value: string | undefined }) {
  return (
    <p className="mt-2 break-all rounded bg-neutral-100 px-2 py-1 font-mono text-xs text-neutral-500">
      {value ?? 'undefined'}
    </p>
  )
}

// ── demo sections ─────────────────────────────────────────────────────────────

function DatePickerDemo() {
  const [plain, setPlain] = React.useState<string | undefined>()
  const [prefilled, setPrefilled] = React.useState<string | undefined>('2025-08-15')
  const [minToday, setMinToday] = React.useState<string | undefined>()
  const [disabled] = React.useState<string | undefined>('2025-01-01')

  return (
    <Section title="Date Picker">
      <Row label="Empty">
        <DatePicker value={plain} onChange={setPlain} placeholder="Pick a date" className="w-full sm:w-56" />
        <ValueBadge value={plain} />
      </Row>
      <Row label="Pre-filled">
        <DatePicker value={prefilled} onChange={setPrefilled} className="w-full sm:w-56" />
        <ValueBadge value={prefilled} />
      </Row>
      <Row label="Future only (minDate = today)">
        <DatePicker value={minToday} onChange={setMinToday} minDate={new Date()} placeholder="Future dates only" className="w-full sm:w-56" />
        <ValueBadge value={minToday} />
      </Row>
      <Row label="Disabled">
        <DatePicker value={disabled} onChange={() => {}} disabled className="w-full sm:w-56" />
        <ValueBadge value={disabled} />
      </Row>
    </Section>
  )
}

function DateTimePickerDemo() {
  const [plain, setPlain] = React.useState<string | undefined>()
  const [prefilled, setPrefilled] = React.useState<string | undefined>('2025-08-15T06:00:00.000Z')
  const [minToday, setMinToday] = React.useState<string | undefined>()
  const [disabled] = React.useState<string | undefined>('2025-01-01T09:00:00.000Z')

  return (
    <Section title="Date & Time Picker">
      <Row label="Empty">
        <DateTimePicker value={plain} onChange={setPlain} placeholder="Pick date & time" className="w-full sm:w-72" />
        <ValueBadge value={plain} />
      </Row>
      <Row label="Pre-filled (ISO string)">
        <DateTimePicker value={prefilled} onChange={setPrefilled} className="w-full sm:w-72" />
        <ValueBadge value={prefilled} />
      </Row>
      <Row label="Future only (minDate = today)">
        <DateTimePicker value={minToday} onChange={setMinToday} minDate={new Date()} placeholder="Future dates only" className="w-full sm:w-72" />
        <ValueBadge value={minToday} />
      </Row>
      <Row label="Disabled">
        <DateTimePicker value={disabled} onChange={() => {}} disabled className="w-full sm:w-72" />
        <ValueBadge value={disabled} />
      </Row>
    </Section>
  )
}

function TimePickerDemo() {
  const [plain, setPlain] = React.useState<string | undefined>()
  const [prefilled, setPrefilled] = React.useState<string>('06:00 AM')
  const [disabled] = React.useState<string>('11:30 PM')

  return (
    <Section title="Time Picker">
      <Row label="Empty">
        <TimePicker value={plain} onChange={setPlain} placeholder="Select time" className="w-full sm:w-44" />
        <ValueBadge value={plain} />
      </Row>
      <Row label="Pre-filled">
        <TimePicker value={prefilled} onChange={setPrefilled} className="w-full sm:w-44" />
        <ValueBadge value={prefilled} />
      </Row>
      <Row label="Disabled">
        <TimePicker value={disabled} onChange={() => {}} disabled className="w-full sm:w-44" />
        <ValueBadge value={disabled} />
      </Row>
    </Section>
  )
}

function SideBySideDemo() {
  const [from, setFrom] = React.useState<string | undefined>()
  const [to, setTo] = React.useState<string | undefined>()
  const [start, setStart] = React.useState<string | undefined>()
  const [end, setEnd] = React.useState<string | undefined>()
  const [pickup, setPickup] = React.useState<string | undefined>()
  const [drop, setDrop] = React.useState<string | undefined>()

  return (
    <Section title="Real-world Combos">
      {/* Payment date range filter */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Payment date range filter</p>
        <DateRangePicker
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          placeholder="Select date range"
          className="w-full text-sm"
        />
        {(from || to) && (
          <p className="font-mono text-xs text-neutral-400">{from ?? '…'} → {to ?? '…'}</p>
        )}
      </div>

      {/* Trip start & end */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Trip start &amp; end (with time)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-500">Start</label>
            <DateTimePicker value={start} onChange={setStart} placeholder="Start date & time" minDate={new Date()} className="w-full text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-500">End</label>
            <DateTimePicker value={end} onChange={setEnd} placeholder="End date & time" minDate={new Date()} className="w-full text-sm" />
          </div>
        </div>
      </div>

      {/* Pickup & drop times */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Pickup &amp; drop times</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-500">Pickup time</label>
            <TimePicker value={pickup} onChange={setPickup} placeholder="Pickup time" className="w-full text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-500">Drop time</label>
            <TimePicker value={drop} onChange={setDrop} placeholder="Drop time" className="w-full text-sm" />
          </div>
        </div>
      </div>
    </Section>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function DemoCssPage() {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-neutral-900 sm:text-3xl">Component Demo</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Live playground for shared date / time picker components.
          </p>
        </div>

        <DatePickerDemo />
        <DateTimePickerDemo />
        <TimePickerDemo />
        <SideBySideDemo />
      </div>
    </div>
  )
}
