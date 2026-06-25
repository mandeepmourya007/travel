-- Composite index for the sitemap query in TripRepository.findSlugsForSitemap().
-- Query: WHERE isDeleted = false AND status IN ('ACTIVE', 'FULL') ORDER BY updatedAt DESC LIMIT 50000
-- Without this index, Postgres sorts all rows matching (isDeleted, status) in memory.
-- With it, the planner can use an index scan in sorted order, avoiding the sort entirely.
CREATE INDEX IF NOT EXISTS "Trip_isDeleted_status_updatedAt_idx"
ON "Trip"("isDeleted", "status", "updatedAt" DESC);
