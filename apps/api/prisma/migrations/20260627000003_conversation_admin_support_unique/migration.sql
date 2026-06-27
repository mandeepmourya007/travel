-- Migration: enforce a single ADMIN_SUPPORT conversation per traveler
--
-- The declarative @@unique([type, tripId, travelerId]) does NOT constrain
-- ADMIN_SUPPORT rows: tripId is NULL for them and Postgres treats NULLs as
-- distinct, so a traveler could accumulate many support threads. This partial
-- unique index closes that gap while leaving TRIP_CHAT rows untouched.
--
-- Prisma cannot express partial unique indexes declaratively; documented via a
-- comment in schema.prisma (Conversation model).

-- Step 1: Dedupe — keep the earliest live ADMIN_SUPPORT thread per traveler and
-- soft-delete any extras, so the unique index can be created if dupes exist.
DO $$
DECLARE
  deduped_count INTEGER;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "travelerId"
        ORDER BY "createdAt" ASC
      ) AS rn
    FROM "Conversation"
    WHERE "type" = 'ADMIN_SUPPORT' AND "isDeleted" = false
  ),
  to_delete AS (
    SELECT id FROM ranked WHERE rn > 1
  )
  UPDATE "Conversation"
  SET "isDeleted" = true, "isActive" = false, "deletedAt" = NOW(), "updatedAt" = NOW()
  WHERE id IN (SELECT id FROM to_delete);

  GET DIAGNOSTICS deduped_count = ROW_COUNT;

  IF deduped_count > 0 THEN
    RAISE WARNING 'conversation_admin_support_unique migration: soft-deleted % duplicate ADMIN_SUPPORT thread(s)', deduped_count;
  END IF;
END $$;

-- Step 2: Create the partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_admin_support_unique"
  ON "Conversation" ("travelerId")
  WHERE "type" = 'ADMIN_SUPPORT' AND "isDeleted" = false;
