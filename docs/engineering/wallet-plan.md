# In-App Wallet — Implementation Plan

> **Status:** R&D complete, reviewed, ready for `/build-backend` + `/build-frontend`.
> **Approach:** DIY with Prisma + PostgreSQL (same DB, same `$transaction()`, zero new infra).
> **Ola Money / Swiggy Money style** — credits, refunds, cashback, booking deductions.

---

## 1. R&D Summary (Decision Log)

| Option | Fit | Why |
|--------|-----|-----|
| **Medici** (npm) | LOW | MongoDB only — wrong DB, cross-DB consistency headaches |
| **TigerBeetle** | LOW | Separate server, overkill for <100 txn/day at launch |
| **DIY Prisma** | **HIGH** | Same PostgreSQL, same `$transaction()`, zero new infra, ~250 lines |

Other excluded: Formance Ledger (K8s microservice), Blnk Finance (Go microservice), pgledger (early, no Prisma).

**Tradeoff acknowledged:** Single-entry ledger (not double-entry). A bug that creates money is invisible until manual audit. Acceptable for MVP — we add reconciliation cron as safety net.

---

## 1.5 Unified vs Separate Transaction Tables (R&D)

**Question:** Should `WalletTransaction` and `PaymentTransaction` be merged into one common table?

### How Industry Platforms Handle This

| Platform | Approach | Details |
|----------|----------|---------|
| **Swiggy Money** | **Separate** | Wallet service (with ICICI bank) tracks wallet credits/debits. Razorpay/payment gateway transactions are separate. FE shows unified "Activity" feed by aggregating both. |
| **Zomato** | **Separate** | Zomato Credits (wallet) are a separate ledger from payment gateway transactions. User sees unified timeline on app. |
| **MakeMyTrip** | **Separate** | "My Cash" wallet is independent from booking payment records. Wallet has own transaction history; payment receipts come from gateway. |
| **Paytm** | **Single ledger** | Being a payments-first company, they use a unified journal with `TransactionType` discriminator. But Paytm IS a wallet — their core product is the ledger. |
| **Ola Money** | **Separate** | Wallet operations (cashback, refunds) tracked independently. Ride payments through payment gateway are separate records. |
| **Modern Fintechs** (Stripe, Razorpay) | **Separate with event sourcing** | Payment transactions in one system, wallet/balance operations in another. Reconciliation pipelines merge them. |

### Three Approaches Analyzed

#### Option A: Unified Table (Merge PaymentTransaction + WalletTransaction)

```
┌──────────────────────────────────────────────────────────────┐
│ UnifiedTransaction                                            │
│ ─────────────────────────────────────────────────────────── │
│ id, bookingId?, walletId?, amount, type, status,            │
│ razorpayOrderId?, razorpayPaymentId?, razorpayRefundId?,    │
│ referenceModel?, referenceId?, balanceBefore?, balanceAfter?,│
│ description?, failureReason?, metadata?, createdAt          │
└──────────────────────────────────────────────────────────────┘
```

| Pros | Cons |
|------|------|
| Single table = one query for "all money movements" | **50%+ nullable columns** — wallet txns don't have razorpay fields; payment txns don't have balance fields |
| Fewer tables in schema | **Different lifecycles** — PaymentTransaction mutates (INITIATED→AUTHORIZED→CAPTURED→REFUNDED); WalletTransaction is **immutable append-only** |
| | **Breaks immutability principle** — can't have append-only + mutable in same table |
| | **Conflicting indexes** — payment lookup by razorpayOrderId vs wallet lookup by walletId+createdAt |
| | **Wallet idempotency guard** `@@unique([type, referenceModel, referenceId])` would affect payment rows too |
| | **Violates SRP** — one table doing two very different jobs |
| | Harder to enforce rules per type (soft-delete for payments? No soft-delete for wallet?) |

#### Option B: Separate Tables (Current Plan) ← RECOMMENDED

```
┌─────────────────────────────┐    ┌─────────────────────────────┐
│ PaymentTransaction           │    │ WalletTransaction            │
│ ──────────────────────────── │    │ ──────────────────────────── │
│ Razorpay lifecycle tracking  │    │ Wallet ledger (immutable)    │
│ bookingId (FK)               │    │ walletId (FK)                │
│ razorpayOrderId/PaymentId    │    │ balanceBefore/balanceAfter   │
│ status: INITIATED→CAPTURED   │    │ referenceModel+referenceId   │
│ MUTABLE (status transitions) │    │ APPEND-ONLY (no updates)     │
│ Gateway-specific fields      │    │ User-facing history          │
└─────────────────────────────┘    └─────────────────────────────┘
              │                                    │
              └──────────────┬─────────────────────┘
                             ▼
                  ┌──────────────────────┐
                  │ FE: Unified Activity  │
                  │ Feed (aggregated API) │
                  └──────────────────────┘
```

