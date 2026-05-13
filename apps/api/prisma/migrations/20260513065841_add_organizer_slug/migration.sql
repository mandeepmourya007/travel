-- Step 1: Add slug column as nullable first
ALTER TABLE "OrganizerProfile" ADD COLUMN "slug" TEXT;

-- Step 2: Backfill existing rows — generate slug from businessName (lowercase, replace spaces/special chars with hyphens)
UPDATE "OrganizerProfile"
SET "slug" = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      TRIM("businessName"),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
);

-- Step 3: Handle any duplicate slugs by appending a suffix
WITH dupes AS (
  SELECT id, slug, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY "createdAt") AS rn
  FROM "OrganizerProfile"
)
UPDATE "OrganizerProfile" op
SET slug = op.slug || '-' || d.rn
FROM dupes d
WHERE op.id = d.id AND d.rn > 1;

-- Step 4: Make the column NOT NULL now that all rows have values
ALTER TABLE "OrganizerProfile" ALTER COLUMN "slug" SET NOT NULL;

-- Step 5: Add unique constraint
CREATE UNIQUE INDEX "OrganizerProfile_slug_key" ON "OrganizerProfile"("slug");
