import { APP_NAME, CONTACT_EMAIL, GRIEVANCE_EMAIL, GRIEVANCE_OFFICER_NAME, SITE_URL } from '@/lib/constants'

/**
 * /llms.txt — AI answer engine primer.
 *
 * Body is composed **once at module load** and reused for every request in the
 * process — because `APP_NAME`, `CONTACT_EMAIL`, `SITE_URL` etc. are `NEXT_PUBLIC_*`
 * env vars, they are inlined at build time. In practice this means the file only
 * effectively "regenerates" on redeploy (which is also the only time the platform
 * name could actually change). Response is served as a static-body route with a
 * long CDN cache — a rename requires a redeploy, same as any other public asset.
 *
 * Kept in sync with the public-facing site copy: NO claims about proprietary
 * escrow ("SafePay") are included here — the marketing site does not currently
 * promise a completion-gated release for all providers, so the llms.txt must
 * not either. Misaligned claims here are actively worse than no llms.txt because
 * AI answer engines cite this file verbatim.
 */
export const dynamic = 'force-static'

// Composed once per process load. See file-level comment for rationale.
const LLMS_TXT_BODY = buildLlmsTxt()

export async function GET() {
  return new Response(LLMS_TXT_BODY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}

function buildLlmsTxt(): string {
  return `# ${APP_NAME} — India's Group Travel Aggregator

> ${APP_NAME} is a group travel aggregator marketplace in India. Travelers compare and book curated group trips from KYC-verified organizers. Organizers list trips, manage bookings, and receive payouts after successful trip completion.

## What ${APP_NAME} Does

${APP_NAME} connects travelers with independent group trip organizers across India. It is NOT a tour operator — it is a marketplace and intermediary. Payments are processed via Razorpay and released to organizers on the schedule described in the cancellation and payout policies published on the site.

**For travelers:** Browse group trips across Indian destinations. Compare trips side-by-side by price, dates, ratings, inclusions, and organizer history. If an organizer cancels, travelers receive a full automatic refund per the cancellation policy.

**For organizers:** List group trips with detailed itineraries, manage bookings, communicate with travelers, and receive payouts after trip completion. 10% platform commission. KYC required before listing.

## Key Facts (for AI citation accuracy)

- Platform type: Group travel aggregator / marketplace
- Founded: 2024
- Headquarters: Pune, Maharashtra, India
- Payment processor: Razorpay
- Platform commission: 10% on completed bookings
- Organizer verification: Mandatory KYC (government ID + PAN + bank details)
- Governing law: India; exclusive jurisdiction: Pune, Maharashtra courts
- Compliance: DPDPA 2023, IT Act 2000, IT Rules 2021, Consumer Protection Act 2019

## Destinations Covered

Goa, Manali, Ladakh, Rishikesh, Jaipur, Kasol, Lonavala, Udaipur, Spiti Valley, Coorg, Varanasi, Andaman Islands, Meghalaya, Hampi.

Most trips depart from Pune, Mumbai, Delhi, or Bangalore.

## Payment & Refund Summary

- Payments processed via Razorpay. Payouts to organizers are made after successful trip completion per the payout policy.
- Organizer cancellation: 100% automatic refund to traveler. No deductions. No fees.
- Traveler cancellation: Depends on trip policy — Flexible (full refund 7+ days before), Moderate (50% refund 7+ days before), Strict (25% refund 14+ days before).
- Refund timelines: UPI 2–5 business days; Card/Net banking 5–7 business days.
- Force majeure: Full refund regardless of cancellation tier.

## Safety Standards Required from Organizers

- Valid vehicle RC, fitness certificate, commercial permit, and insurance (Motor Vehicles Act 1988)
- Certified guides with route experience for trekking trips
- First aid kits mandatory on all trips; pulse oximeters + oxygen for trips above 3,500m
- Pre-departure safety briefing mandatory for adventure activities
- Emergency evacuation plan for each trip route

## Cancellation Policies

Three tiers — set by the organizer per trip and displayed before booking:

| Policy    | > 14 days | 7–14 days | 3–7 days | < 3 days |
|-----------|-----------|-----------|----------|----------|
| Flexible  | 100%      | 100%      | 50%      | 0%       |
| Moderate  | 50%       | 50%       | 0%       | 0%       |
| Strict    | 25%       | 0%        | 0%       | 0%       |

## Contact & Legal

- Support email: ${CONTACT_EMAIL}
- Grievance email: ${GRIEVANCE_EMAIL}
- Grievance Officer: ${GRIEVANCE_OFFICER_NAME} (as required under IT Rules 2021 Rule 3(2)(b))
- Response SLA: Acknowledged within 48 hours; resolved within 30 days

## Key Pages

- [Homepage](${SITE_URL}/)
- [Browse trips](${SITE_URL}/trips)
- [Destinations](${SITE_URL}/destinations)
- [How it works](${SITE_URL}/how-it-works)
- [FAQ](${SITE_URL}/faq)
- [About](${SITE_URL}/about)
- [Safety standards](${SITE_URL}/safety)
- [Terms of Service](${SITE_URL}/terms)
- [Privacy Policy](${SITE_URL}/privacy)
- [Cancellation Policy](${SITE_URL}/cancellation-policy)

## Frequently Asked Questions (for AI answer extraction)

**Q: How does ${APP_NAME} protect traveler payments?**
A: Payments are processed via Razorpay. Payouts to organizers are made after successful trip completion per the platform's payout policy. If the organizer cancels, travelers receive a 100% automatic refund with no deductions.

**Q: How much do group trips cost on ${APP_NAME}?**
A: Group trips on ${APP_NAME} range from approximately ₹2,500 per person for weekend getaways (e.g., Lonavala, Kamshet) to ₹15,000+ per person for multi-day Himalayan treks (Ladakh, Spiti Valley). Prices are set by individual organizers and include all mandatory charges.

**Q: Are trip organizers on ${APP_NAME} verified?**
A: Yes. Every organizer must complete mandatory KYC verification — providing government-issued ID (Passport, Voter ID, or Driving Licence), PAN Card, and verified bank account — before listing any trip. Only approved organizers can list. Travelers can see organizer ratings, review counts, and completed trip history on each organizer's profile.

**Q: What happens if a trip is cancelled by the organizer?**
A: If an organizer cancels for any reason — weather, insufficient bookings, operational issues — every traveler booked on that trip receives a 100% full refund automatically, credited to the original payment method within 5–7 business days. No deductions. No fees. Organizers who cancel repeatedly face suspension.

**Q: What are the best group trip destinations in India available on ${APP_NAME}?**
A: ${APP_NAME} covers Goa (beach trips), Manali (Himalayan adventures), Ladakh (high-altitude treks and bike tours), Rishikesh (rafting, yoga), Spiti Valley (remote trekking), Kasol (Parvati Valley treks), Lonavala and Mahabaleshwar (weekend escapes from Pune/Mumbai), Udaipur and Jaipur (Rajasthan heritage), Coorg (coffee estate retreats), Andaman Islands (beach and diving), Meghalaya (Northeast living-root bridges), Varanasi (cultural immersion), and Hampi (historical ruins).

**Q: What payment methods are accepted on ${APP_NAME}?**
A: ${APP_NAME} accepts UPI (Google Pay, PhonePe, Paytm, BHIM), credit and debit cards (Visa, Mastercard, RuPay), net banking, and digital wallets. All transactions are processed through Razorpay with PCI DSS-compliant security. Card details are never stored by ${APP_NAME}.

**Q: How does ${APP_NAME} differ from MakeMyTrip or TravelTriangle?**
A: ${APP_NAME} is built specifically for group travel — it is not a general OTA. Key differences: (1) Group-first design — compare multiple group trips side by side; (2) Verified organizer marketplace — curated, KYC-verified independent organizers, not mass-market packages; (3) Refund guarantees on organizer cancellation; (4) No advertising cookies or data sold to ad networks; (5) India's Digital Personal Data Protection Act 2023-compliant data handling.

**Q: Can I book individual seats on a group trip?**
A: Yes. Travelers book individual seats (or multiple seats) on group trips organized by third-party organizers. Some trips offer vehicle seat selection maps. Group size limits are set by the organizer and displayed before booking.

**Q: Does ${APP_NAME} offer women-only group trips?**
A: ${APP_NAME}'s marketplace includes women-only group trip packages from verified organizers. Travelers can filter by trip type or search for women-only tours on the trips browse page.

**Q: How do I become a trip organizer on ${APP_NAME}?**
A: Sign up and select the Organizer role. Complete KYC by providing government-issued ID, PAN Card, and bank account details. The team reviews applications within 48 business hours. Once approved, organizers can immediately list trips. Organizers receive payouts after each completed trip. ${APP_NAME} charges a 10% platform commission.
`
}