| Pros | Cons |
|------|------|
| Each table is purpose-built — zero nullable bloat | Two tables to query for "all movements" |
| Different lifecycles respected — mutable vs immutable | Slightly more FE aggregation |
| Independent indexes optimized per use case | |
| Wallet idempotency doesn't interfere with payment lookups | |
| Can test WalletService and PaymentService independently | |
| Matches industry standard (Swiggy, Zomato, MMT, Ola) | |

#### Option C: Separate Tables + Unified Read View (Best of Both)

Same as Option B for **writes**, but add a **unified financial activity endpoint** for the FE:

```typescript
// GET /api/activity — unified money movements feed
// Merges PaymentTransaction + WalletTransaction chronologically
interface FinancialActivityItem {
  id: string
  source: 'PAYMENT' | 'WALLET'          // discriminator
  amount: number
  type: string                           // PaymentType or WalletTransactionType
  status: string
  description: string
  bookingRef?: string                    // from PaymentTransaction → Booking
  walletBalanceAfter?: number            // from WalletTransaction only
  createdAt: string
}
```

This is **exactly** what Swiggy/Zomato/MMT do — separate systems for writes, unified view for reads.

### Decision: **Option B + C (Separate tables, unified read endpoint)**

**Reasons:**
1. `PaymentTransaction` **mutates** (status: INITIATED → AUTHORIZED → CAPTURED → FAILED → REFUNDED). It tracks Razorpay lifecycle with gateway-specific IDs.
2. `WalletTransaction` is **append-only immutable**. It's a financial ledger — no UPDATEs, no DELETEs.
3. Mixing mutable + immutable in one table violates the core fintech principle: "immutable journals with explicit reversals."
4. Industry standard confirms: every platform at our scale (Swiggy, Zomato, MMT, Ola) uses separate tables with a unified read layer.
5. The existing `PaymentTransaction` is already working, has specific indexes, and is tied to `BookingService + PaymentService`. Merging would require rewriting working code for no gain.

**The FE already has `/my-payments` page showing PaymentTransaction history. We add `/wallet` page for wallet-specific history, and optionally a unified `/activity` feed later (Phase 2) if users want one timeline.**

---

## 2. Database Schema

### 2.1 Enums

```prisma
enum WalletTransactionType {
  REFUND                // Booking cancellation refund → wallet
  CASHBACK              // Post-trip cashback reward
  BOOKING_DEDUCTION     // Wallet balance used to pay for booking
  ADMIN_CREDIT          // Manual credit by admin (compensation, promo)
  ADMIN_DEBIT           // Manual debit by admin (fraud clawback, correction)
  PROMOTIONAL_CREDIT    // Sign-up bonus, campaign credits (different tax treatment)
  EXPIRY                // Expired credits auto-debited by cron
}
```

### 2.2 Wallet Model

```prisma
model Wallet {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  balance   Int      @default(0)     // whole rupees, ATOMIC UPDATE ONLY
  currency  String   @default("INR")

  // soft-delete mixin (follows User lifecycle)
  isActive  Boolean   @default(true)
  isDeleted Boolean   @default(false)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  transactions WalletTransaction[]

  @@index([isDeleted])
  // DB-level: CHECK (balance >= 0) via raw migration
}
```

### 2.3 WalletTransaction Model

```prisma
model WalletTransaction {
  id             String                @id @default(cuid())
  walletId       String
  wallet         Wallet                @relation(fields: [walletId], references: [id])
  amount         Int                   // ALWAYS positive — direction derived from type
  type           WalletTransactionType
  referenceModel String?               // "Booking", "Coupon", "AdminAction"
  referenceId    String?               // FK to referenced entity
  description    String                // required — audit clarity
  balanceBefore  Int                   // snapshot BEFORE this txn
  balanceAfter   Int                   // snapshot AFTER this txn

  // NO soft-delete — immutable financial audit trail (same as PaymentTransaction)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([type, referenceModel, referenceId])  // idempotency guard
  @@index([walletId, createdAt])                 // transaction history
  @@index([referenceModel, referenceId])          // "all txns for booking X"
  @@index([type])                                 // filter by type
}
```

