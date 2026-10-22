-- AlterTable: Remove redundant serviceCategory and projectType columns from inquiry table
-- These columns are redundant because requestType already encodes this information
-- (e.g. SERVICE_EXTERNAL_TFS, PROJECT_OM)
ALTER TABLE "inquiry" DROP COLUMN IF EXISTS "project_type",
DROP COLUMN IF EXISTS "service_category";

-- DropEnum: ServiceCategory is no longer referenced by any model
DROP TYPE IF EXISTS "ServiceCategory";
