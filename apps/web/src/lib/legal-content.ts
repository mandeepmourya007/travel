/**
 * Single source of truth for all legal/policy page copy.
 *
 * To update any text across the platform, edit this file only.
 * Pages import their data from here and are pure rendering shells.
 *
 * Uses constants from ./constants so emails, names, and URLs stay DRY.
 */

import {
  APP_NAME,
  CONTACT_EMAIL,
  GRIEVANCE_EMAIL,
  COMPANY_ADDRESS,
  GRIEVANCE_OFFICER_NAME,
} from './constants'

// ─── Shared types ────────────────────────────────────────────────────────────

export interface LegalSection {
  id: string
  title: string
  content: string
  link?: { href: string; label: string }
}

export interface FaqItem {
  question: string
  answer: string
  link?: { href: string; label: string }
}

// ─── Last-updated dates (update independently per document) ──────────────────

export const LAST_UPDATED = {
  terms:               'June 24, 2026',
  privacy:             'June 24, 2026',
  cancellation:        'June 24, 2026',
  rules:               'June 24, 2026',
  disclaimer:          'June 24, 2026',
  organizerAgreement:  'June 24, 2026',
  cookies:             'June 24, 2026',
  contact:             'June 24, 2026',
  safety:              'June 24, 2026',
  lostItem:            'June 24, 2026',
  legal:               'June 24, 2026',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// TERMS OF SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export const termsSections: LegalSection[] = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: `By accessing or using the ${APP_NAME} platform (website, mobile web, or any associated application), you confirm that you have read, understood, and agree to be bound by these Terms of Service ("Terms"), our Privacy Policy, and our Cancellation & Refund Policy. If you do not agree, you must immediately stop using the platform.

These Terms constitute a legally binding agreement between you ("User", "Traveler", or "Organizer") and ${APP_NAME} ("Company", "we", "us", or "our"). We reserve the right to update these Terms at any time, subject to the notice requirements described in Section 14. Continued use of the platform after the effective date of any update constitutes your acceptance of the revised Terms.`,
    link: { href: '/privacy', label: 'Read our Privacy Policy →' },
  },
  {
    id: 'eligibility',
    title: '2. Eligibility',
    content: `To use ${APP_NAME}, you must:

• Be at least 18 years of age. Minors may travel only if accompanied by a parent or legal guardian who has completed the booking.
• Be a resident of India or accessing the platform from India.
• Have the legal capacity to enter into a binding contract under the Indian Contract Act, 1872.
• Not be barred from using our services under applicable Indian law.

By registering an account, you confirm that all information you provide is accurate, current, and complete.`,
  },
  {
    id: 'platform-role',
    title: '3. Nature of the Platform — Intermediary Role',
    content: `${APP_NAME} is an online travel aggregator and marketplace. We act as an intermediary between independent trip organizers and travelers. We are not a travel agent, tour operator, or trip organizer ourselves.

Important: ${APP_NAME} does not own, operate, manage, or conduct any of the trips listed on the platform. Trip organizers are independent third-party service providers who are solely responsible for planning, executing, and delivering their trips. ${APP_NAME} is an intermediary as defined under the Information Technology Act, 2000 and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.

While we verify organizers and hold payments in escrow for your protection, we are not a party to the contract between you and the trip organizer. You transact with organizers at your own risk, subject to the protections we provide.`,
  },
  {
    id: 'accounts',
    title: '4. User Accounts',
    content: `You must create an account to book trips or list trips on ${APP_NAME}. You agree to:

• Provide accurate, truthful, and complete registration information including your name, phone number, and email address.
• Keep your account credentials confidential and not share them with any third party.
• Immediately notify us at ${CONTACT_EMAIL} if you suspect unauthorized access to your account.
• Accept full responsibility for all activity occurring under your account.

We reserve the right to suspend or terminate accounts that violate these Terms, provide false information, or engage in fraudulent activity. One person may maintain only one active account.`,
  },
  {
    id: 'bookings',
    title: '5. Bookings and Payments',
    content: `5.1 Booking Process
Trips listed on ${APP_NAME} are either "Instant Booking" (seat confirmed upon payment) or "Request-Based" (organizer reviews and approves your request before payment). The specific booking type is displayed on each trip's listing page.

5.2 Pricing and Taxes
All prices displayed are in Indian Rupees (₹). Prices are set by trip organizers and may be inclusive or exclusive of applicable taxes (GST). Any additional taxes or charges will be clearly disclosed before payment.

5.3 Escrow Payment Protection
Your payment is held in a secure escrow account managed through our payment partner, Razorpay. Funds are NOT released to the organizer until the trip is completed. This protects you in the event of trip cancellation or non-delivery of promised services.

5.4 Payment Methods
We accept payments via UPI (Google Pay, PhonePe, Paytm, BHIM), credit and debit cards (Visa, Mastercard, RuPay), net banking, and digital wallets. All payment processing is handled by Razorpay, which complies with PCI DSS security standards.

5.5 Booking Confirmation
A booking is confirmed only after successful payment and issuance of a booking confirmation. The confirmation will be sent to your registered email and phone number.

5.6 Early Bird Pricing
Certain trips offer discounted early bird pricing valid until a specified date. ${APP_NAME} is not responsible for price changes after the early bird deadline has passed.`,
  },
  {
    id: 'traveler',
    title: '6. Traveler Responsibilities',
    content: `As a traveler on ${APP_NAME}, you agree to:

• Provide accurate personal information including correct name, age, gender, and emergency contact details when booking. Incorrect information may result in denial of participation without a refund.
• Carry valid government-issued photo ID (Aadhaar, Passport, Voter ID, or Driving Licence) on the trip. Organizers are entitled to verify your identity.
• Be physically fit and medically capable of undertaking the booked trip. For adventure activities (trekking, rafting, etc.), you are responsible for assessing your own fitness and health.
• Inform the organizer of any medical conditions, allergies, or dietary requirements at the time of booking.
• Comply with all local laws, rules, regulations, and customs at the destination.
• Respect fellow travelers, local communities, and the environment.
• Carry adequate personal travel insurance. ${APP_NAME} strongly recommends purchasing travel insurance that covers medical emergencies, trip cancellation, and personal accident.
• Acknowledge the inherent risks of group travel and adventure activities as described in our Disclaimer (available at /disclaimer), which is incorporated into these Terms by reference. This acknowledgement does not waive your statutory rights as a consumer under the Consumer Protection Act, 2019.`,
  },
  {
    id: 'organizer',
    title: '7. Organizer Responsibilities',
    content: `Trip organizers listed on ${APP_NAME} are independent service providers. By listing trips, organizers agree to:

• Complete the KYC (Know Your Customer) verification process and provide accurate business and identity documents.
• List trips with accurate, honest, and complete information including itinerary, inclusions, exclusions, pick-up points, group size limits, and pricing.
• Not accept more bookings than the stated maximum group size.
• Deliver the trip as described or provide prompt advance notice (at least 48 hours) if the trip must be modified or cancelled.
• Arrange for the safety and well-being of all travelers during the trip, including appropriate safety equipment for adventure activities.
• Maintain adequate third-party liability coverage for all trips conducted.
• Respond to traveler inquiries and messages within 24 hours.
• Comply with all applicable Indian laws including the Tourism Act, Motor Vehicles Act, and Environmental Protection Act.
• Not misuse traveler personal information for any purpose other than trip management.`,
  },
  {
    id: 'cancellation',
    title: '8. Cancellations and Refunds',
    content: `Detailed cancellation and refund terms are governed by our Cancellation & Refund Policy, which is incorporated into these Terms by reference. In summary:

• Organizer Cancellations: If an organizer cancels a trip for any reason, all travelers receive a full refund from escrow within 5–7 business days.
• Traveler Cancellations: Refund eligibility depends on the cancellation policy chosen by the organizer at the time of listing — Flexible, Moderate, or Strict. The applicable policy is prominently displayed on each trip's booking page before payment.
• Platform-Initiated Cancellations: If ${APP_NAME} cancels a booking due to fraud, policy violations, or organizer misconduct, a full refund will be issued to the traveler.

All refunds are processed to the original payment method via Razorpay.`,
    link: { href: '/cancellation-policy', label: 'Read the full Cancellation & Refund Policy →' },
  },
  {
    id: 'prohibited',
    title: '9. Prohibited Activities',
    content: `You agree not to use ${APP_NAME} for any of the following:

• Providing false, misleading, or fraudulent information.
• Listing trips that you are not authorised or licensed to operate.
• Engaging in any activity that violates applicable Indian law.
• Attempting to circumvent the escrow system or make off-platform payments to bypass our fees.
• Harassing, threatening, or abusing other users or ${APP_NAME} staff.
• Scraping, crawling, or data mining the platform.
• Attempting to gain unauthorised access to our systems, databases, or user accounts.
• Posting content that is defamatory, obscene, pornographic, or offensive.
• Using the platform for any commercial purpose not expressly authorised by ${APP_NAME}.
• Posting fake or incentivised reviews.

Violation of these prohibitions may result in immediate account suspension, termination, and/or legal action.`,
  },
  {
    id: 'intellectual-property',
    title: '10. Intellectual Property',
    content: `All content on ${APP_NAME}, including but not limited to our name, logo, design, text, graphics, and software, is the property of the Company and is protected under applicable Indian intellectual property laws.

Organizers grant ${APP_NAME} a non-exclusive, royalty-free, worldwide licence to use, display, and reproduce the trip content (descriptions, images, itineraries) they upload, for the purposes of operating and promoting the platform.

You may not reproduce, distribute, modify, or create derivative works of ${APP_NAME}'s content without our prior written consent.`,
  },
  {
    id: 'disclaimer',
    title: '11. Disclaimer of Warranties',
    content: `THE PLATFORM AND ALL CONTENT, SERVICES, AND INFORMATION PROVIDED ON IT ARE OFFERED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT ANY WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.

${APP_NAME} SPECIFICALLY DISCLAIMS:

• Any warranty that the platform will be uninterrupted, error-free, or free of viruses.
• Any warranty regarding the accuracy, completeness, or reliability of trip descriptions, photos, pricing, or organizer information provided by third-party organizers.
• Any warranty regarding the fitness, safety, or suitability of any trip for your specific needs or health condition.
• Any responsibility for the acts or omissions of trip organizers during or before a trip.
• Any responsibility for loss or theft of personal belongings during a trip.
• Any responsibility for delays, accidents, natural disasters, government actions, or force majeure events affecting a trip.

Nothing in this disclaimer limits your statutory rights as a consumer under the Consumer Protection Act, 2019.`,
    link: { href: '/disclaimer', label: 'Read our full standalone Disclaimer →' },
  },
  {
    id: 'liability',
    title: '12. Limitation of Liability',
    content: `To the fullest extent permitted by applicable Indian law, ${APP_NAME}'s aggregate liability to any user for any claim arising out of or related to these Terms or use of the platform shall not exceed the total amount paid by you for the specific booking giving rise to the claim.

${APP_NAME} shall not be liable for any indirect, incidental, special, consequential, or punitive damages including loss of profit, loss of data, loss of goodwill, or personal injury arising from:
• Your use of or inability to use the platform.
• Any trip conducted by a third-party organizer.
• Any medical emergency or accident during a trip.
• Any failure of Razorpay or other third-party payment systems.

This limitation shall not apply to damages arising from ${APP_NAME}'s gross negligence or wilful misconduct.`,
  },
  {
    id: 'governing-law',
    title: '13. Governing Law and Dispute Resolution',
    content: `These Terms are governed by and construed in accordance with the laws of India, including the Consumer Protection Act, 2019, the Consumer Protection (E-Commerce) Rules, 2020, the Information Technology Act, 2000, and the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the competent courts in Pune, Maharashtra.

Grievance Redressal — as mandated under IT Rules 2021 Rule 3(2)(b) and Consumer Protection (E-Commerce) Rules 2020:

Name: ${GRIEVANCE_OFFICER_NAME}
Designation: Grievance Officer, ${APP_NAME}
Email: ${GRIEVANCE_EMAIL}
Address: ${COMPANY_ADDRESS}
Response Time: Acknowledged within 48 hours; resolved within 30 days as required by law.

We encourage users to first attempt to resolve disputes through our in-platform support before escalating to legal proceedings. Users may also approach the National Consumer Helpline at 1800-11-4000 (toll-free) or file a complaint at consumerhelpline.gov.in.`,
  },
  {
    id: 'changes',
    title: '14. Changes to These Terms',
    content: `We may revise these Terms at any time. When we make material changes, we will notify you via email or a prominent notice on the platform at least 7 days before the changes take effect. Your continued use of the platform after the effective date constitutes acceptance of the revised Terms.

If you disagree with the revised Terms, you must stop using the platform and may request account deletion by emailing ${CONTACT_EMAIL}.`,
  },
  {
    id: 'severability',
    title: '15. Severability, Waiver, and Entire Agreement',
    content: `If any provision of these Terms is found by a competent court to be invalid, illegal, or unenforceable, that provision shall be modified to the minimum extent necessary to make it enforceable, or severed if modification is not possible. The remaining provisions shall continue in full force and effect.

No waiver by ${APP_NAME} of any breach of these Terms shall be treated as a waiver of any subsequent breach of the same or any other provision.

These Terms, together with our Privacy Policy, Cancellation & Refund Policy, Disclaimer, and (for organizers) the Organizer Agreement, constitute the entire agreement between you and ${APP_NAME} with respect to your use of the platform and supersede all prior agreements and understandings.`,
  },
  {
    id: 'contact',
    title: '16. Contact Us',
    content: `For any questions, concerns, or feedback about these Terms, please contact:

Email: ${CONTACT_EMAIL}
Address: ${COMPANY_ADDRESS}

For booking-specific support, use the in-app support chat or email us with your booking reference number.`,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY POLICY
// ─────────────────────────────────────────────────────────────────────────────

export const privacySections: LegalSection[] = [
  {
    id: 'intro',
    title: '1. Introduction',
    content: `${APP_NAME} ("we", "us", or "our") is committed to protecting your privacy and handling your personal data responsibly. This Privacy Policy explains what personal data we collect, how we use it, with whom we share it, and how you can exercise your rights.

This Policy applies to all users of the ${APP_NAME} platform — whether you are a traveler, trip organizer, or visitor. It is compliant with the Digital Personal Data Protection Act, 2023 (DPDPA) and other applicable Indian data protection laws including the Information Technology Act, 2000 and the IT (Amendment) Act, 2008.

Under the DPDPA 2023, your consent to process personal data is obtained through a clear affirmative action — specifically, a consent checkbox presented at account registration, before any personal data is collected. You will not be required to consent as a condition of merely browsing the platform. You may withdraw consent at any time as described in Section 7 of this Policy.`,
  },
  {
    id: 'data-collected',
    title: '2. Personal Data We Collect',
    content: `We collect the following categories of personal data:

2.1 Account Information
• Name, email address, and mobile number (used for login and communications)
• Profile photo (if provided)
• Role on the platform (Traveler or Organizer)

2.2 Booking Information
• Traveler details: name, age, gender, phone number
• Emergency contact: name and phone number
• Pickup and drop point preferences
• Trip history and past bookings

2.3 Organizer Information (KYC)
• Business name and registered address
• PAN Card and GSTIN number (where applicable)
• Government-issued photo ID — any one of: Passport, Voter ID, or Driving Licence. Aadhaar is accepted as a voluntary alternative only; it is not mandatory, in compliance with the Aadhaar Act, 2016 and the Supreme Court's judgment in Justice K.S. Puttaswamy v. Union of India (2018).
• Bank account details (for payout processing)
• ID verification documents

2.4 Payment Information
• Transaction amount and reference IDs
• Payment method type (UPI/card/netbanking)
• We do NOT store full card numbers, CVV, or UPI PINs — these are handled directly by Razorpay

2.5 Usage Data
• Device type, browser, and IP address
• Pages visited and interactions with the platform
• Search queries and trip comparison history

2.6 Communications
• Messages exchanged between travelers and organizers through our platform
• Support chat history
• Feedback and reviews you submit`,
  },
  {
    id: 'how-we-use',
    title: '3. How We Use Your Data',
    content: `We use your personal data for the following purposes:

• Account creation and authentication
• Processing bookings and managing escrow payments via Razorpay
• Sending booking confirmations, trip reminders, and OTP verification messages via SMS and email
• Facilitating communication between travelers and organizers
• Verifying organizer identity (KYC) and publishing organizer profiles
• Displaying your reviews and ratings on the platform
• Improving platform features and user experience through aggregated analytics
• Preventing fraud, resolving disputes, and enforcing our Terms of Service
• Complying with legal obligations, court orders, or government requests under Indian law
• Sending marketing communications (only with your consent — you may opt out at any time)

We process your data on the following lawful bases under the DPDPA, 2023:
• Consent (Section 6): Where you have provided explicit, informed consent via affirmative action at registration or for specific processing activities such as marketing communications.
• Certain Legitimate Uses (Section 7): Where processing is necessary for the performance of a contract you are party to (booking a trip, organizer payout processing), for compliance with a legal obligation, or for functions of the State or a court order.
We do not rely on "legitimate interest" as a standalone basis — that concept applies under GDPR (EU law), not under the DPDPA, 2023.`,
  },
  {
    id: 'sharing',
    title: '4. Sharing of Personal Data',
    content: `We do not sell your personal data to third parties. We share your data only in the following limited circumstances:

4.1 With Trip Organizers
When you book a trip, the organizer receives your name, phone number, age, gender, and emergency contact details — only to the extent necessary to manage your participation in their trip.

4.2 With Razorpay
Payment-related data (transaction amounts, mobile number for UPI) is shared with Razorpay Payments Private Limited for processing and reconciliation. Razorpay processes your payment data under its own privacy policy in compliance with RBI guidelines.

4.3 With SMS and Email Service Providers
Your phone number and email address are shared with our OTP and notification service providers solely for delivering communications.

4.4 Legal Requirements
We may disclose your data to law enforcement agencies, courts, or government authorities where required by applicable Indian law, court order, or regulatory mandate.

4.5 Business Transfers
In the event of a merger, acquisition, or asset sale, your data may be transferred to the successor entity, subject to equivalent privacy protections.

We do not share your data with any third party for advertising or marketing purposes without your explicit consent.`,
  },
  {
    id: 'retention',
    title: '5. Data Retention',
    content: `We retain your personal data for as long as your account is active or as needed to provide services. Specifically:

• Account data: Retained for the duration of your account and for 3 years after account closure.
• Booking and transaction records: Retained for 7 years as required under Indian financial and tax laws.
• KYC documents (organizers): Retained for the duration of organizer status and 5 years after.
• Support communications: Retained for 2 years.
• Marketing preferences: Until you withdraw consent.

You may request deletion of your account and associated data by emailing ${CONTACT_EMAIL}. Some data may be retained longer if required by law or to resolve ongoing disputes.`,
  },
  {
    id: 'cookies',
    title: '6. Cookies and Tracking',
    content: `We use cookies and similar technologies to:

• Keep you logged in securely
• Remember your trip comparison selections and search preferences
• Measure platform performance and identify issues
• Understand how users navigate the platform (aggregated analytics only)

Types of cookies we use:
• Essential cookies: Required for the platform to function (login sessions, booking form data, comparison queue)
• Preference cookies: Remember your display settings across visits (list/grid view, sort order)
• Analytics cookies: Help us understand usage patterns — anonymised and aggregated, no PII collected
• Third-party cookies (Razorpay): Set during the payment flow only, governed by Razorpay's privacy policy

We do not use advertising cookies, tracking pixels, or sell data to ad networks. You can manage all non-essential cookies through your browser settings without affecting your ability to book trips.`,
    link: { href: '/cookies', label: 'Read our full Cookie Policy →' },
  },
  {
    id: 'user-rights',
    title: '7. Your Rights Under DPDPA, 2023',
    content: `Under the Digital Personal Data Protection Act, 2023, you have the following rights as a Data Principal:

• Right to Access: Request a summary of the personal data we hold about you.
• Right to Correction: Request correction of inaccurate or incomplete personal data.
• Right to Erasure: Request deletion of your personal data, subject to legal retention requirements.
• Right to Grievance Redressal: File a complaint with our Grievance Officer (see Section 9).
• Right to Nominate: Nominate an individual to exercise these rights on your behalf in the event of your death or incapacity.
• Right to Withdraw Consent: Withdraw your consent to data processing at any time (withdrawal will not affect the lawfulness of processing before withdrawal).

To exercise any of these rights, email us at ${CONTACT_EMAIL} with the subject line "Data Rights Request". We will respond within 30 days.`,
  },
  {
    id: 'security',
    title: '8. Data Security',
    content: `We implement appropriate technical and organisational security measures to protect your personal data, including:

• HTTPS encryption for all data in transit
• Password hashing and secure session management
• Access controls limiting employee access to personal data
• Regular security audits and vulnerability assessments
• Razorpay's PCI DSS-compliant payment infrastructure for all financial data

Despite these measures, no internet transmission is 100% secure. In the event of a data breach that poses a risk to your rights, we will notify you and the relevant authorities as required under Indian law, within the prescribed timelines.`,
  },
  {
    id: 'grievance',
    title: '9. Grievance Officer',
    content: `As required under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 (Rule 3(2)(b)) and the DPDPA, 2023, we have appointed a Grievance Officer:

Name: ${GRIEVANCE_OFFICER_NAME}
Designation: Grievance Officer, ${APP_NAME}
Email: ${GRIEVANCE_EMAIL}
Address: ${COMPANY_ADDRESS}
Response Time: Acknowledged within 48 hours; resolved within 30 days as required by applicable law.

If you are not satisfied with the resolution provided by our Grievance Officer, you may escalate your complaint to the Data Protection Board of India under the DPDPA, 2023.`,
  },
  {
    id: 'children',
    title: "10. Children's Privacy",
    content: `${APP_NAME} is not intended for use by persons under 18 years of age. We do not knowingly collect personal data from minors. If you believe a minor has provided us with personal data without parental consent, please contact us at ${CONTACT_EMAIL} and we will delete such data promptly.`,
  },
  {
    id: 'data-transfer',
    title: '11. Cross-Border Data Transfers',
    content: `${APP_NAME} primarily stores and processes your personal data in India. However, some of our third-party service providers and infrastructure partners may process data on servers located outside India. These include:

• Vercel (hosting and analytics) — servers in the United States and European Union
• Cloudinary (image hosting) — global CDN infrastructure
• Email and SMS delivery services — may route data internationally

Under the DPDPA, 2023, cross-border transfers of personal data are permitted to countries or territories notified by the Central Government. We ensure that any cross-border transfer is made only where such permission exists and is subject to equivalent data protection safeguards.

We do not transfer your financial data, KYC documents, or payment information internationally — these remain within Razorpay's India-based infrastructure, which is regulated by the Reserve Bank of India.`,
  },
  {
    id: 'changes',
    title: '12. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. We will notify you of material changes via email or a prominent notice on the platform at least 7 days before they take effect. The "Last Updated" date at the top of this page reflects the most recent revision.

Continued use of the platform after the updated Policy takes effect constitutes your acceptance.`,
  },
  {
    id: 'contact',
    title: '13. Contact Us',
    content: `For privacy-related queries, requests, or complaints:

Email: ${CONTACT_EMAIL}
Grievance Email: ${GRIEVANCE_EMAIL}
Address: ${COMPANY_ADDRESS}`,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// CANCELLATION & REFUND POLICY
// ─────────────────────────────────────────────────────────────────────────────

export interface CancellationTierRule {
  timing: string
  refund: string
}

export interface CancellationTier {
  id: string
  label: string
  /** One of: 'green' | 'yellow' | 'red' — component maps to Tailwind classes */
  color: 'green' | 'yellow' | 'red'
  rules: CancellationTierRule[]
}

export const cancellationTiers: CancellationTier[] = [
  {
    id: 'flexible',
    label: 'Flexible',
    color: 'green',
    rules: [
      { timing: 'More than 7 days before trip start', refund: 'Full refund (100%)' },
      { timing: 'Between 3 and 7 days before trip start', refund: '50% refund' },
      { timing: 'Less than 3 days before trip start', refund: 'No refund' },
    ],
  },
  {
    id: 'moderate',
    label: 'Moderate',
    color: 'yellow',
    rules: [
      { timing: 'More than 7 days before trip start', refund: '50% refund' },
      { timing: 'Less than 7 days before trip start', refund: 'No refund' },
    ],
  },
  {
    id: 'strict',
    label: 'Strict',
    color: 'red',
    rules: [
      { timing: 'More than 14 days before trip start', refund: '25% refund' },
      { timing: 'Less than 14 days before trip start', refund: 'No refund' },
    ],
  },
]

export const cancellationTimezoneNote =
  'All cut-off times are calculated from the trip\'s departure date at 00:00 IST.'

export const organizerCancellationText = {
  heading: 'Full Refund — Always',
  body: `If the organizer cancels a trip for any reason — weather, insufficient bookings, operational issues, or any other cause — every traveler booked on that trip receives a 100% refund from escrow. No deductions. No processing fees.`,
  escrowCallout: `A full refund is initiated automatically — credited to your original payment method within 5–7 business days, with no deductions or processing fees.`,
  penaltyNote: `Organizers who cancel trips may be subject to penalties including temporary suspension from the platform and negative impact on their organizer rating.`,
}

export const platformCancellationReasons = [
  'Fraudulent or suspicious payment activity detected',
  'Organizer fails KYC verification or provides false documents',
  'Trip listing is found to violate our policies or applicable law',
  'Credible safety concerns that cannot be resolved with the organizer',
]

export const howToCancelSteps = [
  'Go to My Bookings from your account menu.',
  'Select the booking you wish to cancel.',
  'Click "Cancel Booking" and confirm your reason.',
  'The refund amount (based on the trip\'s cancellation policy) will be displayed before you confirm.',
  'Once confirmed, the refund is initiated and will reflect in your original payment account within 5–7 business days.',
]

export interface RefundTimelineRow {
  method: string
  timeline: string
}

export const refundTimelines: RefundTimelineRow[] = [
  { method: 'UPI (GPay, PhonePe, Paytm)', timeline: '2–5 business days' },
  { method: 'Credit / Debit Card', timeline: '5–7 business days' },
  { method: 'Net Banking', timeline: '5–7 business days' },
  { method: 'Digital Wallets', timeline: '1–3 business days' },
]

export const refundTimelineNote =
  'Timelines are from the date the refund is initiated by us. Actual credit depends on your bank. All refunds are processed via Razorpay.'

export const nonRefundableReasons = [
  'You voluntarily leave the trip after it has commenced',
  'You are denied participation due to failure to carry valid ID',
  `You are removed from a trip due to misconduct or violation of the organizer's rules, as determined by the organizer and upheld after review by ${APP_NAME} support (you may request a review within 48 hours by emailing ${CONTACT_EMAIL})`,
  'You provided incorrect information (age, medical condition, ID details) that affects eligibility',
  'You miss the trip departure without prior notification',
  'Cancellation is initiated after the "No Refund" window under the applicable policy',
]

export const partialCancellationText = `If you booked seats for multiple travelers and wish to cancel only some of them, you may do so through the My Bookings section. The refund for cancelled seats will be calculated based on the trip's cancellation policy and the applicable time window at the time of cancellation. Remaining seats in your booking are not affected.`

export const forceMajeureText = {
  main: `In the event a trip cannot proceed due to circumstances beyond the organizer's control — including but not limited to natural disasters, floods, extreme weather, government-imposed restrictions, civil unrest, or road closures — the organizer must notify all booked travelers immediately. In such cases, travelers will receive a full refund from escrow, regardless of the trip's stated cancellation policy.`,
  liability: `${APP_NAME} is not liable for any additional costs (travel to the departure point, accommodation already booked, etc.) incurred by travelers in force majeure situations.`,
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY RULES & GUIDELINES
// ─────────────────────────────────────────────────────────────────────────────

export interface RuleGroup {
  id: string
  title: string
  items: string[]
}

export const travelerRuleGroups: RuleGroup[] = [
  {
    id: 'traveler-eligibility',
    title: 'Age & Eligibility',
    items: [
      'You must be at least 18 years old to book a trip independently. Minors (under 18) may travel only when accompanied by a parent or legal guardian who books and attends the trip.',
      'For adventure trips (high-altitude trekking, white-water rafting, rock climbing), you must be physically fit and free from conditions that could put you or others at risk. Check the trip\'s specific age and fitness requirements before booking.',
      'Some destinations require Indian citizenship or a valid Inner Line Permit (ILP). Ensure you hold the required permits before booking trips to restricted areas such as Ladakh\'s Nubra Valley, Spiti, or Northeast India.',
    ],
  },
  {
    id: 'traveler-documents',
    title: 'Documents to Carry',
    items: [
      'Carry at least one valid government-issued photo ID at all times: Aadhaar Card, Passport, Voter ID, or Driving Licence.',
      'For trips to Jammu & Kashmir, Ladakh, and Northeast India, carry multiple copies of your ID and the relevant ILP or Restricted Area Permit (RAP).',
      'Foreign nationals must carry their Passport and valid Indian Visa.',
      'The organizer is entitled to verify your ID before the trip begins. Failure to produce valid ID may result in denial of participation without a refund.',
    ],
  },
  {
    id: 'traveler-conduct',
    title: 'Conduct During the Trip',
    items: [
      'Treat your fellow travelers, trip organizer, guides, and local communities with respect. Harassment, discrimination, or intimidation of any kind will not be tolerated.',
      'Follow all instructions given by the trip organizer, lead guide, and local authorities. During adventure activities, safety instructions are non-negotiable.',
      'Avoid consuming excessive alcohol during the trip. Drunkenness that puts you or others at risk may result in removal from the trip without a refund.',
      'Illegal substances are strictly prohibited on all trips.',
      'Maintain personal hygiene and keep shared accommodation clean and tidy.',
      'Do not cause damage to any property, vehicle, accommodation, or natural environment.',
      'Noise should be kept to a minimum during night hours, especially in shared accommodations and local villages.',
    ],
  },
  {
    id: 'traveler-environment',
    title: 'Environmental Responsibility',
    items: [
      'Follow "Leave No Trace" principles — carry your waste back or deposit it at designated points. Never litter on trails, at campsites, or near water bodies.',
      'Do not pick flowers, disturb wildlife, or remove any natural objects from protected areas, forests, or beaches.',
      'Respect plastic-free zones. Many popular trekking areas in India ban single-use plastic — carry a reusable water bottle.',
      'Do not build open fires unless explicitly permitted and in designated areas. Forest fires are a serious hazard.',
    ],
  },
  {
    id: 'traveler-photography',
    title: 'Photography & Social Media',
    items: [
      'Always obtain consent before photographing or filming fellow travelers, especially for content you intend to post publicly.',
      'Photography at military installations, border areas, and certain government buildings is prohibited by Indian law.',
      'Respect local cultural sensitivities — always ask before photographing in places of worship, rural communities, or tribal areas.',
      'Do not post photos or videos that violate the privacy of other travelers without their consent.',
    ],
  },
  {
    id: 'traveler-insurance',
    title: 'Travel Insurance',
    items: [
      `${APP_NAME} strongly recommends purchasing comprehensive travel insurance before every trip. Insurance should cover medical emergencies (including evacuation from remote areas), personal accident, trip cancellation, and loss of baggage.`,
      'For high-altitude trips (above 3,500 metres) such as Ladakh, Spiti Valley, or Himalayan treks, ensure your policy specifically covers altitude sickness and emergency evacuation.',
      `${APP_NAME} and organizers are not responsible for medical or evacuation costs in the absence of insurance.`,
    ],
  },
]

export const organizerRuleGroups: RuleGroup[] = [
  {
    id: 'organizer-eligibility',
    title: 'Eligibility & Verification',
    items: [
      `You must be at least 21 years old and a resident of India to register as a trip organizer.`,
      `You must complete our KYC (Know Your Customer) process, providing valid government-issued ID, business registration documents (if applicable), PAN Card, and bank account details for payouts.`,
      `You must not have any prior history of fraud, financial crimes, or consumer complaints upheld against you in relation to travel services.`,
      `Only approved organizers may list trips on ${APP_NAME}. Listing trips before KYC approval is not permitted.`,
    ],
  },
  {
    id: 'organizer-listings',
    title: 'Accurate Trip Listings',
    items: [
      'All trip descriptions, itineraries, pricing, inclusions, and exclusions must be accurate, honest, and up-to-date.',
      `Photos used in listings must be genuine representations of the trip — stock photos or images from other trips are not permitted unless clearly labelled as illustrative.`,
      `Any changes to the itinerary, accommodation, or inclusions after booking must be communicated to all booked travelers immediately and in writing through the ${APP_NAME} platform.`,
      'Pricing must include all mandatory charges. Hidden fees that are not disclosed at the time of booking are a violation of these guidelines.',
      'Group size limits (minimum and maximum) must be set accurately. Over-booking beyond the stated maximum is not permitted.',
    ],
  },
  {
    id: 'organizer-safety',
    title: 'Safety Standards',
    items: [
      'All vehicles used for transportation must have valid registration, fitness certificates, permits, and insurance under the Motor Vehicles Act, 1988.',
      'Drivers must hold a valid commercial driving licence appropriate for the vehicle class.',
      'For adventure activities (trekking, rafting, zip-lining, etc.), certified and experienced guides must be present at all times. All necessary safety equipment must be provided.',
      'You must conduct a pre-trip safety briefing for all participants before the activity begins.',
      'Accommodation provided must meet basic hygiene, safety, and fire safety standards.',
      'Maintain a first aid kit on all trips. For remote trips, carry a comprehensive wilderness first aid kit and have an emergency evacuation plan in place.',
      'For trips to high-altitude areas, you must be trained to recognise and manage Acute Mountain Sickness (AMS). Pulse oximeters and emergency oxygen are strongly recommended.',
    ],
  },
  {
    id: 'organizer-communication',
    title: 'Communication with Travelers',
    items: [
      'Respond to traveler inquiries and messages within 24 hours.',
      `Send a detailed pre-trip communication (packing list, meeting point, contact number, weather forecast) to all booked travelers at least 48 hours before the trip departure.`,
      `In case of any trip modification or emergency, communicate immediately through the ${APP_NAME} platform so all travelers are informed.`,
      `Do not attempt to move travelers to off-platform communication channels for the purpose of avoiding ${APP_NAME} fees or policies.`,
    ],
  },
  {
    id: 'organizer-cancellation',
    title: 'Cancellation Obligations',
    items: [
      `If you must cancel a trip, notify all booked travelers and ${APP_NAME} with as much advance notice as possible — at a minimum, 48 hours before the trip start.`,
      'All travelers on a cancelled trip will receive a full refund from escrow regardless of the cancellation policy.',
      `Repeated cancellations will result in suspension of organizer privileges and investigation by the ${APP_NAME} team.`,
      `Cancellation for reasons within the organizer's control (insufficient bookings, logistical failures) that are not communicated in advance may result in penalties and negative rating impact.`,
    ],
  },
  {
    id: 'organizer-prohibited',
    title: 'Prohibited Organizer Conduct',
    items: [
      `Accepting payments outside of the ${APP_NAME} platform to circumvent escrow or platform fees.`,
      'Listing trips you do not have the rights, permits, or capacity to operate.',
      'Discriminating against travelers on the basis of religion, caste, gender, sexual orientation, disability, or any other protected characteristic.',
      'Sharing traveler personal information with any third party for purposes other than trip management.',
      'Soliciting or manipulating traveler reviews.',
      'Creating multiple organizer accounts to circumvent a suspension.',
    ],
  },
]

export const rulesReportingText = {
  intro: 'If you witness or experience a violation of these guidelines — by a traveler, organizer, or any other party — please report it to us immediately:',
  channels: [
    'Use the in-app support chat during an active trip',
    `Email ${CONTACT_EMAIL} with your booking reference and a description of the incident`,
  ],
  followUp: `${APP_NAME} takes all reports seriously. Violations may result in warnings, suspension, or permanent removal from the platform, and — where appropriate — referral to law enforcement.`,
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCLAIMER
// ─────────────────────────────────────────────────────────────────────────────

export const disclaimerSections: LegalSection[] = [
  {
    id: 'intermediary',
    title: '1. Platform Role — Intermediary Only',
    content: `${APP_NAME} is an online marketplace and intermediary that connects independent trip organizers with travelers. We do not own, operate, manage, conduct, or supervise any trips listed on the platform.

We are an intermediary as defined under the Information Technology Act, 2000 and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021. As an intermediary, ${APP_NAME} is not responsible for the acts, omissions, representations, warranties, or breaches of any trip organizer.

The contract for the actual trip — covering transportation, accommodation, meals, activities, and all related services — is between you (the traveler) and the trip organizer, not with ${APP_NAME}.`,
  },
  {
    id: 'content-accuracy',
    title: '2. Accuracy of Trip Content',
    content: `All trip descriptions, itineraries, photos, prices, inclusions, exclusions, pickup points, and group size information are provided by independent trip organizers. ${APP_NAME} does not independently verify the accuracy, completeness, or currency of this content.

While we require organizers to maintain accurate listings (per our Organizer Agreement), ${APP_NAME} makes no warranty — express or implied — that:

• Trip details are accurate, current, or complete at the time of booking.
• Photos represent the exact accommodation, vehicle, or scenery you will experience.
• Stated inclusions will be delivered exactly as described.
• Trip itineraries will be followed without modification.

If you experience a material discrepancy between what was described and what was delivered, you should first raise the issue with the organizer through the ${APP_NAME} platform. If unresolved, contact us at ${CONTACT_EMAIL} with supporting documentation.`,
  },
  {
    id: 'health-medical',
    title: '3. Health, Medical, and Fitness',
    content: `${APP_NAME} does not assess the physical fitness, medical suitability, or health status of any traveler for any trip. You are solely responsible for determining whether a trip is appropriate for your health condition, age, and physical fitness.

For adventure trips (high-altitude trekking, white-water rafting, rock climbing, etc.), risks include but are not limited to: altitude sickness (AMS/HACE/HAPE), exhaustion, dehydration, falls, injuries, and in extreme cases, death.

Before booking any adventure trip, you must:

• Consult a qualified medical professional if you have any existing health conditions (heart disease, respiratory conditions, diabetes, pregnancy, etc.).
• Disclose relevant medical conditions to the organizer before the trip.
• Carry any personal medications prescribed for altitude or activity-specific conditions.

${APP_NAME} is not liable for any medical expenses, hospitalisation, evacuation costs, or consequences arising from your participation in a trip, with or without a pre-existing health condition.`,
  },
  {
    id: 'adventure-risks',
    title: '4. Adventure Activity Risks',
    content: `Group travel to destinations such as Ladakh, Spiti Valley, Himalayan trekking routes, river-rafting destinations (Rishikesh), and coastal activities (Andaman, Goa) involves inherent risks that cannot be fully eliminated even with the highest safety standards.

By booking such trips through ${APP_NAME}, you acknowledge:

• Inherent risks exist in adventure and outdoor activities regardless of organizer quality.
• Conditions at the destination (weather, terrain, altitude, water levels) can change rapidly and unpredictably.
• ${APP_NAME} does not control, inspect, or certify the safety equipment, vessels, vehicles, or routes used by organizers.
• You are voluntarily assuming the inherent risks of participation.

This acknowledgement does not release organizers from responsibility for gross negligence, wilful misconduct, or failure to meet the safety standards specified in their agreement with ${APP_NAME}.`,
  },
  {
    id: 'third-party',
    title: '5. Third-Party Services',
    content: `${APP_NAME} integrates with third-party service providers including Razorpay (payment processing), Cloudinary (image hosting), and SMS/email delivery services. These providers act as Data Processors under the DPDPA, 2023, and ${APP_NAME} ensures they are bound by data processing agreements with equivalent protections.

${APP_NAME} is not liable for:
• Service interruptions or downtime caused by third-party infrastructure (Razorpay, Cloudinary, SMS gateways).
• Payment failures or delays caused by your bank, UPI network, or payment gateway infrastructure where ${APP_NAME} has taken all reasonable steps on its end.
• Loss of images or media content hosted on third-party CDN systems due to infrastructure failure outside our control.

In the event of a data breach involving a third-party processor that affects your personal data, ${APP_NAME} will notify you and the relevant authorities as required under the DPDPA, 2023, within prescribed timelines. We cannot, however, guarantee the independent security practices of third-party systems beyond what is contractually bound.

Use of third-party services is subject to their respective terms and privacy policies. We recommend you review Razorpay's privacy policy before completing a payment.`,
  },
  {
    id: 'external-links',
    title: '6. External Links',
    content: `The ${APP_NAME} platform may contain links to external websites operated by organizers or third parties. These links are provided for convenience only. ${APP_NAME} does not endorse, control, or take responsibility for the content, accuracy, or privacy practices of any externally linked website.

Visiting any external link is at your own risk.`,
  },
  {
    id: 'force-majeure',
    title: '7. Force Majeure and Natural Events',
    content: `${APP_NAME} is not liable for any failure or delay in service caused by circumstances beyond our reasonable control, including but not limited to: natural disasters, floods, earthquakes, landslides, cyclones, extreme weather events, road closures, government-imposed restrictions, civil unrest, pandemics, strikes, or acts of terrorism.

In such events, our Cancellation & Refund Policy governs what refunds are available. We will make every reasonable effort to communicate with affected users promptly and facilitate refunds from escrow where applicable.`,
  },
  {
    id: 'investment-disclaimer',
    title: '8. Not Financial or Investment Advice',
    content: `Nothing on the ${APP_NAME} platform constitutes financial, investment, tax, or legal advice. Trip pricing, early bird discounts, and promotional offers should not be treated as investment instruments. ${APP_NAME} does not make any representation regarding future price changes or trip availability.`,
  },
  {
    id: 'governing',
    title: '9. Governing Law',
    content: `This Disclaimer is governed by the laws of India. Any disputes arising from this Disclaimer shall be subject to the exclusive jurisdiction of the competent courts in Pune, Maharashtra, India.

This Disclaimer should be read alongside our Terms of Service and Privacy Policy, which together form the complete legal framework governing your use of ${APP_NAME}.`,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// ORGANIZER AGREEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const organizerAgreementSections: LegalSection[] = [
  {
    id: 'overview',
    title: '1. Overview and Acceptance',
    content: `This Organizer Agreement ("Agreement") governs your participation as a trip organizer on the ${APP_NAME} platform. By completing the organizer registration process and listing any trip on ${APP_NAME}, you confirm that you have read, understood, and agree to be bound by this Agreement, our Terms of Service, Privacy Policy, and Community Rules & Guidelines.

This Agreement is in addition to, and does not replace, the general Terms of Service. Where there is a conflict between this Agreement and the Terms of Service on organizer-specific matters, this Agreement prevails.

The effective date of this Agreement for your account is the date your organizer account is approved by ${APP_NAME}.`,
    link: { href: '/rules', label: 'Read the Community Rules & Guidelines →' },
  },
  {
    id: 'eligibility',
    title: '2. Organizer Eligibility',
    content: `To become and remain an organizer on ${APP_NAME}, you must:

• Be at least 21 years of age.
• Be an individual resident of India, a registered Indian partnership firm, a registered LLP, or a company incorporated in India.
• Provide truthful and complete information during registration and KYC.
• Not be a disqualified individual under the Companies Act, 2013 or any other Indian law.
• Not have been convicted of any fraud, financial crime, or consumer protection violation.
• Not have been removed from any other travel platform for policy violations, fraud, or misconduct.

By registering as an organizer, you represent and warrant that you meet all eligibility criteria above. Misrepresentation of eligibility is grounds for immediate account termination and potential legal action.`,
  },
  {
    id: 'kyc',
    title: '3. KYC Verification',
    content: `All organizers must complete KYC (Know Your Customer) verification before listing any trip. The following documents are required:

Individual Organizers:
• Government-issued photo ID — any one of: Passport, Voter ID, or Driving Licence. Aadhaar is accepted as a voluntary alternative only and is not mandatory, in compliance with the Aadhaar Act, 2016 and the Supreme Court judgment in Justice K.S. Puttaswamy v. Union of India (2018).
• PAN Card
• A selfie for identity matching
• Bank account details (account number + IFSC code) for payout processing

Business Organizers (Partnership/LLP/Company):
• Certificate of Incorporation or Partnership Deed
• PAN Card of the entity
• GST Registration Certificate (if turnover exceeds the GST threshold)
• Authorised signatory's government-issued ID (Passport, Voter ID, or Driving Licence) and PAN
• Current bank account details of the entity

KYC verification is conducted by ${APP_NAME}'s team. Approval or rejection will be communicated within 48 business hours. Submitting fraudulent documents is a criminal offence under the Indian Penal Code, the Prevention of Money Laundering Act, 2002, and the IT Act, 2000.`,
  },
  {
    id: 'listings',
    title: '4. Trip Listing Standards',
    content: `4.1 Accuracy Obligation
All trip information you publish on ${APP_NAME} must be accurate, current, and complete at the time of listing. You must update listings within 24 hours of any material change to the itinerary, price, inclusions, or group size limits.

4.2 Mandatory Fields
Every trip listing must include: departure city/point, destination, travel dates, price per person (inclusive of all mandatory charges), maximum group size, cancellation policy tier (Flexible/Moderate/Strict), and a description of what is and is not included.

4.3 Photography
Images uploaded must genuinely represent the trip — the actual vehicles, accommodation, destination, and activities. Stock photos are not permitted. Organisers may use their own professionally shot photos but must not use images of accommodation or vehicles they are not actually providing.

4.4 Pricing Transparency
All mandatory charges (transportation, accommodation, meals if included, activity fees) must be included in the displayed price. Optional add-ons must be clearly labelled as optional with their costs. Hidden fees disclosed only at the booking stage are a violation of this Agreement.

4.5 Group Size Limits
You must set the maximum group size based on actual capacity — vehicle seating, accommodation capacity, or activity limits. Overbooking beyond stated limits is prohibited.`,
  },
  {
    id: 'safety-obligations',
    title: '5. Safety Obligations',
    content: `As an organizer, you are solely responsible for the safety of all travelers on your trips. You must:

5.1 Vehicles
• Use vehicles with valid registration, fitness certificate (RC), insurance, and appropriate commercial route permits under the Motor Vehicles Act, 1988.
• Ensure drivers hold valid commercial driving licences for the vehicle type.
• Not exceed the legal passenger capacity of any vehicle.
• Ensure vehicles are maintained and in roadworthy condition before each trip.

5.2 Guides and Staff
• For trekking trips, employ certified trekking guides with experience on the specific route.
• For adventure activities (rafting, rock climbing, paragliding), use only certified instructors with valid certifications from recognised bodies (Adventure Tour Operators Association of India or equivalent).
• Maintain a guide-to-traveler ratio appropriate for the activity and terrain.

5.3 First Aid and Emergency
• Carry a comprehensive first aid kit on all trips.
• For remote and high-altitude trips, carry a pulse oximeter and emergency oxygen if the route exceeds 3,500 metres above sea level.
• Have an emergency evacuation plan for each trip route.
• Share your emergency contact number with all booked travelers before departure.

5.4 Adventure Activity Safety Standards
• Conduct a safety briefing for all adventure activities before commencement.
• Provide and fit all required safety equipment (helmets, life jackets, harnesses) correctly.
• Check weather and route conditions before each trip day and cancel or modify plans if conditions are unsafe.
• Maintain activity-specific insurance or third-party liability insurance covering all travelers.

5.5 Health and Age Screening
• Screen travelers for age and fitness requirements you have specified in your listing.
• You may refuse participation to a traveler who does not meet stated requirements, provided you notify ${APP_NAME} support promptly so a refund can be processed.`,
    link: { href: '/safety', label: 'Read our full Safety Standards page →' },
  },
  {
    id: 'payments-payouts',
    title: '6. Payments and Payouts',
    content: `6.1 Escrow Model
All traveler payments are held in escrow via Razorpay until the trip is completed. You will not receive any portion of traveler payments before trip completion except where explicitly stated otherwise.

6.2 Platform Fee
${APP_NAME} charges a platform service fee on each completed booking. The applicable fee rate is communicated during organizer onboarding and may be updated with 30 days' notice. The fee is deducted from your payout — you receive the net amount.

6.3 Payout Schedule
Payouts for completed trips are initiated by ${APP_NAME} within 3–5 business days of the trip's end date. Funds are transferred to the bank account you provided during KYC. Payout delays may occur if a dispute is raised by a traveler or if verification is pending.

6.4 GST Compliance and TCS
You are responsible for collecting and remitting applicable Goods and Services Tax (GST) on your services. You must provide a valid GSTIN if you are a GST-registered entity, and include GST in your displayed pricing or clearly disclose it as an addition.

As an e-commerce operator under Section 52 of the Central Goods and Services Tax Act, 2017, ${APP_NAME} is required to collect Tax Collected at Source (TCS) at 1% (0.5% CGST + 0.5% SGST, or 1% IGST for inter-state supplies) on the net value of taxable supplies made through the platform. TCS will be deducted from your payout before transfer. ${APP_NAME} will file Form GSTR-8 and issue a TCS certificate which you can use to claim the credit in your GSTR-2A/2B.

6.5 TDS under Section 194-O
As an e-commerce operator under Section 194-O of the Income Tax Act, 1961 (inserted by Finance Act 2020), ${APP_NAME} will deduct Tax Deducted at Source (TDS) at 1% on the gross amount paid to you as an e-commerce participant. This is a mandatory statutory obligation — it is not discretionary. ${APP_NAME} will issue Form 16A (TDS certificate) for amounts deducted. You may claim TDS credit in your income tax return.`,
  },
  {
    id: 'cancellation-obligations',
    title: '7. Cancellation Obligations',
    content: `7.1 Organizer-Initiated Cancellations
If you cancel a trip for any reason, all booked travelers are entitled to a full refund from escrow. You must notify ${APP_NAME} and all travelers at least 48 hours before the scheduled departure when a cancellation is anticipated.

7.2 Consequences of Cancellations
Organizer-initiated cancellations (other than documented force majeure events) will result in:
• A negative impact on your organizer rating.
• A cancellation record on your organizer profile, visible to prospective travelers.
• For repeated cancellations (3 or more in any 6-month period), a temporary suspension for review.
• For cancellations without adequate notice, a penalty fee may be levied as communicated in your onboarding documentation.

7.3 Trip Modifications
Material changes to an already-booked trip (change of departure date, destination, transportation type, or major inclusions) must be communicated to all booked travelers immediately. Travelers who do not accept the modification are entitled to a full refund.`,
  },
  {
    id: 'content-ip',
    title: '8. Content and Intellectual Property',
    content: `8.1 Your Content Licence to ${APP_NAME}
By uploading trip descriptions, photos, videos, and other content ("Organizer Content") to the platform, you grant ${APP_NAME} a non-exclusive, royalty-free, worldwide, sublicensable licence to use, display, reproduce, and promote the Organizer Content for the purpose of operating and marketing the ${APP_NAME} platform.

8.2 Your Representations About Content
You represent and warrant that all Organizer Content you upload:
• Is your original work or you have the necessary rights to use it.
• Does not infringe any third party's intellectual property, privacy, or personality rights.
• Is not misleading, fraudulent, or in violation of any Indian law.

8.3 Retention After Termination
Upon account termination, ${APP_NAME} may retain Organizer Content for archival and dispute resolution purposes for up to 3 years.`,
  },
  {
    id: 'non-circumvention',
    title: '9. Non-Circumvention',
    content: `You agree not to:

• Accept payments from travelers outside of the ${APP_NAME} platform, whether via UPI, bank transfer, cash, or any other method, for trips that originated as enquiries or bookings through ${APP_NAME}.
• Request travelers to cancel their ${APP_NAME} booking and re-book directly with you to avoid platform fees.
• Share personal contact details (phone, UPI, WhatsApp, Instagram) with travelers for the purpose of off-platform transactions.
• Create duplicate organizer accounts to circumvent fee structures or previous suspensions.

Violation of this clause is treated as material breach of this Agreement and may result in immediate permanent account ban, forfeiture of pending payouts, and legal action for recovery of lost platform fees.`,
  },
  {
    id: 'conduct',
    title: '10. Organizer Conduct',
    content: `You must at all times:

• Treat all travelers with respect, dignity, and without discrimination on the basis of religion, caste, gender, sexual orientation, disability, or any other protected characteristic under Indian law.
• Respond to traveler messages and queries within 24 hours.
• Not share traveler personal information with any third party other than for the direct purpose of managing their trip participation.
• Not post fake, incentivised, or manipulated reviews or ratings on the platform.
• Comply with all applicable Indian laws, including the Tourism Act, Consumer Protection Act, Motor Vehicles Act, and Environmental Protection Act, in the operation of your trips.`,
  },
  {
    id: 'suspension-termination',
    title: '11. Suspension and Termination',
    content: `${APP_NAME} reserves the right to suspend or permanently terminate your organizer account for:

• Repeated or serious violations of this Agreement, the Terms of Service, or Community Rules.
• Submission of false or fraudulent KYC documents.
• Non-circumvention violations.
• Repeated organizer-initiated cancellations without valid cause.
• Credible and verified safety complaints from travelers.
• Fraudulent or misleading trip listings.
• Non-payment of outstanding amounts owed to ${APP_NAME}.
• Any criminal offence or regulatory violation related to travel services.

On termination, pending payouts for trips not yet completed may be withheld for a period not exceeding 90 days, or until outstanding disputes are resolved, whichever is earlier. If no dispute is raised or substantiated within 90 days, any undisputed balance will be released. Payouts for trips already completed before the termination date will be processed normally within the standard payout schedule.

You may appeal a suspension within 14 days by emailing ${GRIEVANCE_EMAIL} with supporting documentation.`,
  },
  {
    id: 'governing',
    title: '12. Governing Law',
    content: `This Agreement is governed by the laws of India. Disputes shall be subject to the exclusive jurisdiction of the competent courts in Pune, Maharashtra.

For grievances, contact our Grievance Officer:

Name: ${GRIEVANCE_OFFICER_NAME}
Email: ${GRIEVANCE_EMAIL}
Address: ${COMPANY_ADDRESS}

We will acknowledge within 48 hours and aim to resolve within 30 days as required under IT Rules 2021.`,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────────────────────

export const faqs: FaqItem[] = [
  {
    question: 'What is escrow payment protection?',
    answer: `When you book a trip on ${APP_NAME}, your payment is held in a secure escrow account powered by Razorpay. The money is NOT released to the organizer until the trip is successfully completed. If the trip is cancelled by the organizer, you receive an automatic full refund — no questions asked, no processing fees. This protects you from fraud and ensures organizers deliver on their promises.`,
  },
  {
    question: 'How do I book a group trip?',
    answer: `Browse trips on our platform, select one that matches your interests, and click "Book Now". For instant-booking trips, you pay and your seat is confirmed immediately. For request-based trips, the organizer reviews your request first and sends you a payment link upon approval. You'll receive a booking confirmation on your registered email and phone number.`,
  },
  {
    question: 'Are the trip organizers verified?',
    answer: `Yes. Every organizer on ${APP_NAME} goes through a mandatory KYC (Know Your Customer) verification process before they can list any trips. We verify their government-issued ID, business documents, and bank account details. Only approved organizers can list trips. You can see their rating, verified badge, review count, and completed trip history on their profile page.`,
  },
  {
    question: 'What happens if a trip is cancelled?',
    answer: `If an organizer cancels a trip for any reason, you receive a 100% full refund from the escrow account — automatically, within 5–7 business days. If you cancel, the refund depends on the trip's cancellation policy — Flexible (full refund up to 7 days before), Moderate (50% refund up to 7 days before), or Strict (25% refund up to 14 days before, no refund after). The policy is clearly shown on the booking page before you pay.`,
  },
  {
    question: 'Can I compare trips side by side?',
    answer: `Yes! Use our comparison tool to compare up to 3 trips side by side. Compare prices, itineraries, inclusions, exclusions, organizer ratings, and more. Click the "Compare" button on any trip card to add it to your comparison queue.`,
  },
  {
    question: 'What payment methods are accepted?',
    answer: `We accept all major payment methods through Razorpay — UPI (Google Pay, PhonePe, Paytm, BHIM), credit/debit cards (Visa, Mastercard, RuPay), net banking, and digital wallets. All transactions are encrypted with bank-grade security and comply with RBI guidelines. We never store your card details.`,
  },
  {
    question: 'How long does a refund take?',
    answer: `Refunds are processed via Razorpay to your original payment method. UPI refunds typically arrive in 2–5 business days. Credit/debit card and net banking refunds take 5–7 business days. Wallet refunds appear within 1–3 business days. If you haven't received your refund within these timelines, email ${CONTACT_EMAIL} with your booking reference.`,
  },
  {
    question: 'How do early bird discounts work?',
    answer: `Many trips offer early bird pricing — a discounted rate if you book before a certain date. The early bird deadline and both prices are shown on the trip page. Once the deadline passes, the price reverts to the standard rate. Book early to save — early bird prices are locked in even if the price increases later.`,
  },
  {
    question: 'Can I choose my seat in the vehicle?',
    answer: `Some trips offer seat selection. If the organizer has enabled it, you'll see a seat map during booking where you can pick your preferred seat. Available, held, and booked seats are clearly marked. Seat selection is subject to availability at the time of booking.`,
  },
  {
    question: 'What documents do I need to carry on a trip?',
    answer: `You must carry at least one valid government-issued photo ID (Aadhaar Card, Passport, Voter ID, or Driving Licence) on all trips. For trips to Jammu & Kashmir, Ladakh, and Northeast India, you may also need an Inner Line Permit (ILP) — check the trip page for specific requirements. Foreign nationals must carry a valid Passport and Indian Visa.`,
  },
  {
    question: 'How do reviews work?',
    answer: `Only travelers who have completed a trip can leave reviews. You rate the organizer on 4 criteria: overall experience, organization, value for money, safety, and accuracy (how well the trip matched its description). Organizers can respond to reviews publicly. This ensures authentic, verified feedback — no fake or incentivised reviews are permitted.`,
  },
  {
    question: 'Is my personal information safe?',
    answer: `${APP_NAME} takes data privacy seriously and complies with India's Digital Personal Data Protection Act, 2023 (DPDPA). We never share your personal data with third parties for advertising. Organizers only see the information needed to manage your booking (name, phone, emergency contact). Payments are processed securely through Razorpay — we never store your card or UPI details.`,
  },
  {
    question: 'What destinations do you cover?',
    answer: `We currently feature trips across Goa, Manali, Ladakh, Rishikesh, Jaipur, Kasol, Lonavala, Udaipur, Spiti Valley, Coorg, Varanasi, Andaman Islands, Meghalaya, and Hampi. New destinations are added regularly. Most trips depart from Pune, Delhi, Mumbai, or Bangalore.`,
  },
  {
    question: 'What should I do if I lose something on a trip?',
    answer: `Message your organizer immediately through the ${APP_NAME} messaging system (My Bookings → Message Organizer) with a description of the item and where you think you left it. If the organizer doesn't respond within 24 hours, email ${CONTACT_EMAIL} with your booking reference and we'll follow up on your behalf.`,
    link: { href: '/lost-item', label: 'Read the full Lost Item Policy →' },
  },
  {
    question: 'Do I need travel insurance?',
    answer: `${APP_NAME} strongly recommends purchasing travel insurance before every trip, especially for adventure activities (trekking, rafting, high-altitude trips). Insurance should cover medical emergencies, personal accident, trip cancellation, and loss of baggage. For Ladakh and Himalayan treks above 3,500 metres, ensure your policy covers altitude sickness and emergency evacuation. Neither ${APP_NAME} nor organizers are liable for medical costs in the absence of insurance.`,
  },
  {
    question: 'How can I become a trip organizer?',
    answer: `Sign up on ${APP_NAME} and select the Organizer role. You'll need to complete KYC verification by providing your government-issued ID, business details, and bank account information. Our team reviews applications within 48 hours. Once approved, you can start listing trips immediately. Organizers receive payouts after each successfully completed trip.`,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// CONTACT US
// ─────────────────────────────────────────────────────────────────────────────

export interface ContactChannel {
  id: string
  icon: string
  title: string
  description: string
  email: string
  subject: string
  responseTime: string
  note?: string
}

export const contactChannels: ContactChannel[] = [
  {
    id: 'traveler-support',
    icon: '🎒',
    title: 'Traveler Support',
    description: 'Booking queries, seat selection, payment issues, cancellation requests, refund status.',
    email: CONTACT_EMAIL,
    subject: 'Traveler Support — Booking Reference',
    responseTime: 'Within 24 hours on business days',
  },
  {
    id: 'organizer-support',
    icon: '🗓️',
    title: 'Organizer Support',
    description: 'KYC verification, payout queries, trip listing issues, account management.',
    email: CONTACT_EMAIL,
    subject: 'Organizer Support',
    responseTime: 'Within 24 hours on business days',
  },
  {
    id: 'grievance',
    icon: '⚖️',
    title: 'Grievance Redressal',
    description: 'Formal complaints about the platform, data privacy concerns, or disputes unresolved through standard support.',
    email: GRIEVANCE_EMAIL,
    subject: 'Formal Grievance',
    responseTime: 'Acknowledged within 48 hours; resolved within 30 days',
    note: `Grievance Officer: ${GRIEVANCE_OFFICER_NAME}. As mandated under IT Rules 2021 Rule 3(2)(b), Consumer Protection (E-Commerce) Rules 2020, and the DPDP Act, 2023.`,
  },
  {
    id: 'media',
    icon: '📣',
    title: 'Media & Press',
    description: 'Interview requests, press coverage, partnership inquiries, and brand collaborations.',
    email: CONTACT_EMAIL,
    subject: 'Media Inquiry',
    responseTime: 'Within 48 hours',
  },
]

export interface ResponseTimeRow {
  type: string
  time: string
}

export const responseTimeRows: ResponseTimeRow[] = [
  { type: 'Booking / payment issue', time: 'Within 24 hours' },
  { type: 'Refund query', time: 'Within 24 hours' },
  { type: 'Organizer KYC / payout', time: 'Within 24–48 hours' },
  { type: 'Formal grievance (IT Rules 2021)', time: 'Acknowledged: 48 hours; Resolved: 30 days' },
  { type: 'Media / press', time: 'Within 48 hours' },
]

export const responseTimeNote =
  'Response times are for business days (Monday–Friday, 10 AM – 6 PM IST). We aim to respond on weekends for urgent booking and safety issues.'

export const fasterResponseTips = [
  'Always include your <strong>booking reference number</strong> in the subject line.',
  'For refund queries, mention the <strong>original payment method</strong> (UPI/card/net banking) and transaction date.',
  'For organizer issues, include the <strong>trip name, slug, or organizer username</strong>.',
  'For safety complaints, describe the incident with <strong>date, location, and the organizer\'s name</strong>.',
  'For data privacy requests, use the subject line <strong>"Data Rights Request"</strong> and specify what action you want (access/correction/deletion).',
]

// ─────────────────────────────────────────────────────────────────────────────
// SAFETY STANDARDS
// ─────────────────────────────────────────────────────────────────────────────

export interface SafetyStandard {
  id: string
  icon: string
  title: string
  items: string[]
}

export const safetyStandards: SafetyStandard[] = [
  {
    id: 'vehicles',
    icon: '🚌',
    title: 'Vehicle Safety',
    items: [
      'All transport vehicles must have valid Registration Certificate (RC), Fitness Certificate, commercial route permit, and third-party insurance under the Motor Vehicles Act, 1988.',
      'Drivers must hold a valid commercial driving licence (Heavy Motor Vehicle or Light Motor Vehicle as appropriate).',
      'Passenger capacity must not exceed the legally permitted seating for the vehicle.',
      'Vehicles must be maintained and in roadworthy condition — no overloaded luggage compartments or bald tyres.',
      'For overnight journeys exceeding 8 hours, two drivers are required.',
      'Night driving on mountain roads (above 2,000m elevation) is prohibited unless the route is specifically approved and weather conditions are safe.',
    ],
  },
  {
    id: 'guides',
    icon: '🧭',
    title: 'Guides and Staff',
    items: [
      'All trekking trips must be led by guides with documented experience on the specific route and knowledge of altitude sickness symptoms and first response.',
      'Adventure activities (white-water rafting, rock climbing, paragliding, zip-lining) must be supervised by instructors holding valid certifications from recognised Indian bodies such as the Adventure Tour Operators Association of India (ATOAI) or equivalent.',
      'A guide-to-traveler ratio of at minimum 1:10 is required on all adventure treks. Higher ratios are required for routes above 4,000m or with Class III+ rapids.',
      'All guides must carry a fully stocked first aid kit and know how to use it.',
      'For trips to remote areas (Spiti, Ladakh beyond Leh, parts of Northeast India), guides must have satellite phone access or an emergency communication device.',
    ],
  },
  {
    id: 'first-aid',
    icon: '🩺',
    title: 'First Aid & Medical Preparedness',
    items: [
      'A comprehensive first aid kit must be carried on every trip. Contents must be appropriate for the destination — standard wilderness first aid kit for remote treks, marine safety kit for water-based activities.',
      'For high-altitude trips above 3,500m, organizers must carry a pulse oximeter and emergency supplemental oxygen.',
      'Guides must conduct a pre-departure health check for travelers on high-altitude routes.',
      'Emergency contact numbers (local hospital, ambulance, rescue teams, police) for the destination must be accessible to all guides and shared with travelers.',
      'A written emergency action plan must exist for each trip route, including nearest hospital, evacuation routes, and helicopter landing zones if applicable.',
    ],
  },
  {
    id: 'altitude',
    icon: '🏔️',
    title: 'High-Altitude Safety',
    items: [
      'Trips to destinations above 3,000m (Ladakh, Spiti Valley, high-altitude Himalayan treks) require a mandatory acclimatisation day before ascending to higher altitudes.',
      'Guides must be trained to recognise and respond to Acute Mountain Sickness (AMS), High Altitude Cerebral Edema (HACE), and High Altitude Pulmonary Edema (HAPE).',
      'The "golden rule" of altitude sickness — never ascend with symptoms — must be followed without exception. Any traveler showing AMS symptoms must descend immediately.',
      'Altitude limits and daily ascent rates (typically no more than 300–500m per day above 3,000m) must be respected in the itinerary.',
      'Travelers with heart or respiratory conditions must be screened out or cleared by a doctor before joining high-altitude trips.',
    ],
  },
  {
    id: 'water-activities',
    icon: '🌊',
    title: 'Water-Based Activity Safety',
    items: [
      'Life jackets of appropriate buoyancy must be provided and correctly fitted for all water activities.',
      'Helmets must be worn during river rafting, kayaking, and any activity near rapids.',
      'Water activities must be cancelled or modified if river levels, current conditions, or weather pose unreasonable risk.',
      'Rafting activities on Grade IV+ rapids require participants to have completed a swim test or declared swimming competency.',
      'All watercraft must carry safety throw ropes, rescue paddles, and first aid equipment.',
    ],
  },
  {
    id: 'emergency-protocols',
    icon: '🆘',
    title: 'Emergency Protocols',
    items: [
      `In any medical emergency, the organizer's first obligation is to the welfare of the traveler — evacuate or transport to the nearest medical facility without delay.`,
      `The organizer must notify ${APP_NAME} support immediately upon any medical emergency, accident, or serious incident using the emergency contact number provided during onboarding.`,
      'In case of a missing traveler, the organizer must inform local authorities (police, forest department, mountain rescue) within 1 hour of the traveler being confirmed missing.',
      'Organizers must not attempt to manage serious medical emergencies (suspected fractures, head injuries, chest pain, unconsciousness) without professional medical assistance.',
      `A post-incident report must be submitted to ${APP_NAME} within 48 hours of any serious incident.`,
    ],
  },
]

export interface EmergencyStep {
  step: string
  detail: string
}

export const travelerEmergencySteps: EmergencyStep[] = [
  {
    step: 'Prioritise your safety first.',
    detail: 'Move away from immediate danger. Do not put yourself at additional risk.',
  },
  {
    step: 'Contact the organizer or guide immediately.',
    detail: 'You were given an emergency contact number before departure. Call it now.',
  },
  {
    step: 'Call emergency services if needed.',
    detail: '112 (National Emergency — police, ambulance, fire; operational across India) | Mountain Rescue (Uttarakhand/HP): 1800-180-1500 | Coast Guard: 1554 | Backup: Police 100 | Ambulance 108',
  },
  {
    step: `Contact ${APP_NAME} support.`,
    detail: `Email ${CONTACT_EMAIL} with your booking reference and location. We will escalate to our emergency contact network immediately.`,
  },
  {
    step: 'Document the incident.',
    detail: 'If safe to do so, document the situation with photos, timestamps, and a written account. This is important for insurance claims and any formal complaint.',
  },
]

export const safetyVerificationPoints = [
  'KYC review includes verification of vehicle permits and guide credentials',
  'Traveler reviews specifically rate organizers on Safety (1–5 stars)',
  'Low safety ratings trigger an automatic account review',
  'Any safety complaint or incident report initiates an immediate investigation',
  'Repeat safety violations result in permanent ban from the platform',
]

// ─────────────────────────────────────────────────────────────────────────────
// COOKIE POLICY
// ─────────────────────────────────────────────────────────────────────────────

export interface CookieRow {
  name: string
  purpose: string
  expires: string
}

export interface ThirdPartyCookieRow {
  provider: string
  purpose: string
  policyUrl: string
}

export const essentialCookies: CookieRow[] = [
  {
    name: 'refreshToken',
    purpose: 'Keeps you logged in securely (httpOnly, Secure, SameSite=Strict)',
    expires: '7 days',
  },
  {
    name: 'auth-store (localStorage)',
    purpose: 'Stores your access token and basic profile for the current session',
    expires: 'Session / 15 min',
  },
  {
    name: 'booking-form-* (sessionStorage)',
    purpose: "Saves your booking form progress so it isn't lost if you navigate away",
    expires: 'Browser session',
  },
  {
    name: 'compare-queue (localStorage)',
    purpose: "Remembers which trips you've added to the comparison tool",
    expires: 'Until cleared',
  },
  {
    name: 'user-prefs (localStorage)',
    purpose: 'Saves display preferences (e.g., list vs. grid view, sort order) across visits',
    expires: 'Until cleared',
  },
]

export const analyticsCookies: CookieRow[] = [
  {
    name: '_vercel_analytics',
    purpose: 'Vercel Web Analytics — anonymous page views and performance metrics. No PII collected.',
    expires: '1 year',
  },
]

export const thirdPartyCookies: ThirdPartyCookieRow[] = [
  {
    provider: 'Razorpay',
    purpose: 'Payment session management, fraud detection during checkout',
    policyUrl: 'razorpay.com/privacy',
  },
]

export const cookieDpdpaText = {
  intro: `Under India's Digital Personal Data Protection Act, 2023 (DPDPA), cookies and browser storage that process personal data require a lawful basis. We do not rely on "legitimate interest" — that concept applies under GDPR (EU law), not DPDPA.`,
  bases: [
    { label: 'Essential cookies', basis: 'Certain Legitimate Use under DPDPA Section 7 — necessary for performance of the booking contract you entered into.' },
    { label: 'Analytics cookies', basis: 'Consent under DPDPA Section 6 — you are notified of their use and may block them via browser settings without affecting core functionality.' },
    { label: 'Preference cookies', basis: 'Certain Legitimate Use under DPDPA Section 7 — necessary to deliver the service as expected (e.g., remembering your language or display preferences).' },
  ],
  deletion: `You may request deletion of your account and associated data — which will also clear server-side session records — by emailing ${CONTACT_EMAIL}. Browser-side cookies and storage must be cleared manually through your browser settings.`,
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGAL HUB
// ─────────────────────────────────────────────────────────────────────────────

export interface LegalDocument {
  href: string
  title: string
  description: string
  lastUpdated: string
  audience: 'All users' | 'Travelers' | 'Organizers'
  required?: boolean
}

export const legalDocuments: LegalDocument[] = [
  {
    href: '/terms',
    title: 'Terms of Service',
    description: 'The full agreement between you and Safarnama — your rights, our rules, platform usage, and liability limits.',
    lastUpdated: LAST_UPDATED.terms,
    audience: 'All users',
    required: true,
  },
  {
    href: '/privacy',
    title: 'Privacy Policy',
    description: 'How we collect, use, store, and protect your personal data under the DPDP Act, 2023 and IT Act, 2000.',
    lastUpdated: LAST_UPDATED.privacy,
    audience: 'All users',
    required: true,
  },
  {
    href: '/cancellation-policy',
    title: 'Cancellation & Refund Policy',
    description: 'Cancellation tiers (Flexible, Moderate, Strict), refund timelines, force majeure provisions, and organizer cancellations.',
    lastUpdated: LAST_UPDATED.cancellation,
    audience: 'Travelers',
    required: true,
  },
  {
    href: '/rules',
    title: 'Community Rules & Guidelines',
    description: 'Expected conduct for travelers and organizers on the platform — zero-tolerance policies, review standards, and reporting.',
    lastUpdated: LAST_UPDATED.rules,
    audience: 'All users',
    required: true,
  },
  {
    href: '/disclaimer',
    title: 'Disclaimer',
    description: 'Our role as an intermediary marketplace, adventure activity risks, health disclaimers, and limits of platform liability.',
    lastUpdated: LAST_UPDATED.disclaimer,
    audience: 'All users',
  },
  {
    href: '/cookies',
    title: 'Cookie Policy',
    description: 'Every cookie and browser storage mechanism we use, why, and how to manage them. No advertising trackers.',
    lastUpdated: LAST_UPDATED.cookies,
    audience: 'All users',
  },
  {
    href: '/lost-item',
    title: 'Lost Item Policy',
    description: 'How to report and recover a lost item from a trip, platform liability limits, and prevention tips.',
    lastUpdated: LAST_UPDATED.lostItem,
    audience: 'Travelers',
  },
  {
    href: '/organizer-agreement',
    title: 'Organizer Agreement',
    description: 'The B2B agreement for trip organizers: KYC, listing standards, safety obligations, payout terms, and termination.',
    lastUpdated: LAST_UPDATED.organizerAgreement,
    audience: 'Organizers',
  },
  {
    href: '/safety',
    title: 'Safety Standards',
    description: 'Vehicle, guide, first aid, high-altitude, and water activity safety requirements that all organizers must meet.',
    lastUpdated: LAST_UPDATED.safety,
    audience: 'All users',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// LOST ITEM POLICY
// ─────────────────────────────────────────────────────────────────────────────

export interface LostItemStep {
  id: string
  title: string
  intro: string
  bullets: string[]
}

export const lostItemSteps: LostItemStep[] = [
  {
    id: 'report-immediately',
    title: 'Step 1 — Report Immediately',
    intro: 'The sooner you report a lost item, the better your chances of recovery. As soon as you realise something is missing:',
    bullets: [
      `Message your organizer directly through the ${APP_NAME} in-app messaging system. Go to My Bookings → [Your Trip] → Message Organizer.`,
      'Describe the item clearly: what it is, where you think it may have been left (vehicle seat, accommodation room number, dining area, campsite), and its approximate value.',
      'If you have photos of the item, send them to the organizer to help with identification.',
    ],
  },
  {
    id: 'contact-support',
    title: `Step 2 — Contact ${APP_NAME} Support`,
    intro: 'If the organizer does not respond within 24 hours or you need additional help:',
    bullets: [
      `Email ${CONTACT_EMAIL} with the subject line "Lost Item — [Your Booking Reference]".`,
      'Include in your email: booking reference number, trip name and date, item description, location where you believe the item was lost, and your contact number.',
      'Our support team will contact the organizer on your behalf and request a response within 24 hours.',
    ],
  },
  {
    id: 'recovery',
    title: 'Step 3 — Item Recovery & Return',
    intro: 'If the organizer locates your item:',
    bullets: [
      'You may arrange to pick it up from the organizer directly, or request that it be shipped to you. All shipping costs are the traveler\'s responsibility.',
      `${APP_NAME} can facilitate the communication but cannot bear the cost of shipping, courier services, or any other logistics related to item recovery.`,
      'Organizers are encouraged (but not legally obligated) to hold found items for a minimum of 30 days and make reasonable efforts to return them to the rightful owner.',
    ],
  },
]

export const lostItemLiabilityText = {
  main: `${APP_NAME} is not liable for the loss, theft, or damage of any personal belongings during a trip. Trip organizers are independent third-party service providers and carry their own liability policies.`,
  negligence: `In the event of loss due to the proven negligence of a trip organizer (e.g., leaving bags behind in a locked vehicle they had sole possession of), you may have a claim against the organizer directly. ${APP_NAME} can assist by providing communication records and booking documentation to support your claim, but cannot adjudicate disputes over lost property.`,
  insurance: `We strongly recommend purchasing travel insurance that covers loss of baggage and personal belongings. For high-value items (cameras, laptops, jewellery), consider declaring them separately in your insurance policy.`,
}

export const lostItemPreventionTips = [
  'Do not carry unnecessary valuables (expensive jewellery, large amounts of cash) on group trips, especially to remote or adventure destinations.',
  'Use a padlock on your bags when leaving them unattended in shared transport or dormitory accommodation.',
  'Label your bags and belongings with your name and contact number — even a piece of tape with a phone number can help reunite you with a lost bag.',
  'Keep important documents (ID, permits) and your phone with you at all times, not in checked luggage or bags stored in the vehicle boot.',
  'Do a final check of all seats, shelves, and charging points before disembarking from any vehicle or leaving any accommodation.',
  'Take a photo of your bags before each trip stage so you can easily describe them if needed.',
]

export const lostItemAccommodationText = {
  organiserBooked: `If you left an item at a hotel, hostel, campsite, or homestay that was booked by the organizer as part of your trip package, contact the organizer first — they will have the accommodation's contact details and check-out records.`,
  selfBooked: `If the accommodation was booked directly by you (outside of the trip package), you will need to contact the property directly. ${APP_NAME} cannot assist with items lost at self-arranged accommodation.`,
}