### 2.4 User Model Update

Add to the User model relations:

```prisma
// Add to User model:
wallet Wallet?
```

### 2.5 Design Decisions

| Decision | Rationale |
|----------|-----------|
| `amount` always positive | Direction derived from `type` — no ambiguous `amount=-500 + type=REFUND` bugs |
| `balanceBefore` + `balanceAfter` | Full audit trail — reconciliation without looking at previous row |
| `@@unique([type, referenceModel, referenceId])` | Idempotency — retry-safe, no double-credits on webhook replay |
| `referenceModel` + `referenceId` | Polymorphic ref (same pattern as `WebhookEvent`) — trace back to Booking, Coupon, etc. |
| `Wallet` has soft-delete mixin | Follows User lifecycle — deactivate wallet when user is deleted |
| `WalletTransaction` has NO soft-delete | Immutable financial audit — same as `PaymentTransaction`, `WebhookEvent` |
| Atomic SQL for balance update | Same pattern as `Trip.currentBookings` — no read-then-write race condition |
| Wallet created on signup (eager) | Eliminates "wallet not found" edge cases in debit flow |
| `currency` field on Wallet | Consistent with `PaymentTransaction.currency`, cheap insurance |
| `CHECK (balance >= 0)` at DB level | Defense-in-depth — service + DB both prevent negative balance |

---

## 3. Race Condition Strategy

**Problem:** Two concurrent `debit()` calls both read `balance = 1000`, both pass `>= 500` check, both write → balance goes to `0` instead of correct `500`.

**Solution:** Atomic SQL update (same pattern as `Trip.currentBookings` in `trip.repository.ts`):

```typescript
// WalletRepository.atomicDebit()
const rowsUpdated = await tx.$executeRaw`
  UPDATE "Wallet"
  SET "balance" = "balance" - ${amount},
      "updatedAt" = NOW()
  WHERE "id" = ${walletId}
    AND "balance" >= ${amount}
    AND "isDeleted" = false
`
if (rowsUpdated === 0) throw new ValidationError('Insufficient wallet balance')
```

For credits (no negative balance risk):

```typescript
// WalletRepository.atomicCredit()
await tx.$executeRaw`
  UPDATE "Wallet"
  SET "balance" = "balance" + ${amount},
      "updatedAt" = NOW()
  WHERE "id" = ${walletId}
    AND "isDeleted" = false
`
```

---

## 4. Business Flows

### 4.1 Refund → Wallet (Cancellation)

```
Traveler clicks "Cancel Booking" on /my-bookings
  → BookingService.cancelBooking() calculates refundAmount per policy
  → IF refundAmount > 0:
      WalletService.credit({
        walletId, amount: refundAmount,
        type: REFUND,
        referenceModel: "Booking", referenceId: bookingId,
        description: "Refund for booking #TRP-2025-0847 (FLEXIBLE policy, 100%)"
      })
  → BookingRepo.cancel() sets status=CANCELLED
  → Notification sent: "₹4,500 refunded to your wallet"
  → User sees updated balance on /wallet page instantly
```

**Why wallet instead of Razorpay refund?**
- Instant (vs 5-7 business days for bank refund)
- Money stays on platform (retention)
- User can use it for next booking immediately

**Edge case:** Organizer cancels entire trip → all travelers get 100% refund to wallet + email.

### 4.2 Cashback (Post-Trip Reward)

```
Trip completes (status → COMPLETED, cron or admin trigger)
  → CashbackService.processTripCashback(tripId)
  → For each CONFIRMED booking:
      cashbackAmount = Math.round(booking.totalAmount * CASHBACK_PERCENT / 100)
      WalletService.credit({
        walletId, amount: cashbackAmount,
        type: CASHBACK,
        referenceModel: "Booking", referenceId: bookingId,
        description: "5% cashback for Goa Beach Getaway"
      })
  → Notification: "You earned ₹225 cashback!"
```

**Rules:**
- Cashback % is configurable per trip or global constant (start with 5%)
- Only CONFIRMED+COMPLETED bookings get cashback (not CANCELLED)
- Cashback credited within 24h of trip completion
- Idempotency: `@@unique([type, referenceModel, referenceId])` prevents double-cashback

