import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-neutral-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="font-display text-xl font-bold text-primary-600">TravelApp</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h2 className="font-display text-5xl font-extrabold text-neutral-900">
          Group travel,{' '}
          <span className="text-primary-600">simplified</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-500">
          Discover curated group trips from verified organizers. Escrow-protected
          payments, real reviews, and hassle-free travel from Pune.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-xl bg-primary-600 px-8 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-primary-700 hover:shadow-lg"
          >
            Start exploring
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-neutral-200 bg-neutral-0 px-8 py-3 text-base font-semibold text-neutral-700 shadow-sm transition-all hover:bg-neutral-50"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { title: 'Verified Organizers', desc: 'Every organizer is verified. Real reviews from real travelers.' },
            { title: 'Escrow Payments', desc: 'Your money is safe. Released to organizer only after the trip.' },
            { title: 'Group Trips', desc: 'Trekking, beach getaways, road trips — all from Pune.' },
          ].map((feature) => (
            <div key={feature.title} className="rounded-xl bg-neutral-0 p-6 shadow-card">
              <h3 className="font-display text-lg font-bold text-neutral-800">{feature.title}</h3>
              <p className="mt-2 text-sm text-neutral-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
