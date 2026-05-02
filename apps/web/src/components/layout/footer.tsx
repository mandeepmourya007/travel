import Link from 'next/link'
import { APP_NAME } from '@/lib/constants'

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <span className="font-display text-lg font-bold text-primary-600">{APP_NAME}</span>
            <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
              Compare group trips, book safely with escrow, and travel with confidence from Pune.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-sm font-semibold text-neutral-800 mb-3">Explore</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/trips" className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  All Trips
                </Link>
              </li>
              <li>
                <Link href="/trips?tripType=ADVENTURE" className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Adventure
                </Link>
              </li>
              <li>
                <Link href="/trips?tripType=WEEKEND" className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Weekend Getaways
                </Link>
              </li>
              <li>
                <Link href="/trips?tripType=TREKKING" className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
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
                <Link href="/about" className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Organizers */}
          <div>
            <h4 className="text-sm font-semibold text-neutral-800 mb-3">For Organizers</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/signup?role=organizer" className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  List Your Trips
                </Link>
              </li>
              <li>
                <Link href="/organizer/how-it-works" className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
                  How It Works
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
            Made with care in Pune
          </p>
        </div>
      </div>
    </footer>
  )
}
