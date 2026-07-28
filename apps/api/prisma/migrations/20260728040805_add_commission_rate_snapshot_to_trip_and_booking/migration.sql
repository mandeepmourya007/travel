-- Migration: Snapshot organizer commissionRate onto Trip and Booking
-- Admin will soon be able to change OrganizerProfile.commissionRate at any
-- time; entitlement calc must never do a live read of it, or an admin edit
-- would retroactively change payouts for already-placed bookings. Instead we
-- snapshot the rate once at trip-creation time (Trip.commissionRate) and
-- again at booking-creation time (Booking.commissionRate), matching
-- OrganizerProfile.commissionRate's exact column definition.

-- ── Expand: Add commissionRate to Trip ────────────────────────────────────
ALTER TABLE "Trip"
  ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5, 2) NOT NULL DEFAULT 10.0;

-- ── Expand: Add commissionRate to Booking ─────────────────────────────────
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5, 2) NOT NULL DEFAULT 10.0;

-- ── Backfill: existing Trips get their organizer's CURRENT commissionRate ─
-- Preserves today's live-read behavior for pre-existing rows.
UPDATE "Trip" t
SET "commissionRate" = op."commissionRate"
FROM "OrganizerProfile" op
WHERE t."organizerId" = op."id";

-- ── Backfill: existing Bookings get their trip's organizer's CURRENT rate ─
UPDATE "Booking" b
SET "commissionRate" = op."commissionRate"
FROM "Trip" t
JOIN "OrganizerProfile" op ON op."id" = t."organizerId"
WHERE b."tripId" = t."id";
