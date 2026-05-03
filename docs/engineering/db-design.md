# Production-Grade Database Design — Group Travel Aggregator

Complete database schema with 3NF normalization, ACID transactions, FK constraints, race-condition handling, soft-delete mixin, audit timestamps, optimized indexes, and a future-tables roadmap.

> **Related docs:**
> - [`tech-stack.md`](./tech-stack.md) — Full tech spec (Prisma schema lives in Section 10)
> - [`mvp-plan.md`](../mvp/mvp-plan.md) — MVP scope + DB summary in Section 6

---

## 1. Design Principles

| Principle | Implementation |
|-----------|---------------|
| **ACID compliance** | All multi-table writes via Prisma `$transaction`. No partial updates. |
| **Normalization (3NF)** | All columns atomic (1NF). No partial dependencies (2NF). No transitive dependencies (3NF). Materialized caches documented explicitly. |
| **Soft-delete everywhere** | Every model has `isActive`, `isDeleted`, `deletedAt` mixin. NEVER hard-delete rows. Prisma middleware auto-filters `isDeleted = false`. |
| **Audit timestamps** | `createdAt`, `updatedAt` on every table. `deletedAt` on soft-deletable tables. |
| **Race condition prevention** | Optimistic locking (`version` column) + atomic SQL for seat booking. Idempotent webhooks. |
| **Query-optimized indexing** | Composite indexes matching actual query patterns. No over-indexing. |
| **Immutable financial records** | `PaymentTransaction` and `WebhookEvent` have no soft-delete — audit trail is permanent. |
| **Indian Rupees** | All monetary values stored as `Int` (whole rupees, not paisa). ₹4500 = `4500`. |

---

## 2. Soft-Delete Mixin

Applied to every table **except** audit tables (`PaymentTransaction`, `WebhookEvent`, `RefreshToken`, `VerificationCode`, `TripEditHistory`).

```prisma
// Every model includes these 5 fields:
isActive     Boolean   @default(true)    // Toggleable (deactivate without delete)
isDeleted    Boolean   @default(false)   // Soft-delete flag
createdAt    DateTime  @default(now())
updatedAt    DateTime  @updatedAt
deletedAt    DateTime?                   // When soft-deleted

// RULES:
// 1. NEVER hard-delete rows. Set isDeleted=true, isActive=false, deletedAt=now().
// 2. All repository queries MUST include: WHERE isDeleted = false.
// 3. Prisma middleware enforces this automatically (see prisma-soft-delete.ts).
// 4. isActive can be toggled independently (e.g., deactivate user without deleting).
```

### Prisma Client Extensions (Auto-Enforcement)

> **Why Client Extensions?** `prisma.$use()` was deprecated in Prisma v4.16 and removed in v5.x.
> Client Extensions are the official, type-safe replacement used by production platforms.

