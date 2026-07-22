-- Migration: Add composite index on PaymentTransaction(bookingId, type).
--
-- Purpose: findBalanceReleaseEligibleBookings (payment-transaction.repository.ts) was
-- rewritten from two unbounded findMany scans (all BALANCE_RELEASE rows ever, all
-- REFUND rows ever) to a single query using Prisma relation filters
-- (`paymentTransactions: { none: { type: ... } }`), which Prisma compiles to a
-- correlated NOT EXISTS subquery filtered on bookingId + type. This index lets that
-- subquery (and the existing findReleasedBookingIdsForTrip / findUnreleasedSafePays
-- patterns that filter by bookingId+type) use an index scan instead of a sequential
-- scan as the PaymentTransaction table grows.
--
-- The existing @@index([bookingId]) index is a prefix of this one but does not cover
-- the `type` predicate, so Postgres would still need a filter step after the index
-- scan; this composite index lets it satisfy bookingId+type entirely from the index.

-- CreateIndex
CREATE INDEX "PaymentTransaction_bookingId_type_idx" ON "PaymentTransaction"("bookingId", "type");
