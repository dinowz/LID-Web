-- AlterTable
ALTER TABLE "pipeline_target" ADD COLUMN "target_sparepart" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN "target_service" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN "target_project" DECIMAL(20,2) NOT NULL DEFAULT 0;