### 4.3 Wallet Deduction at Booking (Split Payment)

```
Traveler on /trips/:slug/book selects "Use wallet balance"
  → FE shows: "Wallet balance: ₹725 | Trip cost: ₹4,500"
  → User toggles wallet switch ON
  → Price breakdown updates:
      Trip cost:        ₹4,500
      Wallet applied:  -₹725
      ─────────────────────────
      Pay via Razorpay:  ₹3,775

  → BookingService.createBooking() receives { useWallet: true }
  → Inside $transaction:
      1. WalletService.debit(walletId, 725, BOOKING_DEDUCTION, bookingId)
      2. Razorpay order created for ₹3,775 (not ₹4,500)
      3. Booking.totalAmount = 4500, Booking.walletAmount = 725 (new field)
      4. PaymentTransaction.amount = 3775

  → IF payment fails / booking expires:
      WalletService.credit(walletId, 725, REFUND, bookingId, "Wallet refund - booking expired")

  → IF booking cancelled later:
      refundAmount calculated on totalAmount (4500), then:
      - First ₹725 goes back to wallet (original wallet deduction)
      - Remaining refund (if any) also goes to wallet
```

**New field on Booking model:**

```prisma
// Add to Booking model:
walletAmount Int @default(0) // Amount paid from wallet (rest via Razorpay)
```

### 4.4 Admin Credit / Debit

```
Admin on /admin/wallets searches for user → clicks "Credit" or "Debit"
  → Form: amount, reason (required), type (ADMIN_CREDIT or ADMIN_DEBIT)
  → WalletService.adminCredit/adminDebit({
      walletId, amount, description: reason,
      referenceModel: "AdminAction", referenceId: adminUserId
    })
  → Notification to user: "₹500 credited to your wallet by support team"
  → Audit log entry created
```

### 4.5 Promotional Credit (Sign-up Bonus)

```
New user completes onboarding → AuthService.signup() creates Wallet
  → IF SIGNUP_BONUS_AMOUNT > 0:
      WalletService.credit({
        walletId, amount: SIGNUP_BONUS_AMOUNT,
        type: PROMOTIONAL_CREDIT,
        referenceModel: "User", referenceId: userId,
        description: "Welcome bonus! Use on your first trip."
      })
```

### 4.6 Reconciliation Cron

```
Every 6 hours (alongside existing cron jobs in cron-jobs.ts):
  → For each Wallet:
      cached = wallet.balance
      computed = SUM(credits) - SUM(debits) from WalletTransaction
      IF cached !== computed:
        logger.error({ walletId, cached, computed, drift: cached - computed })
        // Alert via notification/Slack — do NOT auto-fix
```

---

## 5. API Endpoints

### 5.1 Traveler Routes (`/api/wallet`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/wallet` | TRAVELER, ADMIN | Get wallet balance + summary |
| GET | `/wallet/transactions` | TRAVELER, ADMIN | Transaction history (paginated, filterable) |

### 5.2 Admin Routes (`/api/admin/wallets`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/wallets` | ADMIN | List all wallets (search by user) |
| GET | `/admin/wallets/:userId` | ADMIN | Get specific user's wallet + txns |
| POST | `/admin/wallets/:userId/credit` | ADMIN | Manual credit |
| POST | `/admin/wallets/:userId/debit` | ADMIN | Manual debit |

### 5.3 Modified Existing Endpoints

| Endpoint | Change |
|----------|--------|
| `POST /bookings` | Add `useWallet: boolean` to request body |
| `POST /bookings/:id/cancel` | Refund goes to wallet instead of Razorpay |
| `POST /auth/signup` | Creates Wallet + optional sign-up bonus |

---

## 6. Shared Types & Validators

### 6.1 Types (`packages/shared/src/types/wallet.types.ts`)

```typescript
export interface WalletBalance {
  balance: number        // whole rupees
  currency: string       // "INR"
  totalCredited: number  // lifetime credits
  totalDebited: number   // lifetime debits
}

export interface WalletTransactionItem {
  id: string
  amount: number         // always positive
  type: WalletTransactionType
  referenceModel: string | null
  referenceId: string | null
  description: string
  balanceBefore: number
  balanceAfter: number
  createdAt: string
}

export interface WalletTransactionFilters {
  type?: WalletTransactionType
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}

export type WalletTransactionType =
  | 'REFUND'
  | 'CASHBACK'
  | 'BOOKING_DEDUCTION'
  | 'ADMIN_CREDIT'
  | 'ADMIN_DEBIT'
  | 'PROMOTIONAL_CREDIT'
  | 'EXPIRY'
```