```typescript
// lib/prisma.ts — singleton with soft-delete extensions
import { PrismaClient } from '@prisma/client'

const SOFT_DELETE_MODELS = [
  'User', 'OrganizerProfile', 'Destination', 'Trip', 'Booking',
  'TravelerDetail', 'Review', 'Conversation', 'Message',
  'Notification', 'TripRequest',
] as const

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
})

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      // Auto-filter deleted records on reads
      async findMany({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as any)) {
          args.where = { ...args.where, isDeleted: false }
        }
        return query(args)
      },
      async findFirst({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as any)) {
          args.where = { ...args.where, isDeleted: false }
        }
        return query(args)
      },
      async findUnique({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as any)) {
          args.where = { ...args.where, isDeleted: false } as any
        }
        return query(args)
      },
      // Intercept delete → soft delete
      async delete({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as any)) {
          return (basePrisma[model as any] as any).update({
            where: args.where,
            data: { isDeleted: true, isActive: false, deletedAt: new Date() },
          })
        }
        return query(args)
      },
      async deleteMany({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as any)) {
          return (basePrisma[model as any] as any).updateMany({
            where: args.where,
            data: { isDeleted: true, isActive: false, deletedAt: new Date() },
          })
        }
        return query(args)
      },
    },
  },
})

export type ExtendedPrismaClient = typeof prisma

// Singleton pattern for Next.js hot-reload (prevents connection leaks)
const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrismaClient }
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Bypass soft-delete for admin queries** (e.g., audit, analytics):
```typescript
// Use basePrisma directly when you need to include deleted records
import { basePrisma } from '@/lib/prisma'
const allUsersIncludingDeleted = await basePrisma.user.findMany()
```

---

## 3. Audit of Previous Schema (Problems Found & Fixed)

| # | Problem | Severity | Fix Applied |
|---|---------|----------|-------------|
| 1 | No `RefreshToken` table — can't revoke tokens or track sessions | High | Added `RefreshToken` table |
| 2 | No `PaymentTransaction` — single `amountPaid` int can't track retries, partial refunds, escrow release | High | Added `PaymentTransaction` table; removed payment columns from `Booking` |
| 3 | No `Notification` — no tracking for email/SMS/push delivery | Medium | Added `Notification` table |
| 4 | No `Destination` — free-text string causes duplicates ("Goa" vs "goa" vs "North Goa"), blocks trending/SEO | High | Added `Destination` lookup table; `Trip.destination` → `Trip.destinationId` FK |
| 5 | `Trip.currentBookings` race condition — no optimistic locking | High | Added `version Int` column for optimistic locking |
| 6 | `Booking.travelerDetails` is JSON — violates 1NF, can't query demographics | Medium | Extracted to `TravelerDetail` table |
| 7 | No `readAt` on `Message` — can't show unread count badges | Medium | Added `readAt DateTime?` |
| 8 | No `VerificationCode` table — needed for OTP, password reset | Medium | Added `VerificationCode` table |
| 9 | No `cancellationReason` on `Booking` — needed for refund disputes | Medium | Added `cancellationReason`, `cancelledAt`, `cancelledBy` |
| 10 | No CHECK constraints — prices can be negative, ratings out of range | Medium | Added DB-level constraints (documented, enforced via service + Zod) |
| 11 | No duplicate-booking prevention (same user + same trip) | Medium | Service-layer check inside `$transaction` |
| 12 | `OrganizerProfile` missing `bankAccountLinked` — needed before escrow release | Medium | Added column |

---

## 4. MVP Tables (15)

### Table Overview

| # | Table | New? | Soft-Delete? | Purpose |
|---|-------|------|-------------|---------|
| 1 | **User** | — | ✅ | All platform users (traveler, organizer, admin) |
| 2 | **OrganizerProfile** | — | ✅ | Extended organizer info (1:1 with User) |
| 3 | **Destination** | ✅ NEW | ✅ | Normalized city/destination lookup for search + SEO |
| 4 | **Trip** | — | ✅ | Trip listings with pricing, dates, capacity |
| 5 | **Booking** | — | ✅ | Trip bookings with full lifecycle |
| 6 | **TravelerDetail** | ✅ NEW | ✅ | Per-traveler info per booking OR trip request (1NF compliant) |
| 7 | **PaymentTransaction** | ✅ NEW | ❌ | Full payment/refund/escrow audit trail |
| 8 | **Review** | — | ✅ | Post-trip verified reviews (multi-dimension) |
| 9 | **Conversation** | — | ✅ | 1:1 chat threads (traveler ↔ organizer per trip) |
| 10 | **Message** | — | ✅ | Individual chat messages with read tracking |
| 11 | **RefreshToken** | ✅ NEW | ❌ | JWT refresh tokens — session management + revocation |
| 12 | **VerificationCode** | ✅ NEW | ❌ | OTP + password reset codes with expiry + attempts |
| 13 | **Notification** | ✅ NEW | ✅ | Email/SMS/push notification delivery log |
| 14 | **WebhookEvent** | — | ❌ | Razorpay webhook audit log (idempotency) |
| 15 | **TripRequest** | ✅ NEW | ✅ | Join request lifecycle — traveler requests, organizer approves/rejects |

---

### Enums

```prisma
enum UserRole {
  TRAVELER
  ORGANIZER
  ADMIN
}

enum VerificationStatus {
  PENDING
  APPROVED
  REJECTED
}

enum TripStatus {
  DRAFT
  ACTIVE
  FULL
  COMPLETED
  CANCELLED
}

enum TripType {
  ADVENTURE
  WEEKEND
  TREKKING
  BEACH
  CULTURAL
  ROAD_TRIP
}

enum CancellationPolicy {
  FLEXIBLE       // Full refund 48h before
  MODERATE       // Full refund 72h, 50% after
  STRICT         // No refunds
}

enum BookingStatus {
  PENDING_PAYMENT
  CONFIRMED
  CANCELLED
  COMPLETED
  REFUNDED
  EXPIRED        // Auto-expired after 30min of no payment
}

enum PaymentType {
  PAYMENT
  REFUND
  ESCROW_RELEASE
}

enum PaymentStatus {
  INITIATED
  CAPTURED
  FAILED
  REFUNDED
}

enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY
}

enum NotificationChannel {
  EMAIL
  SMS
  PUSH
  IN_APP
}

enum NotificationType {
  BOOKING_CONFIRMED
  BOOKING_CANCELLED
  PAYMENT_RECEIVED
  PAYMENT_FAILED
  REFUND_PROCESSED
  TRIP_REMINDER
  REVIEW_REQUEST
  CHAT_MESSAGE
  ORGANIZER_APPROVED
  ORGANIZER_REJECTED
  TRIP_REQUEST_RECEIVED     // Organizer: new join request
  TRIP_REQUEST_APPROVED     // Traveler: your request was approved, pay now
  TRIP_REQUEST_REJECTED     // Traveler: your request was declined
  SYSTEM_ALERT
}

