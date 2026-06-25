-- Partial unique index: at most one REFUND transaction per booking.
-- This is the DB-level backstop against double-refund creation. The application
-- gate (cancelAtomically SELECT FOR UPDATE) is the primary guard; this index
-- prevents any edge case (admin retry, concurrent calls) from creating a second
-- REFUND row, which could lead to double-refund calls to Razorpay.
--
-- A partial index (WHERE type = 'REFUND') keeps the constraint narrow — PAYMENT,
-- ESCROW_RELEASE, and FAILED transactions are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transaction_booking_refund_unique"
ON "PaymentTransaction"("bookingId")
WHERE "type" = 'REFUND';