### 6.2 Zod Schemas (`packages/shared/src/validators/wallet.schema.ts`)

```typescript
export const walletTransactionFiltersSchema = z.object({
  type: z.nativeEnum(WalletTransactionType).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const adminWalletCreditSchema = z.object({
  amount: z.number().int().min(1).max(50000),
  description: z.string().trim().min(5).max(200),
})

export const adminWalletDebitSchema = adminWalletCreditSchema
```

---

## 7. Backend Architecture

### 7.1 Files to Create

```
apps/api/src/
  repositories/wallet.repository.ts        # DB queries only
  services/wallet.service.ts               # All business logic
  controllers/wallet.controller.ts         # Thin — parse + call service + respond
  routes/wallet.routes.ts                  # Route definitions
  routes/admin-wallet.routes.ts            # Admin wallet routes

packages/shared/src/
  types/wallet.types.ts                    # Shared types
  validators/wallet.schema.ts              # Shared Zod schemas

tests/unit/services/wallet.service.test.ts # TDD — write first
```

### 7.2 Files to Modify

```
apps/api/prisma/schema.prisma             # Add Wallet + WalletTransaction + enum + User relation
apps/api/src/config/dependencies.ts        # Wire WalletRepo → WalletService → WalletController
apps/api/src/routes/index.ts               # Register wallet routes
apps/api/src/services/auth.service.ts      # Create Wallet on signup
apps/api/src/services/booking.service.ts   # useWallet flag, refund-to-wallet
apps/api/src/repositories/booking.repository.ts  # walletAmount field
apps/api/src/utils/constants.ts            # CASHBACK_PERCENT, SIGNUP_BONUS_AMOUNT
apps/api/src/utils/cron-jobs.ts            # Reconciliation cron
```

### 7.3 Service Methods

```typescript
class WalletService {
  /** Credits wallet — used for refund, cashback, admin credit, promo */
  credit(input: CreditInput): Promise<WalletTransactionItem>

  /** Debits wallet — used for booking deduction, admin debit, expiry */
  debit(input: DebitInput): Promise<WalletTransactionItem>

  /** Returns balance + lifetime totals */
  getBalance(userId: string): Promise<WalletBalance>

  /** Paginated, filterable transaction history */
  getTransactionHistory(userId: string, filters: WalletTransactionFilters): Promise<PaginatedResult>

  /** Admin: credit a user's wallet */
  adminCredit(adminUserId: string, targetUserId: string, amount: number, description: string): Promise<WalletTransactionItem>

  /** Admin: debit a user's wallet */
  adminDebit(adminUserId: string, targetUserId: string, amount: number, description: string): Promise<WalletTransactionItem>

  /** Cron: check cached balance vs computed balance, log drift */
  reconcile(): Promise<{ checked: number; drifted: number }>
}
```

---

## 8. Frontend — Pages & Navigation

### 8.1 New Pages

| Route | Page | Auth |
|-------|------|------|
| `/wallet` | Wallet dashboard (balance + transactions) | TRAVELER |
| `/admin/wallets` | Admin wallet management | ADMIN |

### 8.2 Navigation Updates

**Header** (`header.tsx`) — add "Wallet" link next to "My Payments" for travelers:

```
Explore Trips | My Bookings | My Payments | Wallet | Profile
```

The "Wallet" link shows balance badge: `Wallet ₹725`

**Mobile menu** — same order, wallet shows balance inline.

**Booking page** (`/trips/:slug/book`) — add wallet toggle in price breakdown.

### 8.3 New Components

```
apps/web/src/
  app/wallet/
    page.tsx                              # Wallet dashboard page
    loading.tsx                           # Route-level skeleton
    error.tsx                             # Route-level error boundary

  components/wallet/
    wallet-balance-card.tsx               # Hero card — balance, total credited/debited
    wallet-balance-badge.tsx              # Compact badge for header (₹725)
    wallet-transaction-list.tsx           # Paginated transaction table
    wallet-transaction-item.tsx           # Single row — icon, description, amount, date
    wallet-transaction-filters.tsx        # Type + date range filters
    wallet-empty-state.tsx               # "No transactions yet"
    wallet-skeleton.tsx                   # Skeleton matching page shape

  components/booking/
    wallet-toggle.tsx                     # "Use wallet balance" switch in booking form

  hooks/
    use-wallet.ts                         # useWalletBalance(), useWalletTransactions()

  app/admin/wallets/
    page.tsx                              # Admin wallet list + search
```

