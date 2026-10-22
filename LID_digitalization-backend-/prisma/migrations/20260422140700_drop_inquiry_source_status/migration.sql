-- Migration: drop inquiry_source and inquiry_status tables
-- Replace foreign-key status/source with plain string columns

-- 1. Add new string columns to inquiry (nullable first, then set default, then constrain)
ALTER TABLE "inquiry" ADD COLUMN "status_code" VARCHAR(30);
ALTER TABLE "inquiry" ADD COLUMN "source_code" VARCHAR(30);

-- 2. Populate status_code from the related inquiry_status table
UPDATE "inquiry" i
SET "status_code" = (SELECT "status_code" FROM "inquiry_status" WHERE "id" = i."status_id")
WHERE i."status_id" IS NOT NULL;

-- 3. Populate source_code from the related inquiry_source table
UPDATE "inquiry" i
SET "source_code" = (SELECT "source_code" FROM "inquiry_source" WHERE "id" = i."source_id")
WHERE i."source_id" IS NOT NULL;

-- 4. Set default for any remaining NULLs in status_code
UPDATE "inquiry" SET "status_code" = 'OPEN' WHERE "status_code" IS NULL;

-- 5. Make status_code NOT NULL with a default
ALTER TABLE "inquiry" ALTER COLUMN "status_code" SET NOT NULL;
ALTER TABLE "inquiry" ALTER COLUMN "status_code" SET DEFAULT 'OPEN';

-- 6. Add new string columns to inquiry_status_history (nullable first)
ALTER TABLE "inquiry_status_history" ADD COLUMN "new_status_code" VARCHAR(30);
ALTER TABLE "inquiry_status_history" ADD COLUMN "old_status_code" VARCHAR(30);

-- 7. Populate from existing inquiry_status rows
UPDATE "inquiry_status_history" h
SET "new_status_code" = (SELECT "status_code" FROM "inquiry_status" WHERE "id" = h."new_status_id")
WHERE h."new_status_id" IS NOT NULL;

UPDATE "inquiry_status_history" h
SET "old_status_code" = (SELECT "status_code" FROM "inquiry_status" WHERE "id" = h."old_status_id")
WHERE h."old_status_id" IS NOT NULL;

-- 8. Fallback for any NULLs in new_status_code
UPDATE "inquiry_status_history" SET "new_status_code" = 'OPEN' WHERE "new_status_code" IS NULL;

-- 9. Make new_status_code NOT NULL
ALTER TABLE "inquiry_status_history" ALTER COLUMN "new_status_code" SET NOT NULL;

-- 10. Drop old foreign-key columns from inquiry
ALTER TABLE "inquiry" DROP COLUMN "status_id";
ALTER TABLE "inquiry" DROP COLUMN "source_id";

-- 11. Drop old foreign-key columns from inquiry_status_history
ALTER TABLE "inquiry_status_history" DROP COLUMN "new_status_id";
ALTER TABLE "inquiry_status_history" DROP COLUMN "old_status_id";

-- 12. Drop the inquiry_source and inquiry_status tables
DROP TABLE IF EXISTS "inquiry_source";
DROP TABLE IF EXISTS "inquiry_status";
