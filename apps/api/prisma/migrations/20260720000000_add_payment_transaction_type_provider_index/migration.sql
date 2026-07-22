-- Migration: Add composite index on PaymentTransaction(type, provider).
--
-- Purpose: findBalanceReleaseEligibleBookings' outer filter
-- (type = 'DEPOSIT_RELEASE' AND provider = 'cashfree') was verified via EXPLAIN
-- ANALYZE to use an index scan on the standalone `provider` index followed by an
-- in-memory Filter on `type` (Rows Removed by Filter growing with table size). This
-- composite index lets Postgres satisfy both predicates directly from the index.

-- CreateIndex
CREATE INDEX "PaymentTransaction_type_provider_idx" ON "PaymentTransaction"("type", "provider");