### 8.4 Query Key Factory

Add to `lib/query-keys.ts`:

```typescript
export const walletKeys = {
  all: ['wallet'] as const,
  balance: () => [...walletKeys.all, 'balance'] as const,
  transactions: () => [...walletKeys.all, 'transactions'] as const,
  transactionList: (filters: WalletTransactionFilters) =>
    [...walletKeys.transactions(), filters] as const,
}
```

**Invalidation rules:**
- `bookingKeys.list` mutation → invalidate `walletKeys.balance` (refund/deduction changes balance)
- `walletKeys.balance` auto-refetch on page focus (staleTime: 30s)

---

## 9. UI/UX Wireframes

### 9.1 Wallet Page (`/wallet`) — Traveler

```
┌─────────────────────────────────────────────────────┐
│  LOGO          [Search]         Wallet ₹725  [User] │
├─────────────────────────────────────────────────────┤
│                                                       │
│  MY WALLET                                            │
│                                                       │
│  ┌────────────────────────────────────────────────┐   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │  WALLET BALANCE              ₹725        │  │   │
│  │  │  ─────────────────────────────────────── │  │   │
│  │  │  Total Earned    ₹4,225                  │  │   │
│  │  │  Total Used      ₹3,500                  │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────┘   │
│                                                       │
│  TRANSACTION HISTORY                                  │
│                                                       │
│  [All ▼] [Date Range]                                 │
│                                                       │
│  ┌────────────────────────────────────────────────┐   │
│  │ ↩  Refund for #TRP-2025-0847      + ₹4,500    │   │
│  │    Goa Beach Getaway (FLEXIBLE)   2 Jan 2026   │   │
│  │    Balance: ₹225 → ₹4,725                     │   │
│  ├────────────────────────────────────────────────┤   │
│  │ 🎁 5% Cashback                    + ₹225       │   │
│  │    Manali Adventure               28 Dec 2025  │   │
│  │    Balance: ₹0 → ₹225                         │   │
│  ├────────────────────────────────────────────────┤   │
│  │ 🛒 Booking deduction              - ₹3,500     │   │
│  │    Kerala Backwaters #TRP-2026... 15 Jan 2026  │   │
│  │    Balance: ₹4,725 → ₹1,225                   │   │
│  ├────────────────────────────────────────────────┤   │
│  │ 🎉 Welcome bonus                  + ₹500       │   │
│  │    Sign-up promotional credit     1 Dec 2025   │   │
│  │    Balance: ₹0 → ₹500                         │   │
│  └────────────────────────────────────────────────┘   │
│                                                       │
│  [Load more]                                          │
└─────────────────────────────────────────────────────┘
```

**Design tokens:**
- Balance card: `bg-gradient-to-r from-primary-500 to-highlight-500 text-white rounded-2xl p-6 shadow-lg`
- Balance amount: `font-mono text-4xl font-bold` (JetBrains Mono for money)
- Total earned/used: `font-mono text-lg text-white/80`
- Transaction credit: `text-success-500 font-mono font-semibold` (`+ ₹4,500`)
- Transaction debit: `text-error-500 font-mono font-semibold` (`- ₹3,500`)
- Balance trail: `text-xs text-neutral-400 font-mono`
- Type icon mapping:
  - REFUND → `↩` RotateCcw (primary-500)
  - CASHBACK → `🎁` Gift (highlight-500)
  - BOOKING_DEDUCTION → `🛒` ShoppingCart (accent-500)
  - ADMIN_CREDIT → `⭐` Star (warning-500)
  - ADMIN_DEBIT → `⚠️` AlertTriangle (error-500)
  - PROMOTIONAL_CREDIT → `🎉` PartyPopper (highlight-500)
  - EXPIRY → `⏰` Clock (neutral-400)

### 9.2 Wallet Toggle on Booking Page (`/trips/:slug/book`)

