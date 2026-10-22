/*
  Warnings:

  - The values [PURCHASE_ORDER] on the enum `ServiceSourceType` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCK');

-- AlterEnum
BEGIN;
CREATE TYPE "ServiceSourceType_new" AS ENUM ('EXTERNAL_PURCHASE', 'IC_TFS', 'EXTERNAL_TFS');
ALTER TABLE "service_execution" ALTER COLUMN "source_type" TYPE "ServiceSourceType_new" USING ("source_type"::text::"ServiceSourceType_new");
ALTER TYPE "ServiceSourceType" RENAME TO "ServiceSourceType_old";
ALTER TYPE "ServiceSourceType_new" RENAME TO "ServiceSourceType";
DROP TYPE "ServiceSourceType_old";
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "delivery" ADD COLUMN     "invoice_reminder_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_invoice_reminder_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_logistic_reminder_at" TIMESTAMPTZ(6),
ADD COLUMN     "logistic_reminder_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "inquiry" ADD COLUMN     "last_activity_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_reminder_at" TIMESTAMPTZ(6),
ADD COLUMN     "reminder_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status_changed_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN     "payment_proof_url" TEXT;

-- AlterTable
ALTER TABLE "project_execution" ADD COLUMN     "invoice_reminder_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_activity_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_invoice_reminder_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_reminder_at" TIMESTAMPTZ(6),
ADD COLUMN     "reminder_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status_changed_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "purchase_order" ADD COLUMN     "last_activity_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_reminder_at" TIMESTAMPTZ(6),
ADD COLUMN     "reminder_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status_changed_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "quotation" ADD COLUMN     "last_activity_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_reminder_at" TIMESTAMPTZ(6),
ADD COLUMN     "reminder_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status_changed_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "service_execution" ADD COLUMN     "invoice_reminder_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_activity_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_invoice_reminder_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_reminder_at" TIMESTAMPTZ(6),
ADD COLUMN     "reminder_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status_changed_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "quotation_service" (
    "id" BIGSERIAL NOT NULL,
    "quotation_id" BIGINT NOT NULL,
    "location" VARCHAR(200),
    "project_no" VARCHAR(100),
    "attention_title" VARCHAR(10),
    "attention" VARCHAR(200),
    "validity_days" INTEGER NOT NULL DEFAULT 30,
    "scope_of_work" TEXT,
    "payment_terms" TEXT,
    "engineer_qty_desc" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_service_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotation_service_quotation_id_key" ON "quotation_service"("quotation_id");

-- AddForeignKey
ALTER TABLE "quotation_service" ADD CONSTRAINT "quotation_service_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
