import type { NotificationType } from '@prisma/client'
import { env } from '../config/env'

const APP_NAME = 'Safarnama'
const CLIENT_URL = env.CLIENT_URL

const BRAND_COLOR = '#0FBAB5'
const BRAND_BG = '#E0FFFE'

function baseLayout(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafb;font-family:'Inter',system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <tr><td>
      <div style="background:${BRAND_COLOR};border-radius:12px 12px 0 0;padding:20px 24px;">
        <span style="font-size:20px;font-weight:800;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;">${APP_NAME}</span>
      </div>
      <div style="background:#fff;border:1px solid #e2e7eb;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px;">
        ${content}
      </div>
      <div style="text-align:center;padding:20px 0;color:#9aa5b1;font-size:12px;">
        &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
      </div>
    </td></tr>
  </table>
</body>
</html>`
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#1f2937;">${text}</h2>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:#4e5a65;line-height:1.6;">${text}</p>`
}

function highlight(text: string): string {
  return `<div style="background:${BRAND_BG};border-radius:8px;padding:14px 16px;margin:0 0 16px;font-size:14px;color:#077e7a;font-weight:600;">${text}</div>`
}

function cta(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">${label}</a>`
}

// ── Template registry ──────────────────────────────────

interface TemplateResult {
  subject: string
  html: string
  text: string
}

type TemplateData = Record<string, unknown> | undefined

function bookingConfirmed(title: string, body: string, data: TemplateData): TemplateResult {
  const tripName = (data?.tripName as string) || 'your trip'
  const bookingId = (data?.bookingId as string) || ''
  return {
    subject: `Booking Confirmed — ${tripName}`,
    html: baseLayout(
      heading('Booking Confirmed!') +
      paragraph(body) +
      (bookingId ? highlight(`Booking ID: ${bookingId}`) : '') +
      paragraph('Your payment is safely held in escrow until the trip is completed.') +
      cta('View My Bookings', `${CLIENT_URL}/bookings`),
    ),
    text: `${title}\n\n${body}`,
  }
}

function bookingCancelled(title: string, body: string, data: TemplateData): TemplateResult {
  const tripName = (data?.tripName as string) || 'your trip'
  return {
    subject: `Booking Cancelled — ${tripName}`,
    html: baseLayout(
      heading('Booking Cancelled') +
      paragraph(body) +
      paragraph('If eligible, your refund will be processed according to the cancellation policy.'),
    ),
    text: `${title}\n\n${body}`,
  }
}

function paymentReceived(title: string, body: string, data: TemplateData): TemplateResult {
  const amount = (data?.amount as string) || ''
  const tripName = (data?.tripName as string) || 'a trip'
  return {
    subject: `Payment Received — ${tripName}`,
    html: baseLayout(
      heading('Payment Received') +
      paragraph(body) +
      (amount ? highlight(`Amount: ${amount}`) : '') +
      cta('View Dashboard', `${CLIENT_URL}/dashboard`),
    ),
    text: `${title}\n\n${body}`,
  }
}

function tripRequestApproved(title: string, body: string, data: TemplateData): TemplateResult {
  const tripName = (data?.tripName as string) || 'the trip'
  return {
    subject: `Request Approved — ${tripName}`,
    html: baseLayout(
      heading('Your Request Was Approved!') +
      paragraph(body) +
      highlight('You have 48 hours to complete your payment.') +
      cta('Complete Payment', `${CLIENT_URL}/bookings`),
    ),
    text: `${title}\n\n${body}\n\nYou have 48 hours to complete your payment.`,
  }
}

function organizerApproved(title: string, body: string, _data: TemplateData): TemplateResult {
  return {
    subject: 'Your Organizer Profile Is Approved!',
    html: baseLayout(
      heading(`Welcome to ${APP_NAME}!`) +
      paragraph(body) +
      paragraph('You can now create and publish trips on the platform.') +
      cta('Go to Dashboard', `${CLIENT_URL}/dashboard`),
    ),
    text: `${title}\n\n${body}`,
  }
}