```
┌─────────────────────────────────────┐
│  PRICE BREAKDOWN                     │
│                                      │
│  Trip cost:       ₹4,500 x 1        │
│  Pickup (Mumbai): ₹200 x 1          │
│  ──────────────────────────────      │
│  Subtotal:        ₹4,700             │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  💰 Use Wallet Balance  [ON] │    │
│  │  Available: ₹725             │    │
│  │  Applied:  -₹725             │    │
│  └──────────────────────────────┘    │
│                                      │
│  ──────────────────────────────      │
│  Pay via Razorpay:  ₹3,975          │
│                                      │
│  [Pay ₹3,975 with Razorpay]         │
└─────────────────────────────────────┘
```

**Design:**
- Wallet toggle: `bg-primary-50 border border-primary-200 rounded-xl p-4`
- Toggle switch: shadcn/ui `Switch` component
- Applied amount: `text-success-500 font-mono font-semibold`
- If wallet balance is 0: section hidden entirely
- If wallet balance >= total: Razorpay section hidden, CTA becomes "Pay ₹0 (Wallet Only)"

### 9.3 Wallet Balance Badge in Header

```
Desktop: [Wallet ₹725]  — text-sm font-mono badge-style link
Mobile:  [💰 ₹725]      — compact, icon + amount only

Badge style:
  bg-primary-50 text-primary-700 rounded-full px-3 py-1
  font-mono text-sm font-medium
  hover:bg-primary-100 transition-colors
```

### 9.4 Admin Wallet Page (`/admin/wallets`)

```
┌─────────────────────────────────────────────────────┐
│  ADMIN: WALLET MANAGEMENT                            │
├─────────────────────────────────────────────────────┤
│                                                       │
│  [🔍 Search user by name or email...]                │
│                                                       │
│  ┌─────────┬──────────┬─────────┬──────────────────┐ │
│  │ User    │ Balance  │ Last Txn│ Actions           │ │
│  ├─────────┼──────────┼─────────┼──────────────────┤ │
│  │ Priya S.│ ₹4,725   │ 2h ago  │ [Credit] [Debit] │ │
│  │ Rahul M.│ ₹0       │ 1d ago  │ [Credit] [Debit] │ │
│  │ Sneha K.│ ₹1,200   │ 3d ago  │ [Credit] [Debit] │ │
│  └─────────┴──────────┴─────────┴──────────────────┘ │
│                                                       │
│  CREDIT/DEBIT MODAL:                                 │
│  ┌──────────────────────────────────┐                │
│  │  Credit Wallet — Priya S.        │                │
│  │                                   │                │
│  │  Amount: [₹ ____]  (max ₹50,000) │                │
│  │  Reason: [________________________│                │
│  │          ________________________]│                │
│  │                                   │                │
│  │  [Cancel]        [Confirm Credit] │                │
│  └──────────────────────────────────┘                │
└─────────────────────────────────────────────────────┘
```

### 9.5 Refund Confirmation (After Cancellation)

```
┌──────────────────────────────────────┐
│  ✅ BOOKING CANCELLED                 │
│                                       │
│  Booking: #TRP-2025-0847             │
│  Goa Beach Getaway                    │
│                                       │
│  Cancellation Policy: FLEXIBLE        │
│  Refund: 100% (cancelled >48h before) │
│                                       │
│  ┌──────────────────────────────┐     │
│  │  💰 ₹4,500 refunded to wallet│     │
│  │  New balance: ₹5,225         │     │
│  │  Available instantly          │     │
│  └──────────────────────────────┘     │
│                                       │
│  [View Wallet]    [Browse Trips]      │
└──────────────────────────────────────┘
```

### 9.6 Empty Wallet State

```
┌──────────────────────────────────────┐
│                                       │
│            💰 (text-5xl)             │
│                                       │
│    "Your wallet is empty"             │
│    "Book a trip and earn cashback!"   │
│                                       │
│        [ Browse Trips ]               │
│                                       │
└──────────────────────────────────────┘
```

---

## 10. 4-State Rendering (Wallet Page)

```typescript
// app/wallet/page.tsx
const { data: balance, isLoading, error } = useWalletBalance()
const txns = useWalletTransactions(filters)

if (isLoading) return <WalletSkeleton />              // shimmer card + 4 row skeletons
if (error)     return <ErrorState onRetry={refetch} /> // "Failed to load wallet"
if (!balance)  return <WalletEmptyState />             // "Your wallet is empty"
return         <WalletDashboard balance={balance} transactions={txns} />
```

---

