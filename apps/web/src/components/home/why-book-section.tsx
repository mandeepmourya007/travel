import { Shield, Star, Users, CreditCard } from 'lucide-react'
import Link from 'next/link'

const FEATURES = [
  {
    icon: Shield,
    title: 'Escrow Payments',
    description: 'Your money is safely held until the trip is completed. No risk.',
    color: 'text-primary-600 bg-primary-50',
  },
  {
    icon: Star,
    title: 'Verified Reviews',
    description: 'Only travelers who completed the trip can leave reviews. No fakes.',
    color: 'text-warning-500 bg-warning-50',
  },
  {
    icon: Users,
    title: 'Compare Trips',
    description: 'Side-by-side comparison of organizers, prices, and inclusions.',
    color: 'text-highlight-600 bg-highlight-50',
  },
  {
    icon: CreditCard,
    title: 'Cancellation Protection',
    description: 'Flexible refund policies. Full refund if the organizer cancels.',
    color: 'text-accent-600 bg-accent-50',
  },
]

export function WhyBookSection() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl font-bold text-neutral-800">
            Why Book With Us
          </h2>
          <p className="mt-2 text-neutral-500">
            Travel with confidence. We've got your back.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-neutral-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${feature.color}`}>
                <feature.icon className="h-5 w-5" />
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

        {/* CTA for organizers */}
        <div className="mt-16 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 p-8 text-center shadow-lg sm:p-12">
          <h3 className="font-display text-2xl font-bold text-white">
            Are you a trip organizer?
          </h3>
          <p className="mt-3 text-primary-100 max-w-md mx-auto">
            List your trips, reach more travelers, and get paid securely via escrow.
          </p>
          <Link
            href="/signup?role=organizer"
            className="mt-6 inline-block rounded-lg bg-white px-8 py-3 text-sm font-semibold text-primary-700 shadow-sm transition-all hover:bg-neutral-50"
          >
            List Your Trips
          </Link>
        </div>
      </div>
    </section>
  )
}
