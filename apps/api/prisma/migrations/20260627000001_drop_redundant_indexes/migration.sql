-- Migration: Drop redundant / low-value indexes
--
-- Rationale (DBA review):
--  1. Standalone @@index([isDeleted]) on every soft-deleted model is a boolean
--     index where >99% of rows are `false`. The planner almost never chooses it,
--     and the global soft-delete middleware always queries `isDeleted = false`
--     alongside a more selective column — which is served by the composite
--     indexes instead. These single-column boolean indexes were pure write
--     overhead (every INSERT/UPDATE maintained them for no read benefit).
--  2. User."email" already has a UNIQUE index from `email @unique`; the extra
--     non-unique @@index([email]) was a duplicate.
--  3. Trip."isDeleted","status" is a strict prefix of several longer composite
--     indexes (e.g. [isDeleted, status, startDate]) — any (isDeleted, status)
--     lookup uses those, so the standalone index was redundant.
--  4. Review."tripId" is a prefix of [tripId, isDeleted, createdAt] — redundant.
--
-- DROP INDEX takes a brief ACCESS EXCLUSIVE lock but is effectively instant
-- (catalog change only). For very large tables you may instead run each
-- statement as `DROP INDEX CONCURRENTLY` OUTSIDE a transaction.

-- Redundant duplicate of the UNIQUE(email) index
DROP INDEX IF EXISTS "User_email_idx";

-- Prefix-redundant composite indexes
DROP INDEX IF EXISTS "Trip_isDeleted_status_idx";
DROP INDEX IF EXISTS "Review_tripId_idx";

-- Low-value standalone boolean (isDeleted) indexes
DROP INDEX IF EXISTS "User_isDeleted_idx";
DROP INDEX IF EXISTS "OrganizerProfile_isDeleted_idx";
DROP INDEX IF EXISTS "Destination_isDeleted_idx";
DROP INDEX IF EXISTS "Booking_isDeleted_idx";
DROP INDEX IF EXISTS "TripTransferPoint_isDeleted_idx";
DROP INDEX IF EXISTS "TravelerDetail_isDeleted_idx";
DROP INDEX IF EXISTS "TripVehicle_isDeleted_idx";
DROP INDEX IF EXISTS "VehicleSeat_isDeleted_idx";
DROP INDEX IF EXISTS "Review_isDeleted_idx";
DROP INDEX IF EXISTS "Conversation_isDeleted_idx";
DROP INDEX IF EXISTS "Message_isDeleted_idx";
DROP INDEX IF EXISTS "Notification_isDeleted_idx";
DROP INDEX IF EXISTS "Wallet_isDeleted_idx";
DROP INDEX IF EXISTS "TripRequest_isDeleted_idx";
