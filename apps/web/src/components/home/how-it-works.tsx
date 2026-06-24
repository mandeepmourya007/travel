import Link from 'next/link'
import { HOW_IT_WORKS_COPY, HOW_IT_WORKS_STEPS } from '@/lib/home-content'

export function HowItWorks() {
  return (
    <section className="py-16 bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl font-bold text-neutral-800 sm:text-3xl">
            {HOW_IT_WORKS_COPY.heading}
          </h2>
          <p className="mt-3 text-neutral-500 max-w-xl mx-auto">
            {HOW_IT_WORKS_COPY.subheading}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map(({ step, icon: Icon, title, description, iconColor, iconBg, iconBorder, stepColor }) => (
            <div key={step} className="relative rounded-2xl border bg-white p-6 shadow-sm">
              <span aria-hidden="true" className={`font-mono text-4xl font-extrabold ${stepColor} select-none`}>
                {step}
              </span>
              <div className={`mt-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border ${iconBg} ${iconBorder}`}>
                <Icon aria-hidden="true" className={`h-5 w-5 ${iconColor}`} />
              </div>
              <h3 className="mt-4 font-display text-base font-bold text-neutral-800">
                {title}
              </h3>
              <p className="mt-2 text-sm text-neutral-500 leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href={HOW_IT_WORKS_COPY.ctaHref}
            prefetch={false}
            className="btn-primary inline-block rounded-xl px-8 py-3.5 text-sm font-semibold shadow-md"
          >
            {HOW_IT_WORKS_COPY.cta}
          </Link>
        </div>
      </div>
    </section>
  )
}
