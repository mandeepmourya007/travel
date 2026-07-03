/**
 * Refund test seed — creates user mandeepmourya007@gmail.com with 8 bookings
 * covering every meaningful refund scenario across both Razorpay and Cashfree.
 *
 * Run inside Docker: docker exec travel-api npx tsx prisma/seed-refund-test.ts
 *
 * Scenarios seeded:
 *  Razorpay:
 *   1. FLEXIBLE, >48h  → 100% refund
 *   2. MODERATE, <48h  → 0% refund
 *   3. STRICT          → 0% refund
 *   4. FLEXIBLE, retry → INITIATED refund exists (retry path)
 *  Cashfree:
 *   5. FLEXIBLE, >48h  → 100% refund
 *   6. MODERATE, <48h  → 0% refund
 *   7. STRICT          → 0% refund
 *   8. FLEXIBLE, retry → INITIATED refund exists (retry path)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TARGET_EMAIL = 'mandeepmourya007@gmail.com'

// Booking IDs — all valid hex UUIDs (no 's' in last segment)
const BK_RZP_FLEX   = '019f2665-bac3-7001-8000-5eed00000010'
const BK_RZP_MOD    = '019f2665-bac3-7001-8000-5eed00000011'
const BK_RZP_STRICT = '019f2665-bac3-7001-8000-5eed00000012'
const BK_RZP_RETRY  = '019f2665-bac3-7001-8000-5eed00000014'
const BK_CF_FLEX    = '019f2665-bac3-7001-8000-5eed00000013'
const BK_CF_MOD     = '019f2665-bac3-7001-8000-5eed00000015'
const BK_CF_STRICT  = '019f2665-bac3-7001-8000-5eed00000016'
const BK_CF_RETRY   = '019f2665-bac3-7001-8000-5eed00000017'

// PaymentTransaction IDs
const PTX_RZP_FLEX_CAP   = '019f2665-bac3-7001-8000-5eed00000020'
const PTX_RZP_MOD_CAP    = '019f2665-bac3-7001-8000-5eed00000021'
const PTX_RZP_STRICT_CAP = '019f2665-bac3-7001-8000-5eed00000022'
const PTX_CF_FLEX_CAP    = '019f2665-bac3-7001-8000-5eed00000023'
const PTX_RZP_RETRY_CAP  = '019f2665-bac3-7001-8000-5eed00000024'
const PTX_RZP_RETRY_REF  = '019f2665-bac3-7001-8000-5eed00000025'
const PTX_CF_MOD_CAP     = '019f2665-bac3-7001-8000-5eed00000026'
const PTX_CF_STRICT_CAP  = '019f2665-bac3-7001-8000-5eed00000027'
const PTX_CF_RETRY_CAP   = '019f2665-bac3-7001-8000-5eed00000028'
const PTX_CF_RETRY_REF   = '019f2665-bac3-7001-8000-5eed00000029'

// TravelerDetail IDs (one digit suffix per booking)
const TD_BASE = '019f2665-bac3-7001-8000-5eed0000003'

async function main() {
  console.log('\n🌱 Seeding refund-test data for mandeepmourya007@gmail.com\n')

  // Need 4 FLEXIBLE + 1 MODERATE + 1 STRICT for Razorpay,
  // plus 4 more FLEXIBLE + 1 MODERATE + 1 STRICT for Cashfree = 6 FLEXIBLE, 2 MODERATE, 2 STRICT
  // But Razorpay and Cashfree bookings can share trips as long as userId+tripId is unique per row.
  // Since it's the same userId, each booking needs a distinct tripId.
  const flexTrips = await prisma.trip.findMany({
    where: {
      isDeleted: false,
      status: 'ACTIVE',
      cancellationPolicy: 'FLEXIBLE',
      startDate: { gt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, title: true, pricePerPerson: true, startDate: true },
    orderBy: { startDate: 'asc' },
    take: 4,  // bookings 1 (RZP_FLEX), 4 (RZP_RETRY), 5 (CF_FLEX), 8 (CF_RETRY)
  })

  const modTrips = await prisma.trip.findMany({
    where: { isDeleted: false, status: 'ACTIVE', cancellationPolicy: 'MODERATE', startDate: { gt: new Date() } },
    select: { id: true, title: true, pricePerPerson: true, startDate: true },
    orderBy: { startDate: 'asc' },
    take: 2,  // bookings 2 (RZP_MOD), 6 (CF_MOD)
  })

  const strictTrips = await prisma.trip.findMany({
    where: { isDeleted: false, status: 'ACTIVE', cancellationPolicy: 'STRICT', startDate: { gt: new Date() } },
    select: { id: true, title: true, pricePerPerson: true, startDate: true },
    orderBy: { startDate: 'asc' },
    take: 2,  // bookings 3 (RZP_STRICT), 7 (CF_STRICT)
  })

  if (flexTrips.length < 4) throw new Error(`Need 4 FLEXIBLE trips, found ${flexTrips.length}. Run main seed first.`)
  if (modTrips.length < 2) throw new Error(`Need 2 MODERATE trips, found ${modTrips.length}. Run main seed first.`)
  if (strictTrips.length < 2) throw new Error(`Need 2 STRICT trips, found ${strictTrips.length}. Run main seed first.`)

  const [tripRzpFlex, tripRzpRetry, tripCfFlex, tripCfRetry] = flexTrips
  const [tripRzpMod, tripCfMod] = modTrips
  const [tripRzpStrict, tripCfStrict] = strictTrips

  // ── Find or create user ─────────────────────────────────────────────────────
  let user = await prisma.user.findFirst({ where: { email: TARGET_EMAIL, isDeleted: false } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Mandeep Mourya',
        email: TARGET_EMAIL,
        passwordHash: null,
        role: 'TRAVELER',
        isActive: true,
        isDeleted: false,
        emailVerified: true,
        phoneVerified: false,
      },
    })
    console.log(`  ✓ Created user: ${user.email} (id: ${user.id})`)
  } else {
    console.log(`  ✓ Found existing user: ${user.email} (id: ${user.id})`)
  }
  const USER_ID = user.id

  // ── Wallet ──────────────────────────────────────────────────────────────────
  await prisma.wallet.upsert({
    where: { userId: USER_ID },
    create: { userId: USER_ID, balance: 0, currency: 'INR', isActive: true, isDeleted: false },
    update: {},
  })

  // ── Helper: delete-then-create a booking cleanly ────────────────────────────
  async function upsertBooking(params: {
    bookingId: string
    bookingRef: string
    tripId: string
    totalAmount: number
    status: string
    paymentTxs: Array<{
      id: string
      type: string
      status: string
      amount: number
      provider: string
      gatewayOrderId?: string
      gatewayPaymentId?: string
      gatewayRefundId?: string
      razorpayOrderId?: string
      razorpayPaymentId?: string
      razorpayRefundId?: string
      metadata?: object
    }>
    travelers: Array<{ id: string; name: string; phone: string; age: number; gender: string; isPrimary: boolean }>
  }) {
    await prisma.paymentTransaction.deleteMany({ where: { bookingId: params.bookingId } })
    await prisma.travelerDetail.deleteMany({ where: { bookingId: params.bookingId } })
    await prisma.booking.deleteMany({ where: { id: params.bookingId } })

    await prisma.booking.create({
      data: {
        id: params.bookingId,
        bookingRef: params.bookingRef,
        tripId: params.tripId,
        userId: USER_ID,
        numTravelers: params.travelers.length,
        totalAmount: params.totalAmount,
        tripProtection: false,
        bookingStatus: params.status as never,
        isActive: true,
        isDeleted: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    for (const tx of params.paymentTxs) {
      await prisma.paymentTransaction.create({
        data: {
          id: tx.id,
          bookingId: params.bookingId,
          type: tx.type as never,
          status: tx.status as never,
          amount: tx.amount,
          currency: 'INR',
          provider: tx.provider,
          gatewayOrderId: tx.gatewayOrderId ?? tx.razorpayOrderId ?? null,
          gatewayPaymentId: tx.gatewayPaymentId ?? tx.razorpayPaymentId ?? null,
          gatewayRefundId: tx.gatewayRefundId ?? tx.razorpayRefundId ?? null,
          razorpayOrderId: tx.razorpayOrderId ?? tx.gatewayOrderId ?? null,
          razorpayPaymentId: tx.razorpayPaymentId ?? tx.gatewayPaymentId ?? null,
          razorpayRefundId: tx.razorpayRefundId ?? tx.gatewayRefundId ?? null,
          metadata: (tx.metadata ?? {}) as never,
        },
      })
    }

    for (const td of params.travelers) {
      await prisma.travelerDetail.create({
        data: {
          id: td.id,
          bookingId: params.bookingId,
          name: td.name,
          phone: td.phone,
          age: td.age,
          gender: td.gender as never,
          isPrimary: td.isPrimary,
          isActive: true,
          isDeleted: false,
        },
      })
    }
  }

  // Each booking gets its own traveler ID derived from the booking's last hex digit block
  const traveler = (bookingId: string) => [
    { id: bookingId.replace(/-/g, '').slice(0, 8) + '-' + bookingId.slice(9, 13) + '-7001-9000-' + bookingId.slice(-12), name: 'Mandeep Mourya', phone: '9876543210', age: 28, gender: 'MALE', isPrimary: true },
  ]

  // ──────────────────────────────────────────────────────────────────────────
  // RAZORPAY bookings
  // ──────────────────────────────────────────────────────────────────────────

  // 1. Razorpay · FLEXIBLE · >48h → 100% refund
  await upsertBooking({
    bookingId: BK_RZP_FLEX, bookingRef: 'TCB-TEST-RZP-FLEX',
    tripId: tripRzpFlex.id, totalAmount: tripRzpFlex.pricePerPerson, status: 'CONFIRMED',
    paymentTxs: [{ id: PTX_RZP_FLEX_CAP, type: 'PAYMENT', status: 'CAPTURED', amount: tripRzpFlex.pricePerPerson, provider: 'razorpay', razorpayOrderId: 'order_test_rzp_flex_001', razorpayPaymentId: 'pay_test_rzp_flex_001' }],
    travelers: traveler(BK_RZP_FLEX),
  })
  console.log(`  ✓ [1] Razorpay FLEXIBLE >48h  · ${tripRzpFlex.title} · ₹${tripRzpFlex.pricePerPerson}`)

  // 2. Razorpay · MODERATE · trip shifted to 24h → 0% refund
  await upsertBooking({
    bookingId: BK_RZP_MOD, bookingRef: 'TCB-TEST-RZP-MOD',
    tripId: tripRzpMod.id, totalAmount: tripRzpMod.pricePerPerson * 2, status: 'CONFIRMED',
    paymentTxs: [{ id: PTX_RZP_MOD_CAP, type: 'PAYMENT', status: 'CAPTURED', amount: tripRzpMod.pricePerPerson * 2, provider: 'razorpay', razorpayOrderId: 'order_test_rzp_mod_001', razorpayPaymentId: 'pay_test_rzp_mod_001' }],
    travelers: [
      { id: BK_RZP_MOD.replace('8000', '9001'), name: 'Mandeep Mourya', phone: '9876543210', age: 28, gender: 'MALE', isPrimary: true },
      { id: BK_RZP_MOD.replace('8000', '9002'), name: 'Priya Sharma', phone: '9123456780', age: 25, gender: 'FEMALE', isPrimary: false },
    ],
  })
  await prisma.trip.update({ where: { id: tripRzpMod.id }, data: { startDate: new Date(Date.now() + 24 * 60 * 60 * 1000) } })
  console.log(`  ✓ [2] Razorpay MODERATE <48h   · ${tripRzpMod.title} · ₹${tripRzpMod.pricePerPerson * 2} [startDate → 24h]`)

  // 3. Razorpay · STRICT → 0% refund
  await upsertBooking({
    bookingId: BK_RZP_STRICT, bookingRef: 'TCB-TEST-RZP-STRICT',
    tripId: tripRzpStrict.id, totalAmount: tripRzpStrict.pricePerPerson, status: 'CONFIRMED',
    paymentTxs: [{ id: PTX_RZP_STRICT_CAP, type: 'PAYMENT', status: 'CAPTURED', amount: tripRzpStrict.pricePerPerson, provider: 'razorpay', razorpayOrderId: 'order_test_rzp_strict_001', razorpayPaymentId: 'pay_test_rzp_strict_001' }],
    travelers: traveler(BK_RZP_STRICT),
  })
  console.log(`  ✓ [3] Razorpay STRICT          · ${tripRzpStrict.title} · ₹${tripRzpStrict.pricePerPerson}`)

  // 4. Razorpay · FLEXIBLE · INITIATED refund exists (retry)
  const rzpRetryAmt = tripRzpRetry.pricePerPerson
  await upsertBooking({
    bookingId: BK_RZP_RETRY, bookingRef: 'TCB-TEST-RZP-RETRY',
    tripId: tripRzpRetry.id, totalAmount: rzpRetryAmt, status: 'CONFIRMED',
    paymentTxs: [
      { id: PTX_RZP_RETRY_CAP, type: 'PAYMENT', status: 'CAPTURED', amount: rzpRetryAmt, provider: 'razorpay', razorpayOrderId: 'order_test_rzp_retry_001', razorpayPaymentId: 'pay_test_rzp_retry_001' },
      { id: PTX_RZP_RETRY_REF, type: 'REFUND', status: 'INITIATED', amount: rzpRetryAmt, provider: 'razorpay', razorpayOrderId: 'order_test_rzp_retry_001', metadata: { reason: 'Changed my plans', retryCount: 1 } },
    ],
    travelers: traveler(BK_RZP_RETRY),
  })
  console.log(`  ✓ [4] Razorpay FLEXIBLE retry  · ${tripRzpRetry.title} · ₹${rzpRetryAmt}`)

  // ──────────────────────────────────────────────────────────────────────────
  // CASHFREE bookings
  // ──────────────────────────────────────────────────────────────────────────

  // 5. Cashfree · FLEXIBLE · >48h → 100% refund
  await upsertBooking({
    bookingId: BK_CF_FLEX, bookingRef: 'TCB-TEST-CF-FLEX',
    tripId: tripCfFlex.id, totalAmount: tripCfFlex.pricePerPerson, status: 'CONFIRMED',
    paymentTxs: [{ id: PTX_CF_FLEX_CAP, type: 'PAYMENT', status: 'CAPTURED', amount: tripCfFlex.pricePerPerson, provider: 'cashfree', gatewayOrderId: 'TCB-TEST-CF-FLEX', gatewayPaymentId: '789001234' }],
    travelers: traveler(BK_CF_FLEX),
  })
  console.log(`  ✓ [5] Cashfree FLEXIBLE >48h   · ${tripCfFlex.title} · ₹${tripCfFlex.pricePerPerson}`)

  // 6. Cashfree · MODERATE · trip shifted to 24h → 0% refund
  await upsertBooking({
    bookingId: BK_CF_MOD, bookingRef: 'TCB-TEST-CF-MOD',
    tripId: tripCfMod.id, totalAmount: tripCfMod.pricePerPerson, status: 'CONFIRMED',
    paymentTxs: [{ id: PTX_CF_MOD_CAP, type: 'PAYMENT', status: 'CAPTURED', amount: tripCfMod.pricePerPerson, provider: 'cashfree', gatewayOrderId: 'TCB-TEST-CF-MOD', gatewayPaymentId: '789001235' }],
    travelers: traveler(BK_CF_MOD),
  })
  await prisma.trip.update({ where: { id: tripCfMod.id }, data: { startDate: new Date(Date.now() + 24 * 60 * 60 * 1000) } })
  console.log(`  ✓ [6] Cashfree MODERATE <48h   · ${tripCfMod.title} · ₹${tripCfMod.pricePerPerson} [startDate → 24h]`)

  // 7. Cashfree · STRICT → 0% refund
  await upsertBooking({
    bookingId: BK_CF_STRICT, bookingRef: 'TCB-TEST-CF-STRICT',
    tripId: tripCfStrict.id, totalAmount: tripCfStrict.pricePerPerson, status: 'CONFIRMED',
    paymentTxs: [{ id: PTX_CF_STRICT_CAP, type: 'PAYMENT', status: 'CAPTURED', amount: tripCfStrict.pricePerPerson, provider: 'cashfree', gatewayOrderId: 'TCB-TEST-CF-STRICT', gatewayPaymentId: '789001236' }],
    travelers: traveler(BK_CF_STRICT),
  })
  console.log(`  ✓ [7] Cashfree STRICT          · ${tripCfStrict.title} · ₹${tripCfStrict.pricePerPerson}`)

  // 8. Cashfree · FLEXIBLE · INITIATED refund exists (retry)
  const cfRetryAmt = tripCfRetry.pricePerPerson
  await upsertBooking({
    bookingId: BK_CF_RETRY, bookingRef: 'TCB-TEST-CF-RETRY',
    tripId: tripCfRetry.id, totalAmount: cfRetryAmt, status: 'CONFIRMED',
    paymentTxs: [
      { id: PTX_CF_RETRY_CAP, type: 'PAYMENT', status: 'CAPTURED', amount: cfRetryAmt, provider: 'cashfree', gatewayOrderId: 'TCB-TEST-CF-RETRY', gatewayPaymentId: '789001237' },
      { id: PTX_CF_RETRY_REF, type: 'REFUND', status: 'INITIATED', amount: cfRetryAmt, provider: 'cashfree', gatewayOrderId: 'TCB-TEST-CF-RETRY', metadata: { reason: 'Changed my plans', retryCount: 1 } },
    ],
    travelers: traveler(BK_CF_RETRY),
  })
  console.log(`  ✓ [8] Cashfree FLEXIBLE retry  · ${tripCfRetry.title} · ₹${cfRetryAmt}`)

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────────')
  console.log('  POST /api/v1/bookings/:id/cancel  |  Body: { "reason": "Changed my plans" }')
  console.log('─────────────────────────────────────────────────────────────────')
  console.log('\n  RAZORPAY bookings:')
  console.log(`   [1] ${BK_RZP_FLEX}   FLEXIBLE >48h   → 100% refund (₹${tripRzpFlex.pricePerPerson})`)
  console.log(`   [2] ${BK_RZP_MOD}   MODERATE <48h   → 0% refund`)
  console.log(`   [3] ${BK_RZP_STRICT}   STRICT          → 0% refund`)
  console.log(`   [4] ${BK_RZP_RETRY}   FLEXIBLE retry  → retries gateway`)
  console.log('\n  CASHFREE bookings:')
  console.log(`   [5] ${BK_CF_FLEX}   FLEXIBLE >48h   → 100% refund (₹${tripCfFlex.pricePerPerson})`)
  console.log(`   [6] ${BK_CF_MOD}   MODERATE <48h   → 0% refund`)
  console.log(`   [7] ${BK_CF_STRICT}   STRICT          → 0% refund`)
  console.log(`   [8] ${BK_CF_RETRY}   FLEXIBLE retry  → retries gateway`)
  console.log('─────────────────────────────────────────────────────────────────\n')
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
