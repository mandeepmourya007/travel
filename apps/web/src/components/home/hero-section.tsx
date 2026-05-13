import { HeroSearchForm } from './hero-search-form'

export function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-primary-50 via-white to-highlight-50 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
          Compare Group Trips.{' '}
          <span className="text-primary-600">Book Safely.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-neutral-500 leading-relaxed">
          Discover curated group trips from verified organizers. Escrow-protected
          payments, real reviews, and hassle-free travel from Pune.
        </p>

        {/* Client-rendered search form */}
        <HeroSearchForm />
      </div>
    </section>
  )
}
