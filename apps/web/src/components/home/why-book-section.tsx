import Link from 'next/link'
import { WHY_BOOK_COPY, WHY_BOOK_FEATURES } from '@/lib/home-content'

export function WhyBookSection() {
  const { organizer } = WHY_BOOK_COPY

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl font-bold text-neutral-800 sm:text-3xl">
            {WHY_BOOK_COPY.heading}
          </h2>
          <p className="mt-3 text-neutral-500 max-w-xl mx-auto">
            {WHY_BOOK_COPY.subheading}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {WHY_BOOK_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-neutral-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${feature.iconBg}`}>
                <feature.icon aria-hidden="true" className={`h-5 w-5 ${feature.iconColor}`} />
              </div>
              <h3 className="mt-4 font-display text-base font-bold text-neutral-800">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-neutral-500 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 p-8 text-center shadow-lg sm:p-12">
          <h3 className="font-display text-2xl font-bold text-white">
            {organizer.heading}
          </h3>
          <p className="mt-3 text-primary-100 max-w-lg mx-auto">
            {organizer.body}
          </p>
          <Link
            href={organizer.ctaHref}
            prefetch={false}
            className="mt-6 inline-block rounded-lg bg-white px-8 py-3 text-sm font-semibold text-primary-700 shadow-sm transition-all hover:bg-neutral-50"
          >
            {organizer.cta}
          </Link>
        </div>
      </div>
    </section>
  )
}
