import Image from 'next/image'
import { Plane, MapPin, Luggage, Compass, Camera, Coffee, IceCreamCone, Backpack } from 'lucide-react'

interface ContrailPlaneProps {
  /** Which way the plane is flying — controls contrail placement (always trails behind) and icon rotation. */
  direction: 'right' | 'left'
  iconColorClassName: string
  contrailColorClassName: string
}

// A plane icon + its contrail, ordered so the contrail always trails behind
// the direction of travel. Local helper — only used by the two flight paths
// below, not meant for reuse elsewhere.
function ContrailPlane({ direction, iconColorClassName, contrailColorClassName }: ContrailPlaneProps) {
  const contrail = (
    <span
      className={`h-px w-12 rounded-full sm:w-20 ${
        direction === 'right' ? 'bg-gradient-to-r' : 'bg-gradient-to-l'
      } from-transparent ${contrailColorClassName}`}
    />
  )
  // rotate-45 / rotate-[225deg] were arrived at by testing against the actual
  // Lucide `Plane` glyph shape (its default orientation isn't a clean
  // horizontal) — don't re-derive these from first principles.
  const plane = (
    <Plane
      className={`h-6 w-6 sm:h-7 sm:w-7 ${direction === 'right' ? 'rotate-45' : 'rotate-[225deg]'} ${iconColorClassName}`}
    />
  )
  return (
    <div className="flex items-center gap-1.5">
      {direction === 'right' ? contrail : plane}
      {direction === 'right' ? plane : contrail}
    </div>
  )
}

// Decorative background for the homepage hero — gradient blobs, a faded
// watermark logo, flying-plane elements with contrails, and drifting travel
// icons. Presentational only; purely absolute-positioned and pointer-events-none.
export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary-200/40 blur-3xl" />
      <div className="absolute -right-20 top-10 h-64 w-64 rounded-full bg-accent-200/40 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-highlight-200/30 blur-3xl" />

      <Image
        src="/logo-prod.svg"
        alt=""
        width={475}
        height={150}
        className="absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 opacity-[0.06] sm:w-96"
      />

      {/* Flying planes with contrails, crossing the hero in opposite directions.
          Positioned via `left` (animated in tailwind.config.ts), relative to
          this section — not viewport vw units — so the flight path always
          matches the section's actual rendered width. */}
      <div className="absolute top-[14%] animate-fly-right">
        <ContrailPlane
          direction="right"
          iconColorClassName="text-primary-500/70"
          contrailColorClassName="to-primary-300/80"
        />
      </div>
      <div className="absolute bottom-2 sm:bottom-4 animate-fly-left">
        <ContrailPlane
          direction="left"
          iconColorClassName="text-accent-500/70"
          contrailColorClassName="to-accent-300/80"
        />
      </div>

      <MapPin className="absolute right-[10%] top-[22%] h-7 w-7 text-accent-500/60 animate-float-reverse sm:h-9 sm:w-9" />
      <Luggage className="absolute left-[14%] bottom-[14%] h-7 w-7 text-highlight-500/60 animate-float-slow sm:h-9 sm:w-9" />
      <Compass className="absolute right-[26%] top-[8%] h-6 w-6 text-accent-400/60 animate-drift sm:h-7 sm:w-7" />
      <Camera className="absolute left-[24%] top-[10%] h-5 w-5 text-highlight-400/50 animate-float-reverse sm:h-6 sm:w-6" />
      <Coffee className="absolute left-[5%] top-[44%] h-5 w-5 text-primary-500/50 animate-float-slow sm:h-6 sm:w-6" />
      <IceCreamCone className="absolute left-[32%] bottom-[6%] h-4 w-4 text-accent-500/50 animate-float-reverse sm:h-5 sm:w-5" />
      <Backpack className="absolute right-[3%] top-[48%] h-5 w-5 text-primary-400/50 animate-float sm:h-6 sm:w-6" />
    </div>
  )
}
