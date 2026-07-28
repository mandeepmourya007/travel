/**
 * One-off manual verification script — NOT part of the app.
 * Drives the real PayoutService.releaseRazorpayXPayout against the real RazorpayX
 * sandbox using the real RazorpayXClient class, for a manually-seeded test booking.
 * Delete after use.
 */
import { PrismaClient } from '@prisma/client'
import Razorpay from 'razorpay'
import pino from 'pino'
import { RazorpayXClient } from '../src/providers/payout/razorpayx.client'
import { PayoutService } from '../src/services/payout.service'
import { PaymentTransactionRepository } from '../src/repositories/payment-transaction.repository'
import { buildIdempotencyKey } from '../src/utils/idempotency'

async function main() {
  const bookingId = process.argv[2]
  if (!bookingId) throw new Error('Usage: tsx verify-razorpayx-payout.ts <bookingId>')

  const logger = pino({ level: 'info' })
  const prisma = new PrismaClient()

  const razorpaySdk = new Razorpay({
    key_id: process.env.RAZORPAYX_KEY_ID!,
    key_secret: process.env.RAZORPAYX_KEY_SECRET!,
  })

  const razorpayxClient = new RazorpayXClient(
    razorpaySdk,
    process.env.RAZORPAYX_ACCOUNT_NUMBER!,
    process.env.RAZORPAYX_WEBHOOK_SECRET || '',
    logger,
  )

  const paymentTxRepo = new PaymentTransactionRepository(prisma)

  // releaseRazorpayXPayout only touches paymentTxRepo + razorpayxClient — bookingRepo/paymentService unused.
  const payoutService = new PayoutService(
    {} as any,
    paymentTxRepo,
    {} as any,
    logger,
    razorpayxClient,
  )

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { trip: { include: { organizer: true } } },
  })
  if (!booking) throw new Error(`Booking ${bookingId} not found`)
  const fundAccountId = booking.trip.organizer.razorpayxFundAccountId
  if (!fundAccountId) throw new Error('Organizer has no razorpayxFundAccountId')

  console.log(`Releasing ₹5000 payout to fund account ${fundAccountId} for booking ${bookingId}...`)

  const result = await payoutService.releaseRazorpayXPayout({
    bookingId,
    bookingRef: booking.bookingRef,
    fundAccountId,
    amountPaise: 500000, // ₹5000.00
    idempotencyKey: buildIdempotencyKey('verify-plan', bookingId),
    notes: { purpose: 'manual-verification' },
  })

  console.log('releaseRazorpayXPayout result:', result)

  const tx = await prisma.paymentTransaction.findFirst({
    where: { bookingId, type: 'PAYOUT_RELEASE' },
  })
  console.log('PAYOUT_RELEASE row:', tx)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
