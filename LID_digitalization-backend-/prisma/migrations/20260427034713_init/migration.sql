/*
  Warnings:

  - You are about to drop the column `assigned_to` on the `inquiry` table. All the data in the column will be lost.
  - You are about to drop the column `attachment_url` on the `inquiry` table. All the data in the column will be lost.
  - You are about to drop the column `internal_note` on the `inquiry` table. All the data in the column will be lost.
  - You are about to drop the column `clarification_note` on the `inquiry_detail` table. All the data in the column will be lost.
  - You are about to drop the column `mapped_service_id` on the `inquiry_detail` table. All the data in the column will be lost.
  - You are about to drop the column `mapped_spare_part_id` on the `inquiry_detail` table. All the data in the column will be lost.
  - You are about to drop the column `stock_available` on the `inquiry_detail` table. All the data in the column will be lost.
  - You are about to drop the column `stock_qty` on the `inquiry_detail` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityStatus" ADD VALUE 'OVERDUE';
ALTER TYPE "EntityStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "InvoiceSourceType" ADD VALUE 'DELIVERY';

-- DropForeignKey
ALTER TABLE "inquiry" DROP CONSTRAINT "inquiry_assigned_to_fkey";

-- DropForeignKey
ALTER TABLE "inquiry_detail" DROP CONSTRAINT "inquiry_detail_mapped_service_id_fkey";

-- DropForeignKey
ALTER TABLE "inquiry_detail" DROP CONSTRAINT "inquiry_detail_mapped_spare_part_id_fkey";

-- AlterTable
ALTER TABLE "inquiry" DROP COLUMN "assigned_to",
DROP COLUMN "attachment_url",
DROP COLUMN "internal_note";

-- AlterTable
ALTER TABLE "inquiry_detail" DROP COLUMN "clarification_note",
DROP COLUMN "mapped_service_id",
DROP COLUMN "mapped_spare_part_id",
DROP COLUMN "stock_available",
DROP COLUMN "stock_qty";

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN     "attachment_url" TEXT,
ADD COLUMN     "customer_id" INTEGER,
ADD COLUMN     "delivery_id" BIGINT,
ADD COLUMN     "exchange_rate" DECIMAL(18,2) NOT NULL DEFAULT 1,
ADD COLUMN     "invoice_date" DATE,
ADD COLUMN     "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "po_id" BIGINT,
ADD COLUMN     "quotation_id" BIGINT,
ADD COLUMN     "remaining_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by" INTEGER,
ALTER COLUMN "invoice_number" DROP NOT NULL;

-- AlterTable
ALTER TABLE "service_execution" ADD COLUMN     "progress_percentage" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "service_execution_history" (
    "id" BIGSERIAL NOT NULL,
    "service_id" BIGINT NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT NOT NULL,
    "old_progress" INTEGER,
    "new_progress" INTEGER NOT NULL,
    "progress_note" TEXT,
    "changed_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_execution_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_detail" (
    "id" BIGSERIAL NOT NULL,
    "invoice_id" BIGINT NOT NULL,
    "delivery_detail_id" BIGINT,
    "description" VARCHAR(300) NOT NULL,
    "qty" DECIMAL(18,2) NOT NULL DEFAULT 1,
    "uom" VARCHAR(20),
    "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_status_history" (
    "id" BIGSERIAL NOT NULL,
    "invoice_id" BIGINT NOT NULL,
    "old_status" "EntityStatus",
    "new_status" "EntityStatus" NOT NULL,
    "change_note" TEXT,
    "changed_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_status_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "service_execution_history" ADD CONSTRAINT "service_execution_history_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service_execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_execution_history" ADD CONSTRAINT "service_execution_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "delivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_detail" ADD CONSTRAINT "invoice_detail_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_status_history" ADD CONSTRAINT "invoice_status_history_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_status_history" ADD CONSTRAINT "invoice_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
