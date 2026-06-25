import { HERO_COPY, HERO_TRUST_BADGES } from '@/lib/home-content'
import { HeroSearchForm } from './hero-search-form'

export function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-primary-50 via-white to-highlight-50 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <span className="inline-block rounded-full bg-primary-100 px-4 py-1 text-sm font-semibold text-primary-700 mb-5">
          {HERO_COPY.eyebrow}
        </span>

        <h1 className="font-display text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
          {HERO_COPY.headlinePart1}{' '}
          <span className="text-primary-600">{HERO_COPY.headlinePart2}</span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-500 leading-relaxed">
          {HERO_COPY.subheadline}
        </p>

        <HeroSearchForm />

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-6">
          {HERO_TRUST_BADGES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-start gap-2 text-sm text-neutral-500 max-w-[180px] sm:max-w-[160px] text-left">
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary-500 mt-0.5" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