## 11. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Wallet balance = 0, user toggles "Use wallet" | Toggle disabled, grayed out, tooltip: "No balance available" |
| Wallet balance > booking total | Full amount from wallet, ₹0 Razorpay order — skip Razorpay entirely |
| Booking expires after wallet deduction | Auto-refund wallet deduction via `REFUND` transaction |
| Payment fails after wallet deduction | Same as above — wallet amount refunded atomically |
| Two concurrent debit requests | Atomic SQL — second one fails with "Insufficient balance" |
| Admin credits ₹0 | Zod rejects: `amount.min(1)` |
| Admin debits more than balance | Atomic SQL rejects — 0 rows updated → ValidationError |
| Duplicate refund for same booking | `@@unique([type, referenceModel, referenceId])` prevents insert |
| User deleted (soft-delete) | Wallet soft-deleted with user — balance frozen, no new txns |
| Reconciliation finds drift | Logger.error alert — manual investigation, no auto-fix |
| Booking with `walletAmount > 0` cancelled | Wallet portion refunded first, then Razorpay portion (if any) |

---

## 12. Test Coverage Requirements

### Backend (WalletService)

| Method | Tests |
|--------|-------|
| `credit()` | Happy path, idempotency (same ref = skip), wallet not found, zero amount, negative amount, wallet deleted |
| `debit()` | Happy path, insufficient balance, concurrent debit race, wallet not found, zero amount, wallet deleted |
| `getBalance()` | Happy path, no transactions yet (balance=0), wallet not found |
| `getTransactionHistory()` | Happy path, filters by type, filters by date range, pagination, empty result |
| `adminCredit()` | Happy path, non-admin user → ForbiddenError, target user not found |
| `adminDebit()` | Happy path, insufficient balance, target user not found |
| `reconcile()` | No drift, drift detected → logged |

### Frontend (Wallet Components)

| Component | Tests |
|-----------|-------|
| `WalletBalanceCard` | Loading skeleton, data renders, zero balance |
| `WalletTransactionList` | Loading, error+retry, empty state, data renders, pagination |
| `WalletTransactionItem` | Credit renders green, debit renders red, each type shows correct icon |
| `WalletToggle` | Toggle on/off, disabled when balance=0, shows applied amount |
| `WalletBalanceBadge` | Renders balance, loading state |

---

## 13. Implementation Order

| # | Task | Depends On | Workflow |
|---|------|-----------|----------|
| 1 | Prisma schema (Wallet + WalletTransaction + enum + User relation) | — | manual |
| 2 | Migration + raw SQL CHECK constraint | 1 | `docker compose exec api npx prisma migrate dev` |
| 3 | Shared types + Zod validators | — | manual |
| 4 | WalletRepository | 1 | `/build-backend` |
| 5 | WalletService (TDD — tests first) | 3, 4 | `/build-backend` |
| 6 | WalletController + routes | 5 | `/build-backend` |
| 7 | Wire into dependencies.ts | 6 | manual |
| 8 | Modify AuthService.signup() — create wallet | 5 | manual |
| 9 | Modify BookingService — useWallet + refund-to-wallet | 5 | manual |
| 10 | Add reconciliation cron | 5 | manual |
| 11 | FE: query keys + hooks (useWalletBalance, useWalletTransactions) | 6 | `/build-frontend` |
| 12 | FE: WalletBalanceCard, WalletTransactionList, WalletSkeleton | 11 | `/build-frontend` |
| 13 | FE: /wallet page (4-state) | 12 | `/build-frontend` |
| 14 | FE: WalletBalanceBadge in header | 11 | `/build-frontend` |
| 15 | FE: WalletToggle on booking page | 11 | `/build-frontend` |
| 16 | FE: Refund confirmation update | 13 | `/build-frontend` |
| 17 | FE: Admin wallet page | 11 | `/build-frontend` |
| 18 | FE tests (MSW) | 12-17 | `/build-frontend` |
| 19 | Docs: `docs/engineering/fe/wallet.md` | 18 | manual |

---

## 14. Constants (`utils/constants.ts` additions)

```typescript
export const CASHBACK_PERCENT = 5              // 5% post-trip cashback
export const SIGNUP_BONUS_AMOUNT = 0           // Set > 0 to enable sign-up bonus
export const WALLET_MAX_ADMIN_CREDIT = 50_000  // Max single admin credit ₹50,000
export const WALLET_RECONCILE_INTERVAL = '0 */6 * * *' // Every 6 hours
```
