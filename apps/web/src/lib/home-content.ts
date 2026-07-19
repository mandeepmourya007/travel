/**
 * Single source of truth for all home page copy and static data.
 *
 * To update any text on the home page, edit this file only.
 * Components import their data from here and are pure rendering shells.
 */

import {
  // Shield — unused while the SafePay-badge entries below are commented out; re-add if they're restored.
  Star,
  LayoutList,
  Search,
  CreditCard,
  Backpack,
  Users,
  MessageCircleOff,
  Armchair,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrustBadge {
  icon: LucideIcon
  label: string
}

export interface HowItWorksStep {
  step: string
  icon: LucideIcon
  title: string
  description: string
  iconColor: string
  iconBg: string
  iconBorder: string
  stepColor: string
}

export interface WhyBookFeature {
  icon: LucideIcon
  title: string
  description: string
  iconColor: string
  iconBg: string
}

// ─── Hero ────────────────────────────────────────────────────────────────────

export const HERO_COPY = {
  eyebrow: 'India’s group travel marketplace',
  headlinePart1: 'Stop trusting strangers on WhatsApp.',
  headlinePart2: 'Book group trips safely.',
  // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
  // Original: 'Find and compare curated group trips from verified organizers across India. Your payment is held safely via SafePay — the organizer gets paid only after the trip is done. No UPI to strangers. No WhatsApp chaos. No surprises.'
  subheadline:
    'Find and compare curated group trips from verified organizers across India. ' +
    'Pay securely with no UPI to strangers. No WhatsApp chaos. No surprises.',
} as const

export const HERO_TRUST_BADGES: TrustBadge[] = [
  // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
  // { icon: Shield,     label: 'Money held safely via SafePay until your trip is done' },
  { icon: Star,       label: 'Reviews only from travelers who actually went' },
  { icon: LayoutList, label: 'Compare up to 3 trips side-by-side' },
]

// ─── How it works ─────────────────────────────────────────────────────────────

export const HOW_IT_WORKS_COPY = {
  heading:    'How it works for travelers',
  // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
  // Original: 'From discovery to post-trip review — everything in one place, with your money protected the whole time.'
  subheading: 'From discovery to post-trip review — everything in one place, with secure payments throughout.',
  cta:        'Browse group trips',
  ctaHref:    '/trips',
} as const

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    step:        '01',
    icon:        Search,
    title:       'Find & compare trips',
    description: 'Browse group trips by destination, dates, or budget. Compare up to 3 trips side-by-side — itinerary, inclusions, organizer ratings, and price — before deciding.',
    iconColor:   'text-primary-600',
    iconBg:      'bg-primary-50',
    iconBorder:  'border-primary-100',
    stepColor:   'text-primary-500',
  },
  // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
  // {
  //   step:        '02',
  //   icon:        CreditCard,
  //   title:       'Book with your money protected',
  //   description: 'Pay securely via Razorpay (UPI, card, net banking). Your money is held safely via SafePay — the organizer only gets paid after the trip is done. Cancel anytime, refund goes straight to your wallet.',
  //   iconColor:   'text-highlight-600',
  //   iconBg:      'bg-highlight-50',
  //   iconBorder:  'border-highlight-100',
  //   stepColor:   'text-highlight-500',
  // },
  {
    step:        '03',
    icon:        Backpack,
    title:       'Travel. Then review.',
    description: 'Pick your seat on the bus, chat with the organizer on-platform, and show up. After the trip, leave an honest review so future travelers know exactly what to expect.',
    iconColor:   'text-accent-600',
    iconBg:      'bg-accent-50',
    iconBorder:  'border-accent-100',
    stepColor:   'text-accent-500',
  },
]

// ─── Why book ─────────────────────────────────────────────────────────────────

export const WHY_BOOK_COPY = {
  heading:    'Why travelers choose us over WhatsApp',
  subheading: "Sending ₹15,000 to a stranger's UPI and hoping for the best is not a booking process. We built something better.",
  organizer: {
    heading: 'Are you a trip organizer?',
    // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
    // Original: 'Stop managing bookings on WhatsApp. List your trips, get discovered by travelers beyond your Instagram, and get paid securely via SafePay.'
    body:    'Stop managing bookings on WhatsApp. List your trips, get discovered by travelers beyond your Instagram, and get paid securely.',
    cta:     "List your trips — it's free",
    ctaHref: '/signup?role=organizer',
  },
} as const

export const WHY_BOOK_FEATURES: WhyBookFeature[] = [
  // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
  // {
  //   icon:        Shield,
  //   title:       'SafePay-protected payments',
  //   description: 'You pay via Razorpay. Your money is held securely — the organizer gets it only after the trip is done. If the organizer cancels, you get a full refund instantly.',
  //   iconColor:   'text-primary-600',
  //   iconBg:      'bg-primary-50',
  // },
  {
    icon:        Star,
    title:       'Reviews you can actually trust',
    description: 'Only travelers who completed a booking can leave a review. No fake ratings, no planted testimonials — just honest feedback from people who were on the trip.',
    iconColor:   'text-warning-500',
    iconBg:      'bg-warning-50',
  },
  {
    icon:        Users,
    title:       'Compare before you commit',
    description: 'Pick up to 3 trips and compare them side-by-side — price, itinerary, inclusions, organizer rating, and group size. Make an informed choice, not a hopeful one.',
    iconColor:   'text-highlight-600',
    iconBg:      'bg-highlight-50',
  },
  {
    icon:        CreditCard,
    title:       'Cancellation policy is clear upfront',
    description: 'Every trip shows its cancellation policy (flexible, moderate, or strict) before you pay. No hidden rules. Cancel within the policy window, refund goes to your wallet.',
    iconColor:   'text-accent-600',
    iconBg:      'bg-accent-50',
  },
  {
    icon:        MessageCircleOff,
    title:       'No off-platform pressure',
    description: 'Our chat filter blocks phone numbers, UPI IDs, and payment links in conversations. Organizers cannot push you to pay outside the platform — your protection stays on.',
    iconColor:   'text-error-600',
    iconBg:      'bg-error-50',
  },
  {
    icon:        Armchair,
    title:       'Pick your seat on the bus',
    description: 'See the actual seat layout of your vehicle and choose your spot at booking. No first-come-first-served chaos at the pickup point.',
    iconColor:   'text-success-600',
    iconBg:      'bg-success-50',
  },
]