enum VerificationCodeType {
  EMAIL_VERIFY
  PHONE_OTP
  PASSWORD_RESET
}

enum BookingMode {
  INSTANT          // Traveler pays directly — no organizer approval needed
  REQUEST_BASED    // Traveler requests → organizer approves → then traveler pays
}

enum TripRequestStatus {
  PENDING          // Traveler sent request, waiting for organizer
  APPROVED         // Organizer accepted — traveler can now book & pay
  REJECTED         // Organizer declined
  EXPIRED          // Traveler didn't pay within approval window
  CONVERTED        // Traveler completed booking after approval
}
```

---

### Table Schemas (Prisma)

#### 1. User

```prisma
model User {
  id              String    @id @default(cuid())
  name            String
  email           String    @unique
  phone           String?   @unique
  passwordHash    String?
  googleId        String?   @unique
  role            UserRole  @default(TRAVELER)
  avatarUrl       String?
  aadhaarVerified Boolean   @default(false)

  // -- Mixin --
  isActive         Boolean   @default(true)
  isDeleted        Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  // -- Relations --
  organizerProfile  OrganizerProfile?
  bookings          Booking[]
  reviews           Review[]
  sentMessages      Message[]         @relation("sender")
  conversations     Conversation[]    @relation("traveler")
  refreshTokens     RefreshToken[]
  verificationCodes VerificationCode[]
  notifications     Notification[]
  cancelledBookings Booking[]         @relation("canceller")
  tripRequests      TripRequest[]

  // -- Indexes --
  @@index([email])
  @@index([role])
  @@index([isDeleted])
}
```

#### 2. OrganizerProfile

```prisma
model OrganizerProfile {
  id                  String             @id @default(cuid())
  userId              String             @unique
  user                User               @relation(fields: [userId], references: [id])
  businessName        String
  description         String?
  verificationStatus  VerificationStatus @default(PENDING)
  documents           Json?              // { aadhaar: url, pan: url, businessProof: url }
  rating              Float              @default(0)        // Materialized cache — recompute on review write
  totalReviews        Int                @default(0)        // Materialized cache
  totalTripsCompleted Int                @default(0)        // Materialized cache
  bankAccountLinked   Boolean            @default(false)    // Gate escrow release
  commissionRate      Float              @default(10.0)     // Platform commission %

  // -- Mixin --
  isActive         Boolean   @default(true)
  isDeleted        Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  // -- Relations --
  trips              Trip[]
  conversations      Conversation[]  @relation("organizer")

  // -- Indexes --
  @@index([verificationStatus])
  @@index([isDeleted])
}
```

#### 3. Destination (NEW)

```prisma
model Destination {
  id        String   @id @default(cuid())
  name      String                       // "Goa"
  slug      String   @unique             // "goa" — for SEO URLs /destinations/goa
  state     String                       // "Goa" (state name)
  photoUrl  String?                      // Hero image for destination page
  tripCount Int      @default(0)         // Materialized cache — updated on trip publish
  isPopular Boolean  @default(false)     // For homepage "Popular Destinations" section

  // -- Mixin --
  isActive         Boolean   @default(true)
  isDeleted        Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  // -- Relations --
  trips    Trip[]

  // -- Indexes --
  @@index([isPopular, tripCount])
  @@index([isDeleted])
}
```

#### 4. Trip

```prisma
model Trip {
  id                 String             @id @default(cuid())
  organizerId        String
  organizer          OrganizerProfile   @relation(fields: [organizerId], references: [id])
  destinationId      String
  destination        Destination        @relation(fields: [destinationId], references: [id])
  title              String
  slug               String             @unique
  tripType           TripType
  description        String
  itinerary          Json               // [{ day: 1, title: '', activities: [] }]
  startDate          DateTime
  endDate            DateTime
  bookingDeadline    DateTime?          // Last date to book (default: startDate - 24h)
  pricePerPerson     Int                // Whole rupees (₹4500 = 4500). CHECK: >= 100
  earlyBirdPrice     Int?
  earlyBirdDeadline  DateTime?
  minGroupSize       Int                // CHECK: >= 2
  maxGroupSize       Int                // CHECK: >= minGroupSize
  currentBookings    Int                @default(0)   // Only CONFIRMED. Atomic update via $transaction.
  version            Int                @default(0)   // Optimistic locking for concurrent booking
  inclusions         Json               // { transport: 'AC Bus', stay: '3* Hotel', meals: 'All' }
  cancellationPolicy CancellationPolicy @default(FLEXIBLE)
  pickupLocation     String?
  pickupTime         String?
  photos             String[]           // Array of Cloudinary URLs
  status             TripStatus         @default(DRAFT)
  bookingMode        BookingMode        @default(INSTANT)  // INSTANT = pay now, REQUEST_BASED = organizer approves first

  // -- Mixin --
  isActive         Boolean   @default(true)
  isDeleted        Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  // -- Relations --
  bookings           Booking[]
  reviews            Review[]
  conversations      Conversation[]
  tripRequests       TripRequest[]

  // -- Indexes --
  @@index([destinationId, startDate, status])
  @@index([slug])
  @@index([organizerId, status])
  @@index([status, startDate])
  @@index([isDeleted, status])

  // -- Constraints (enforced in service + Zod, documented for DB-level awareness) --
  // CHECK: pricePerPerson >= 100
  // CHECK: minGroupSize >= 2
  // CHECK: maxGroupSize >= minGroupSize
  // CHECK: endDate > startDate
}
```

#### 5. Booking

```prisma
model Booking {
  id                String        @id @default(cuid())
  bookingRef        String        @unique       // TRP-2025-XXXX
  tripId            String
  trip              Trip          @relation(fields: [tripId], references: [id])
  userId            String
  user              User          @relation(fields: [userId], references: [id])
  numTravelers      Int           @default(1)
  totalAmount       Int                          // Snapshot at booking time (whole rupees, immutable)
  tripProtection    Boolean       @default(false)
  bookingStatus     BookingStatus @default(PENDING_PAYMENT)
  expiresAt         DateTime?                    // PENDING_PAYMENT expires after 30min (cron cleanup)

  // -- Cancellation --
  cancellationReason  String?
  cancelledAt         DateTime?
  cancelledById       String?
  cancelledBy         User?       @relation("canceller", fields: [cancelledById], references: [id])

  // -- Mixin --
  isActive         Boolean   @default(true)
  isDeleted        Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  // -- Relations --
  travelerDetails      TravelerDetail[]
  paymentTransactions  PaymentTransaction[]
  review               Review?
  tripRequest          TripRequest?

  // -- Indexes --
  @@index([tripId, bookingStatus])
  @@index([userId, bookingStatus])
  @@index([bookingRef])
  @@index([bookingStatus, expiresAt])     // Cron: find expired PENDING_PAYMENT
  @@index([isDeleted])

  // -- Constraints (service-layer enforced) --
  // Max 1 active booking per (tripId, userId) — checked in $transaction
}
```

#### 6. TravelerDetail (NEW)

```prisma
model TravelerDetail {
  id            String       @id @default(cuid())
  bookingId     String?                              // Set for booking travelers
  booking       Booking?     @relation(fields: [bookingId], references: [id])
  tripRequestId String?                              // Set for trip request travelers
  tripRequest   TripRequest? @relation(fields: [tripRequestId], references: [id])
  name          String
  phone         String?
  age           Int?
  gender        Gender?
  isPrimary     Boolean      @default(false)         // The person who made the booking/request
  emergencyContactName  String?
  emergencyContactPhone String?

  // -- Mixin --
  isActive         Boolean   @default(true)
  isDeleted        Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  // -- Indexes --
  @@index([bookingId])
  @@index([tripRequestId])
  @@index([isDeleted])
  // CONSTRAINT: At least one of bookingId or tripRequestId must be non-null (enforced in service layer)
}
```

#### 7. PaymentTransaction (NEW)

```prisma
model PaymentTransaction {
  id                  String        @id @default(cuid())
  bookingId           String
  booking             Booking       @relation(fields: [bookingId], references: [id])
  type                PaymentType               // PAYMENT, REFUND, ESCROW_RELEASE
  amount              Int                        // Whole rupees
  currency            String        @default("INR")
  razorpayOrderId     String?
  razorpayPaymentId   String?
  razorpayRefundId    String?
  razorpayTransferId  String?
  status              PaymentStatus @default(INITIATED)
  failureReason       String?
  metadata            Json?                      // Raw Razorpay response for debugging

  // -- Timestamps only (NO soft-delete — financial audit trail) --
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  // -- Indexes --
  @@index([bookingId])
  @@index([razorpayOrderId])
  @@index([razorpayPaymentId])
  @@index([status])
}
```

#### 8. Review

```prisma
model Review {
  id                 String   @id @default(cuid())
  tripId             String
  trip               Trip     @relation(fields: [tripId], references: [id])
  bookingId          String   @unique            // One review per booking
  booking            Booking  @relation(fields: [bookingId], references: [id])
  userId             String
  user               User     @relation(fields: [userId], references: [id])
  overallRating      Int                          // CHECK: 1-5
  organizationRating Int?                         // CHECK: 1-5 when not null
  valueRating        Int?                         // CHECK: 1-5 when not null
  safetyRating       Int?                         // CHECK: 1-5 when not null
  accuracyRating     Int?                         // CHECK: 1-5 when not null
  comment            String?
  photos             String[]

  // -- Mixin --
  isActive         Boolean   @default(true)
  isDeleted        Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  // -- Indexes --
  @@index([tripId])
  @@index([userId])
  @@index([isDeleted])
}
```

#### 9. Conversation

```prisma
model Conversation {
  id                  String            @id @default(cuid())
  tripId              String
  trip                Trip              @relation(fields: [tripId], references: [id])
  travelerId          String
  traveler            User              @relation("traveler", fields: [travelerId], references: [id])
  organizerProfileId  String
  organizerProfile    OrganizerProfile  @relation("organizer", fields: [organizerProfileId], references: [id])
  lastMessageAt       DateTime?

  // -- Mixin --
  isActive         Boolean   @default(true)
  isDeleted        Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  // -- Relations --
  messages     Message[]

  // -- Indexes + Constraints --
  @@unique([tripId, travelerId])              // One conversation per traveler per trip
  @@index([travelerId])
  @@index([organizerProfileId])
  @@index([isDeleted])
}
```

#### 10. Message

```prisma
model Message {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  senderId       String
  sender         User         @relation("sender", fields: [senderId], references: [id])
  content        String
  isFlagged      Boolean      @default(false)     // Anti-leakage filter triggered
  readAt         DateTime?                         // null = unread

  // -- Mixin --
  isActive         Boolean   @default(true)
  isDeleted        Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  // -- Indexes --
  @@index([conversationId, createdAt])
  @@index([conversationId, readAt])            // Unread count query
  @@index([isDeleted])
}
```

#### 11. RefreshToken (NEW)

```prisma
model RefreshToken {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  tokenHash   String    @unique               // bcrypt hash of refresh token
  deviceInfo  String?                          // "Chrome on macOS"
  ipAddress   String?
  expiresAt   DateTime                         // 7 days from creation
  revokedAt   DateTime?                        // null = active, timestamp = revoked

  // -- Timestamps only (no soft-delete — revoke instead) --
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // -- Indexes --
  @@index([userId, revokedAt])                 // Active sessions for a user
  @@index([expiresAt])                         // Cron: cleanup expired tokens
}
```

#### 12. VerificationCode (NEW)

```prisma
model VerificationCode {
  id          String               @id @default(cuid())
  userId      String?                                     // Nullable (pre-signup phone verify)
  user        User?                @relation(fields: [userId], references: [id])
  type        VerificationCodeType                        // EMAIL_VERIFY, PHONE_OTP, PASSWORD_RESET
  identifier  String                                      // Email or phone number
  codeHash    String                                      // bcrypt hash of the code
  expiresAt   DateTime                                    // 10min for OTP, 1hr for password reset
  usedAt      DateTime?                                   // null = unused
  attempts    Int                  @default(0)             // Max 5 attempts, then expired

  // -- Timestamps only (no soft-delete — expires naturally) --
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // -- Indexes --
  @@index([identifier, type])
  @@index([expiresAt])                                    // Cron: cleanup expired codes
}
```

#### 13. Notification (NEW)

```prisma
model Notification {
  id            String              @id @default(cuid())
  userId        String
  user          User                @relation(fields: [userId], references: [id])
  channel       NotificationChannel                       // EMAIL, SMS, PUSH, IN_APP
  type          NotificationType                          // BOOKING_CONFIRMED, TRIP_REMINDER, etc.
  title         String
  body          String
  data          Json?                                     // Extra payload (e.g., { bookingId, tripSlug })
  sentAt        DateTime?                                 // When delivery attempted
  readAt        DateTime?                                 // null = unread
  failureReason String?                                   // If delivery failed

  // -- Mixin --
  isActive         Boolean   @default(true)
  isDeleted        Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  // -- Indexes --
  @@index([userId, readAt])                               // Unread notifications badge
  @@index([channel, sentAt])
  @@index([isDeleted])
}
```

#### 14. WebhookEvent

```prisma
model WebhookEvent {
  id          String   @id @default(cuid())
  eventId     String   @unique                   // Razorpay event ID (idempotency key)
  event       String                              // "payment.captured", "refund.processed"
  payload     Json                                // Raw Razorpay webhook payload
  status      String   @default("COMPLETED")      // PROCESSING | COMPLETED | FAILED
  processedAt DateTime?                           // When processing finished

  // -- Timestamps only (NO soft-delete — audit log) --
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // -- Indexes --
  @@index([eventId])
  @@index([status])
}
```

#### 15. TripRequest (NEW)

```prisma
model TripRequest {
  id              String            @id @default(cuid())
  tripId          String
  trip            Trip              @relation(fields: [tripId], references: [id])
  userId          String
  user            User              @relation(fields: [userId], references: [id])
  numTravelers    Int               @default(1)
  message         String?                          // "Hi, I'm interested in joining with 2 friends..."
  status          TripRequestStatus @default(PENDING)
  respondedAt     DateTime?                        // When organizer approved/rejected
  responseNote    String?                          // Organizer's note: "Welcome!" or "Sorry, age group mismatch"
  approvalExpiresAt DateTime?                      // Approved requests expire if not paid within window (e.g., 48h)
  bookingId       String?           @unique        // FK to Booking — set when request converts to booking
  booking         Booking?          @relation(fields: [bookingId], references: [id])

  // -- Mixin --
  isActive         Boolean   @default(true)
  isDeleted        Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  // -- Indexes --
  @@unique([tripId, userId])                       // One active request per user per trip
  @@index([tripId, status])                        // Organizer dashboard: pending requests for a trip
  @@index([userId, status])                        // Traveler: my requests
  @@index([status, approvalExpiresAt])             // Cron: expire unactioned approvals
  @@index([isDeleted])
}
```

**Flow:**
```
INSTANT mode:     Traveler → Book & Pay → CONFIRMED
REQUEST mode:     Traveler → TripRequest(PENDING)
                    → Organizer approves → TripRequest(APPROVED) + notification
                    → Traveler pays within 48h → Booking created → TripRequest(CONVERTED)
                    → OR: 48h expires → TripRequest(EXPIRED)
                    → OR: Organizer rejects → TripRequest(REJECTED) + notification
