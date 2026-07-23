-- Partial unique index: at most one active primary contact per booking.
-- Not representable in schema.prisma's DSL (Prisma has no partial-unique-index
-- syntax), so this is a raw, hand-authored migration — expected to show as
-- drift against `prisma db pull`, which is fine, it's intentional.
CREATE UNIQUE INDEX "TravelerDetail_bookingId_primary_key"
  ON "TravelerDetail" ("bookingId")
  WHERE "isPrimary" = true AND "isDeleted" = false;
