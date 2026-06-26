-- Review query: WHERE tripId = ? AND isDeleted = false ORDER BY createdAt DESC
-- The existing [tripId] index satisfies the JOIN but forces a full index scan
-- then a filter on isDeleted. This composite covers all three in one seek.
-- NOTE: CONCURRENTLY cannot run inside Prisma's implicit transaction block
-- (Postgres errors: "cannot run inside a transaction block"). Plain CREATE INDEX
-- is used here — consistent with other custom migrations in this project.
CREATE INDEX IF NOT EXISTS "Review_tripId_isDeleted_createdAt_idx"
  ON "Review" ("tripId", "isDeleted", "createdAt" DESC);