```

---

## 5. ER Relationship Diagram

```
User 1───1 OrganizerProfile
User 1───* Booking
User 1───* TripRequest
User 1───* Review
User 1───* RefreshToken
User 1───* VerificationCode
User 1───* Notification
User 1───* Conversation (as traveler)
User 1───* Message (as sender)
User 1───* Booking (as canceller)

OrganizerProfile 1───* Trip
OrganizerProfile 1───* Conversation (as organizer)

Destination 1───* Trip

Trip 1───* Booking
Trip 1───* TripRequest
Trip 1───* Review
Trip 1───* Conversation

TripRequest 1───0..1 Booking (when converted)
TripRequest 1───* TravelerDetail

Booking 1───* TravelerDetail
Booking 1───* PaymentTransaction
Booking 1───1 Review (optional)

Conversation 1───* Message
```

---

## 6. Race Condition Strategies

| Scenario | Problem | Solution |
|----------|---------|----------|
| **Two users book the last seat** | Both read `currentBookings = 19` (max = 20), both try to book | Atomic SQL with optimistic locking: `UPDATE Trip SET currentBookings = currentBookings + N, version = version + 1 WHERE id = ? AND currentBookings + N <= maxGroupSize AND version = ?`. If 0 rows affected → "Trip is full" error. |
| **Duplicate webhook** | Razorpay sends same event twice | `WebhookEvent.eventId` unique constraint + `findByEventId()` check before processing. |
| **Double booking** | Same user books same trip twice | Service-layer check inside `$transaction`: `SELECT ... WHERE tripId AND userId AND bookingStatus NOT IN ('CANCELLED', 'EXPIRED', 'REFUNDED')`. |
| **Payment vs. cron expiry** | Cron expires booking while user is paying | Cron: `UPDATE Booking SET status = 'EXPIRED' WHERE status = 'PENDING_PAYMENT' AND expiresAt < NOW()` — atomic. Payment webhook checks `bookingStatus` before confirming; if EXPIRED → reject. |
| **Concurrent review writes** | Two requests update organizer rating | Rating recompute uses `AVG()` aggregate inside `$transaction` — idempotent, always correct. |

### Atomic Booking Implementation Pattern

```typescript
// BookingService.confirmBooking()
async confirmBooking(bookingId: string): Promise<Booking> {
  return this.prisma.$transaction(async (tx) => {
    // 1. Lock and verify booking
    const booking = await tx.booking.findUnique({ where: { id: bookingId } })
    if (booking.bookingStatus !== 'PENDING_PAYMENT') throw new ConflictError('Booking no longer pending')
    if (booking.expiresAt && booking.expiresAt < new Date()) throw new ConflictError('Booking expired')

    // 2. Atomic seat update with optimistic locking
    const trip = await tx.trip.findUnique({ where: { id: booking.tripId } })
    const updated = await tx.$executeRaw`
      UPDATE "Trip"
      SET "currentBookings" = "currentBookings" + ${booking.numTravelers},
          "version" = "version" + 1
      WHERE "id" = ${booking.tripId}
        AND "currentBookings" + ${booking.numTravelers} <= "maxGroupSize"
        AND "version" = ${trip.version}
    `
    if (updated === 0) throw new ConflictError('Trip is fully booked')

    // 3. Confirm booking
    return tx.booking.update({
      where: { id: bookingId },
      data: { bookingStatus: 'CONFIRMED' },
    })
  })
}
```

---

## 7. Index Strategy

| Index | Table | Supports Query |
|-------|-------|---------------|
| `(destinationId, startDate, status)` | Trip | Search: "Goa trips this weekend" |
| `(slug)` unique | Trip | SEO URL: `/trips/goa-beach-getaway` |
| `(status, startDate)` | Trip | Homepage: trending trips |
| `(organizerId, status)` | Trip | Organizer dashboard: my trips |
| `(isDeleted, status)` | Trip | All active queries filter soft-delete |
| `(tripId, bookingStatus)` | Booking | Trip detail: confirmed count |
| `(userId, bookingStatus)` | Booking | My bookings page |
| `(bookingStatus, expiresAt)` | Booking | Cron: expire stale bookings |
| `(bookingRef)` unique | Booking | Support: lookup by ref |
| `(bookingId)` | PaymentTransaction | Payment history for a booking |
| `(razorpayOrderId)` | PaymentTransaction | Webhook: find by Razorpay ID |
| `(tripId)` | Review | Trip detail: show reviews |
| `(conversationId, createdAt)` | Message | Chat: latest messages |
| `(conversationId, readAt)` | Message | Unread count |
| `(userId, readAt)` | Notification | Unread badge |
| `(tokenHash)` unique | RefreshToken | Token lookup on refresh |
| `(userId, revokedAt)` | RefreshToken | Active sessions for user |
| `(identifier, type)` | VerificationCode | OTP lookup |
| `(slug)` unique | Destination | SEO: `/destinations/goa` |
| `(isPopular, tripCount)` | Destination | Homepage: popular destinations |
| `(tripId, status)` | TripRequest | Organizer: pending requests for a trip |
| `(userId, status)` | TripRequest | Traveler: my requests |
| `(status, approvalExpiresAt)` | TripRequest | Cron: expire unactioned approvals |
| `(tripId, userId)` unique | TripRequest | One request per user per trip |

---

## 8. Normalization Compliance

| Normal Form | Status | Explanation |
|-------------|--------|-------------|
| **1NF** | ✅ | All columns are atomic. `travelerDetails` JSON extracted to `TravelerDetail` table (shared by both `Booking` and `TripRequest` via nullable FKs). Remaining JSON fields (`itinerary`, `inclusions`, `documents`, `metadata`) are **intentionally schemaless** — they vary per record and are not queried by sub-fields. |
| **2NF** | ✅ | Every non-key column depends on the entire primary key. All tables use single-column `id` as PK, so 2NF is automatically satisfied. |
| **3NF** | ✅ | No transitive dependencies. `OrganizerProfile.rating`, `OrganizerProfile.totalReviews`, `Trip.currentBookings`, and `Destination.tripCount` are **materialized caches** — documented as such, with recompute logic on writes. |

---

## 9. CHECK Constraints (Service + Zod Enforced)

Prisma doesn't natively support CHECK constraints, so these are enforced via:
1. **Zod validators** — reject at API boundary
2. **Service-layer checks** — reject before DB write
3. **DB-level (optional)** — add via raw SQL migration for defense-in-depth

| Constraint | Table | Rule |
|------------|-------|------|
| Price floor | Trip | `pricePerPerson >= 100` |
| Group size | Trip | `minGroupSize >= 2` |
| Group size | Trip | `maxGroupSize >= minGroupSize` |
| Date order | Trip | `endDate > startDate` |
| Rating range | Review | `overallRating BETWEEN 1 AND 5` |
| Sub-rating range | Review | `organizationRating BETWEEN 1 AND 5` (when not null) |
| Traveler count | Booking | `numTravelers >= 1` |
| Amount | Booking | `totalAmount >= 100` |
| OTP attempts | VerificationCode | `attempts <= 5` (service enforced) |

---

## 10. Future Tables (Phase 2 & 3)

These tables are **designed but NOT implemented** until their features are needed. Schema definitions are included so the team can plan FK relationships and avoid migration conflicts.

---

### Phase 2 Tables

#### 15. TripProtectionPolicy

```
id, name ("Basic" / "Premium"), coveragePercent (80 / 100),
pricePercent (3.0 / 5.0 — % of trip price), maxClaimAmount,
description, termsUrl, isActive, [mixin]
```
**Use case:** Trip cancellation insurance. Traveler selects tier during booking. Claims go through `Dispute` table. Requires insurance partner integration.

**FKs added to Booking:** `protectionPolicyId → TripProtectionPolicy`

---

#### 16. Dispute

```
id, bookingId → Booking, raisedBy → User, assignedTo → User (admin),
type (REFUND_REQUEST / QUALITY_COMPLAINT / SAFETY_ISSUE / OTHER),
status (OPEN / UNDER_REVIEW / RESOLVED / REJECTED),
description, evidence (Json — photo URLs), resolution, resolvedAt,
refundAmount, [mixin]
```
**Use case:** Formal complaint system. Traveler raises dispute → admin reviews → resolution (with optional refund). Tracks full resolution lifecycle.

**Queries:** Unresolved disputes (admin dashboard), disputes per organizer (trust score), avg resolution time (ops metric).

---

#### 17. Coupon

```
id, code (unique, uppercase), type (FLAT / PERCENTAGE),
discountValue, minOrderAmount, maxDiscount,
usageLimit (total), perUserLimit,
validFrom, validTo, applicableTripTypes (Json?), isActive, [mixin]
```
**Use case:** Marketing promotions. "FIRST50" = ₹50 off first booking. "MONSOON30" = 30% off max ₹500. Per-user limits prevent abuse.

---

#### 18. CouponRedemption

```
id, couponId → Coupon, userId → User, bookingId → Booking,
discountApplied (actual ₹ amount), redeemedAt
```
**Use case:** Junction table. Prevents double-use. Queries: "How many times was FIRST50 used?", "What's the total discount given?", "Has this user already used this coupon?"

**Unique:** `(couponId, bookingId)`

---

#### 19. Waitlist

```
id, tripId → Trip, userId → User, position (Int),
notifiedAt, bookedAt, [mixin]
```
**Use case:** When trip is FULL, traveler joins waitlist. On cancellation → cron notifies next in queue → they get priority booking window. Position is auto-incremented.

**Unique:** `(tripId, userId)`

---

#### 20. SavedTrip

```
id, userId → User, tripId → Trip, createdAt
```
**Use case:** Wishlist / favorites. Traveler saves trips for later. Simple junction table, no soft-delete. Enables "Saved Trips" page.

**Unique:** `(userId, tripId)`

---

#### 21. OrganizerPayout

```
id, organizerProfileId → OrganizerProfile, bookingId → Booking,
grossAmount, commissionAmount, netAmount,
razorpayTransferId, status (SCHEDULED / PROCESSING / COMPLETED / FAILED),
scheduledAt, completedAt, failureReason, [timestamps only — no soft-delete]
```
**Use case:** Post-trip payment to organizer. Calculated as: `netAmount = grossAmount - (grossAmount × commissionRate / 100)`. Tracks scheduled date, actual transfer, failures. Financial audit — never delete.

---

#### 22. AuditLog

```
id, actorId → User, action (string enum),
entityType (string), entityId (string),
previousData (Json), newData (Json),
ipAddress, userAgent, createdAt
```
**Use case:** Compliance and debugging. "Who approved this organizer? When? What data changed?" Completely immutable — no updates, no deletes.

**Actions:** `APPROVE_ORGANIZER`, `REJECT_ORGANIZER`, `CANCEL_BOOKING`, `RESOLVE_DISPUTE`, `UPDATE_TRIP`, `BAN_USER`, etc.

---

#### 23. TripTag

```
Tag:     id, name ("pet-friendly"), slug, [mixin]
TripTag: tripId → Trip, tagId → Tag (compound PK)
```
**Use case:** Flexible discovery beyond fixed `TripType` enum. Organizer adds tags like "pet-friendly", "couples", "solo-friendly", "backpacker". Traveler filters by tags.

**Unique:** `TripTag(tripId, tagId)`

---

### Phase 3 Tables

#### 24. BlogPost

```
id, authorId → User (admin), title, slug (unique),
content (rich text / Markdown), excerpt,
coverImageUrl, publishedAt, status (DRAFT / PUBLISHED),
seoTitle, seoDescription, [mixin]
```
**Use case:** SEO content marketing. "10 Best Weekend Trips from Pune" → organic Google traffic → trip discovery. Admin authors via CMS.

---

#### 25. UserDevice

```
id, userId → User, platform (IOS / ANDROID / WEB),
fcmToken (unique), deviceModel, lastActiveAt, [mixin]
```
**Use case:** Push notifications when mobile app ships. One user → many devices. Token refresh on app open. Cleanup stale devices via cron.

---

#### 26. Referral

```
id, referrerId → User, refereeId → User, referralCode (unique),
status (PENDING / SIGNUP_COMPLETE / FIRST_BOOKING / REWARDED),
rewardAmount, rewardedAt, [mixin]
```
**Use case:** Growth loop. "Invite a friend, get ₹200 off." Funnel: invite sent → signup → first booking → reward disbursed. Both referrer and referee can receive rewards.

---

#### 27. TripSchedule

```
id, templateTripId → Trip, startDate, endDate,
bookingDeadline, pricePerPerson, maxGroupSize,
currentBookings, version, status, [mixin]
```
**Use case:** Recurring trips. Organizer creates one template ("Goa Weekend Getaway"), then adds multiple date slots. Each slot has its own capacity, pricing, and booking status. Template Trip holds the shared description/itinerary/photos.

---

## 11. Migration Strategy

| Rule | Why |
|------|-----|
| **Never edit a committed migration** | Causes drift between dev/staging/prod |
| **Add new columns as nullable first** | Avoids breaking existing rows |
| **`prisma migrate dev` locally** | Creates migration file |
| **`prisma migrate deploy` in CI/CD** | Applies migration without prompts |
| **Seed data via `prisma/seed.ts`** | Dev only — never in production |
| **One migration per feature** | Easy to revert, clear history |
| **Name migrations descriptively** | `add-payment-transaction-table`, not `update-db` |
