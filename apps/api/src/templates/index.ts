import type { NotificationType } from '@prisma/client'
import { env } from '../config/env'
import { DEFAULT_SUPPORT_EMAIL } from '../utils/constants'

const APP_NAME = 'Safarnama'
const CLIENT_URL = env.CLIENT_URL
const SUPPORT_EMAIL = env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL

const BRAND_COLOR = '#0FBAB5'
const BRAND_BG = '#E0FFFE'

// heroBlock is rendered full-bleed between the brand header and the padded content area.
// Keeping it outside the padded div avoids the 24px side gutters that width:100% would
// otherwise inherit from the parent's padding.
function baseLayout(content: string, heroBlock = ''): string {
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
      <div style="background:#fff;border:1px solid #e2e7eb;border-top:none;border-radius:0 0 12px 12px;overflow:hidden;">
        ${heroBlock}
        <div style="padding:28px 24px;">
          ${content}
        </div>
      </div>
      <div style="text-align:center;padding:20px 0;color:#9aa5b1;font-size:12px;">
        &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.<br>
        Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#9aa5b1;">${SUPPORT_EMAIL}</a>
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

// Escapes characters that can break out of an HTML attribute value.
function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Only embed https:// URLs — rejects data: URIs, javascript: schemes, and malformed URLs.
function isSafeHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

// Full-bleed hero image block for email.
// - display:block prevents the phantom 4-6px gap email clients add below inline images.
// - width="560" HTML attribute is required by Outlook (Windows) which ignores CSS width:100%.
// - height:auto preserves natural aspect ratio; object-fit is intentionally omitted because
//   it is unsupported in Outlook, Samsung Mail, and older Android webview mail clients.
// - The overflow:hidden wrapper caps tall images and handles border-radius for Outlook,
//   which ignores border-radius applied directly to <img>.
function heroImageBlock(src: string, alt: string): string {
  return `<div style="overflow:hidden;max-height:220px;line-height:0;"><img src="${src}" alt="${alt}" width="560" style="display:block;width:100%;height:auto;"></div>`
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
  const rawImage = (data?.tripImage as string) || ''
  const hero = rawImage && isSafeHttpsUrl(rawImage) ? heroImageBlock(rawImage, escapeAttr(tripName)) : ''
  return {
    subject: `Booking Confirmed — ${tripName}`,
    html: baseLayout(
      heading('Booking Confirmed!') +
      paragraph(body) +
      (bookingId ? highlight(`Booking ID: ${bookingId}`) : '') +
      paragraph('Your payment is safely held via SafePay until the trip is completed.') +
      cta('View My Bookings', `${CLIENT_URL}/bookings`),
      hero,
    ),
    text: `${title}\n\n${body}`,
  }
}

function bookingCancelled(title: string, body: string, data: TemplateData): TemplateResult {
  const tripName = (data?.tripName as string) || 'your trip'
  const refundAmount = data?.refundAmount as number | undefined
  const refundPercent = data?.refundPercent as number | undefined
  const policyUrl = `${CLIENT_URL}/cancellation-policy`
  const hasRefund = refundAmount != null && refundAmount > 0
  return {
    subject: `Booking Cancelled — ${tripName}`,
    html: baseLayout(
      heading('Booking Cancelled') +
      paragraph(body) +
      (hasRefund
        ? highlight(`Refund of ₹${refundAmount?.toLocaleString('en-IN')}${refundPercent != null ? ` (${refundPercent}%)` : ''} will be credited to your original payment method within <strong>4–5 working days</strong>.`)
        : paragraph('No refund is applicable as per the cancellation policy.')) +
      paragraph(`View our <a href="${policyUrl}" style="color:${BRAND_COLOR};text-decoration:underline;">Refund &amp; Cancellation Policy</a> for details.`) +
      cta('View My Bookings', `${CLIENT_URL}/my-bookings`),
    ),
    text: `${title}\n\n${body}\n\n${hasRefund ? `Refund of ₹${refundAmount} will be credited within 4–5 working days.` : 'No refund applicable.'}\n\nRefund & Cancellation Policy: ${policyUrl}`,
  }
}

function refundProcessed(title: string, body: string, data: TemplateData): TemplateResult {
  const tripName = (data?.tripName as string) || 'your trip'
  const refundAmount = data?.refundAmount as number | undefined
  return {
    subject: `Refund Processed — ${tripName}`,
    html: baseLayout(
      heading('Refund Processed') +
      paragraph(body) +
      (refundAmount != null ? highlight(`₹${refundAmount.toLocaleString('en-IN')} will appear in your account within 4–5 working days. Processing times may vary by bank.`) : '') +
      cta('View My Payments', `${CLIENT_URL}/my-payments`),
    ),
    text: `${title}\n\n${body}\n\nProcessing time: 4–5 working days.`,
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
  const tripSlug = (data?.tripSlug as string) || ''
  const rawImage = (data?.tripImage as string) || ''
  const numTravelers = (data?.numTravelers as number) || 1

  const hero = rawImage && isSafeHttpsUrl(rawImage) ? heroImageBlock(rawImage, escapeAttr(tripName)) : ''
  const payUrl = tripSlug ? `${CLIENT_URL}/trips/${escapeAttr(tripSlug)}/book` : `${CLIENT_URL}/my-bookings`
  const travelersLine = numTravelers > 1 ? ` for ${numTravelers} travelers` : ''

  return {
    subject: `Your request for ${tripName} is approved — complete payment now`,
    html: baseLayout(
      heading('Great news — you\'re approved!') +
      `<p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1f2937;">${escapeAttr(tripName)}</p>` +
      paragraph(`Your request${travelersLine} has been approved by the organizer. Secure your spot before the window closes.`) +
      highlight('You have <strong>48 hours</strong> to complete your payment — after that, the spot is released.') +
      paragraph('Click the button below to go directly to the payment page:') +
      `<div style="margin:8px 0 24px;">${cta('Complete Payment Now', payUrl)}</div>` +
      `<p style="margin:0;font-size:13px;color:#9aa5b1;">If the button doesn't work, copy this link: <a href="${payUrl}" style="color:#0FBAB5;word-break:break-all;">${payUrl}</a></p>`,
      hero,
    ),
    text: `${title}\n\n${tripName}\n\n${body}\n\nComplete your payment here: ${payUrl}\n\nYou have 48 hours before the spot is released.`,
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

export function organizerInviteTemplate(signupUrl: string): { subject: string; html: string; text: string } {
  return {
    subject: `You're invited to join ${APP_NAME} as a Trip Organizer`,
    html: baseLayout(
      heading(`You've been invited to ${APP_NAME}!`) +
      paragraph(`You've been selected to join <strong>${APP_NAME}</strong> as a verified Trip Organizer — create memorable group travel experiences and build your business on our platform.`) +
      paragraph('Click the button below to set up your account. This invite link is valid for <strong>7 days</strong>.') +
      `<div style="text-align:center;margin:28px 0;">` +
        cta('Create Your Organizer Account', signupUrl) +
      `</div>` +
      `<hr style="border:none;border-top:1px solid #e2e7eb;margin:24px 0;">` +
      paragraph(`<span style="font-size:13px;color:#9aa5b1;">Or copy this link into your browser:<br><a href="${signupUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${signupUrl}</a></span>`) +
      paragraph('<span style="font-size:13px;color:#9aa5b1;">If you weren\'t expecting this email, you can safely ignore it.</span>'),
    ),
    text: `You've been invited to join ${APP_NAME} as a Trip Organizer.\n\nCreate your account here: ${signupUrl}\n\nThis link expires in 7 days.`,
  }
}

const templateMap: Partial<Record<NotificationType, (title: string, body: string, data: TemplateData) => TemplateResult>> = {
  BOOKING_CONFIRMED: bookingConfirmed,
  BOOKING_CANCELLED: bookingCancelled,
  PAYMENT_RECEIVED: paymentReceived,
  REFUND_PROCESSED: refundProcessed,
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
