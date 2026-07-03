-- Allow users to create multiple bookings for the same trip (e.g., booking for friends).
-- Only PENDING_PAYMENT bookings are idempotency-guarded; CONFIRMED bookings can co-exist.
DROP INDEX IF EXISTS "Booking_active_user_trip_unique";

CREATE UNIQUE INDEX "Booking_active_user_trip_unique"
  ON "Booking" ("userId", "tripId")
  WHERE "bookingStatus" = 'PENDING_PAYMENT' AND "isDeleted" = false;
