import Link from 'next/link'
import { APP_NAME } from '@/lib/constants'

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white pb-20 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <span className="font-display text-lg font-bold text-primary-600">{APP_NAME}</span>
            {/*
              Commented out — restore if SafePay escrow-hold-until-trip-done is accurately
              implemented for all payment providers.
              Original: "Compare group trips, book safely with SafePay, and travel with confidence across India."
            */}
            <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
              Compare group trips, book securely, and travel with confidence across India.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-sm font-semibold text-neutral-800 mb-3">Explore</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/trips" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  All Trips
                </Link>
              </li>
              <li>
                <Link href="/destinations" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Destinations
                </Link>
              </li>
              <li>
                <Link href="/trips?tripType=ADVENTURE" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Adventure
                </Link>
              </li>
              <li>
                <Link href="/trips?tripType=WEEKEND" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Weekend Getaways
                </Link>
              </li>
              <li>
                <Link href="/trips?tripType=TREKKING" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Trekking
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-neutral-800 mb-3">Company</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/about" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/faq" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/rules" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Rules &amp; Guidelines
                </Link>
              </li>
              <li>
                <Link href="/safety" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Safety Standards
                </Link>
              </li>
              <li>
                <Link href="/contact" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-neutral-800 mb-3">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/terms" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/cancellation-policy" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Cancellation &amp; Refunds
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Disclaimer
                </Link>
              </li>
              <li>
                <Link href="/cookies" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link href="/legal" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  All Legal Docs →
                </Link>
              </li>
            </ul>
          </div>

          {/* Organizers */}
          <div>
            <h4 className="text-sm font-semibold text-neutral-800 mb-3">For Organizers</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/signup?role=organizer" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  List Your Trips
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/organizer-agreement" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Organizer Agreement
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-neutral-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-400">
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <p className="text-xs text-neutral-400">
            Made with care in India
          </p>
        </div>
      </div>
    </footer>
  )
}
