/*
  Warnings:

  - The values [PROCESS] on the enum `EntityStatus` will be removed. If these variants are still used in the database, this will fail.

*/

-- CreateEnum DeliveryStatus (idempotent)
DO $$ BEGIN
  CREATE TYPE "DeliveryStatus" AS ENUM ('REVIEW_LOGISTIC', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'DELAYED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum EntityStatus: Create new type first, then migrate data, then swap
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EntityStatus_new') THEN
    CREATE TYPE "EntityStatus_new" AS ENUM (
      'OPEN', 'FOLLOW_UP', 'CLOSED', 'DRAFT', 'SENT', 'APPROVED', 'REJECTED',
      'WAITING', 'IN_PROGRESS', 'DONE', 'PENDING', 'SHIPPED', 'DELIVERED',
      'PAID', 'ACTIVE', 'COMPLETED', 'REVIEW', 'REALIZED', 'CLOSE_LOSS'
    );
  END IF;
END $$;

BEGIN;
ALTER TABLE "invoice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "project_execution" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "purchase_order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "quotation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "service_execution" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tfs" ALTER COLUMN "status" DROP DEFAULT;

-- Data migration: rename any PROCESS values to REVIEW (safe fallback) before type swap
UPDATE "purchase_order" SET "status" = 'REVIEW' WHERE "status"::text = 'PROCESS';
UPDATE "po_status_history" SET "old_status" = 'IN_PROGRESS' WHERE "old_status" = 'PROCESS';
UPDATE "po_status_history" SET "new_status" = 'IN_PROGRESS' WHERE "new_status" = 'PROCESS';

ALTER TABLE "quotation" ALTER COLUMN "status" TYPE "EntityStatus_new" USING ("status"::text::"EntityStatus_new");
ALTER TABLE "quotation_status_history" ALTER COLUMN "old_status" TYPE "EntityStatus_new" USING ("old_status"::text::"EntityStatus_new");
ALTER TABLE "quotation_status_history" ALTER COLUMN "new_status" TYPE "EntityStatus_new" USING ("new_status"::text::"EntityStatus_new");
ALTER TABLE "purchase_order" ALTER COLUMN "status" TYPE "EntityStatus_new" USING ("status"::text::"EntityStatus_new");
ALTER TABLE "service_execution" ALTER COLUMN "status" TYPE "EntityStatus_new" USING ("status"::text::"EntityStatus_new");
ALTER TABLE "tfs" ALTER COLUMN "status" TYPE "EntityStatus_new" USING ("status"::text::"EntityStatus_new");
ALTER TABLE "project_execution" ALTER COLUMN "status" TYPE "EntityStatus_new" USING ("status"::text::"EntityStatus_new");
ALTER TABLE "invoice" ALTER COLUMN "status" TYPE "EntityStatus_new" USING ("status"::text::"EntityStatus_new");

ALTER TYPE "EntityStatus" RENAME TO "EntityStatus_old";
ALTER TYPE "EntityStatus_new" RENAME TO "EntityStatus";
DROP TYPE "EntityStatus_old";

ALTER TABLE "invoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "project_execution" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "purchase_order" ALTER COLUMN "status" SET DEFAULT 'REVIEW';
ALTER TABLE "quotation" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "service_execution" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "tfs" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- CreateTable delivery (idempotent)
CREATE TABLE IF NOT EXISTS "delivery" (
    "id" BIGSERIAL NOT NULL,
    "delivery_number" VARCHAR(50) NOT NULL,
    "po_id" BIGINT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'REVIEW_LOGISTIC',
    "tracking_number" VARCHAR(100),
    "shipping_service" VARCHAR(100),
    "current_location" VARCHAR(200),
    "target_delivery_date" DATE,
    "actual_delivery_date" DATE,
    "delay_reason" TEXT,
    "logistic_note" TEXT,
    "reminder_email" VARCHAR(150),
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable delivery_item (idempotent)
CREATE TABLE IF NOT EXISTS "delivery_item" (
    "id" BIGSERIAL NOT NULL,
    "delivery_id" BIGINT NOT NULL,
    "po_detail_id" BIGINT NOT NULL,
    "qty_delivered" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable delivery_status_history (idempotent)
CREATE TABLE IF NOT EXISTS "delivery_status_history" (
    "id" BIGSERIAL NOT NULL,
    "delivery_id" BIGINT NOT NULL,
    "old_status" "DeliveryStatus",
    "new_status" "DeliveryStatus" NOT NULL,
    "location" VARCHAR(200),
    "note" TEXT,
    "delay_reason" TEXT,
    "changed_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_delivery_number_key" ON "delivery"("delivery_number");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "delivery" ADD CONSTRAINT "delivery_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "delivery" ADD CONSTRAINT "delivery_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_item" ADD CONSTRAINT "delivery_item_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_item" ADD CONSTRAINT "delivery_item_po_detail_id_fkey" FOREIGN KEY ("po_detail_id") REFERENCES "purchase_order_detail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_status_history" ADD CONSTRAINT "delivery_status_history_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_status_history" ADD CONSTRAINT "delivery_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