function organizerRejected(title: string, body: string, _data: TemplateData): TemplateResult {
  return {
    subject: 'Organizer Application Update',
    html: baseLayout(
      heading('Application Update') +
      paragraph(body) +
      paragraph('If you have questions, please contact our support team.'),
    ),
    text: `${title}\n\n${body}`,
  }
}

function reviewRequest(title: string, body: string, data: TemplateData): TemplateResult {
  const tripName = (data?.tripName as string) || 'your trip'
  const tripSlug = (data?.tripSlug as string) || ''
  return {
    subject: `How was ${tripName}? Share your experience`,
    html: baseLayout(
      heading('Share Your Experience!') +
      paragraph(body) +
      paragraph('Your review helps fellow travelers make better decisions and rewards great organizers.') +
      cta('Leave a Review', tripSlug ? `${CLIENT_URL}/trips/${tripSlug}#reviews` : `${CLIENT_URL}/bookings`),
    ),
    text: `${title}\n\n${body}\n\nLeave a review: ${CLIENT_URL}/bookings`,
  }
}

function tripReminder(title: string, body: string, data: TemplateData): TemplateResult {
  const tripName = (data?.tripName as string) || 'your upcoming trip'
  const pickupTime = (data?.pickupTime as string) || ''
  const pickupLabel = (data?.pickupLabel as string) || ''
  const tripSlug = (data?.tripSlug as string) || ''
  const pickupDetails = pickupLabel || pickupTime
    ? `Pickup: ${[pickupLabel, pickupTime].filter(Boolean).join(' @ ')}`
    : ''
  return {
    subject: `Reminder — ${tripName} is coming up!`,
    html: baseLayout(
      heading(`Your trip is almost here!`) +
      paragraph(body) +
      (pickupDetails ? highlight(pickupDetails) : '') +
      cta('View Trip Details', tripSlug ? `${CLIENT_URL}/trips/${tripSlug}` : `${CLIENT_URL}/bookings`),
    ),
    text: `${title}\n\n${body}${pickupDetails ? `\n\n${pickupDetails}` : ''}`,
  }
}

function walletCreditExpiring(title: string, body: string, data: TemplateData): TemplateResult {
  const amount = (data?.amount as number) || 0
  const daysLeft = (data?.daysLeft as number) || 7
  return {
    subject: `₹${amount} wallet credit expiring in ${daysLeft} days`,
    html: baseLayout(
      heading('Use Your Wallet Balance!') +
      paragraph(body) +
      highlight(`₹${amount} expiring in ${daysLeft} days`) +
      paragraph('Book a trip to use your balance before it expires.') +
      cta('Explore Trips', `${CLIENT_URL}/trips`),
    ),
    text: `${title}\n\n${body}`,
  }
}

function generic(title: string, body: string, _data: TemplateData): TemplateResult {
  return {
    subject: title,
    html: baseLayout(heading(title) + paragraph(body)),
    text: `${title}\n\n${body}`,
  }
}

const templateMap: Partial<Record<NotificationType, (title: string, body: string, data: TemplateData) => TemplateResult>> = {
  BOOKING_CONFIRMED: bookingConfirmed,
  BOOKING_CANCELLED: bookingCancelled,
  PAYMENT_RECEIVED: paymentReceived,
  TRIP_REQUEST_APPROVED: tripRequestApproved,
  ORGANIZER_APPROVED: organizerApproved,
  ORGANIZER_REJECTED: organizerRejected,
  REVIEW_REQUEST: reviewRequest,
  TRIP_REMINDER: tripReminder,
  WALLET_CREDIT_EXPIRING: walletCreditExpiring,
}

export function getEmailTemplate(
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): TemplateResult {
  const builder = templateMap[type] ?? generic
  return builder(title, body, data)
}
