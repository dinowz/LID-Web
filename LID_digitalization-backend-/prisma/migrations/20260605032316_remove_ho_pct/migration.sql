/*
  Warnings:

  - You are about to drop the `master_forwarder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `purchase_order_sparepart` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `quotation_sparepart` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "EntityStatus" ADD VALUE 'EXECUTED';

-- DropForeignKey
ALTER TABLE "master_forwarder" DROP CONSTRAINT "master_forwarder_created_by_fkey";

-- DropForeignKey
ALTER TABLE "master_forwarder" DROP CONSTRAINT "master_forwarder_updated_by_fkey";

-- DropForeignKey
ALTER TABLE "purchase_order_sparepart" DROP CONSTRAINT "purchase_order_sparepart_po_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_order_sparepart" DROP CONSTRAINT "purchase_order_sparepart_vendor_id_fkey";

-- DropForeignKey
ALTER TABLE "quotation_sparepart" DROP CONSTRAINT "quotation_sparepart_end_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "quotation_sparepart" DROP CONSTRAINT "quotation_sparepart_quotation_id_fkey";

-- AlterTable
ALTER TABLE "delivery" ADD COLUMN     "delivery_method" VARCHAR(50),
ADD COLUMN     "gi_number" TEXT,
ADD COLUMN     "shipping_address" TEXT;

-- AlterTable
ALTER TABLE "quotation" ADD COLUMN     "client_inquiry_date" DATE,
ADD COLUMN     "customer_po_file" TEXT,
ADD COLUMN     "global_discount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quotation_detail" ADD COLUMN     "canon_pct" DECIMAL(8,4) NOT NULL DEFAULT 0,
ADD COLUMN     "commission_pct" DECIMAL(8,4) NOT NULL DEFAULT 0,
ADD COLUMN     "custom_pct" DECIMAL(8,4) NOT NULL DEFAULT 0,
ADD COLUMN     "freight_pct" DECIMAL(8,4) NOT NULL DEFAULT 0,
ADD COLUMN     "handling_pct" DECIMAL(8,4) NOT NULL DEFAULT 10,
ADD COLUMN     "margin" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "overhead_pct" DECIMAL(8,4) NOT NULL DEFAULT 0,
ADD COLUMN     "sell_price_calc" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vendor_source" VARCHAR(10) DEFAULT 'LOG';

-- DropTable
DROP TABLE "master_forwarder";

-- DropTable
DROP TABLE "purchase_order_sparepart";

-- DropTable
DROP TABLE "quotation_sparepart";

-- CreateTable
CREATE TABLE "quotation_spare_part" (
    "id" BIGSERIAL NOT NULL,
    "quotation_id" BIGINT NOT NULL,
    "end_customer_id" INTEGER,
    "location" VARCHAR(200),
    "project_no" VARCHAR(100),
    "validity_days" INTEGER NOT NULL DEFAULT 30,
    "attention_title" VARCHAR(10),
    "attention" VARCHAR(200),
    "delivery_date_desc" TEXT,
    "delivery_terms" VARCHAR(300),
    "delivery_terms_short" VARCHAR(100),
    "payment_terms" TEXT,
    "bank_details" TEXT,
    "vendor_source" VARCHAR(10) DEFAULT 'LOG',
    "handling_pct" DECIMAL(8,4) NOT NULL DEFAULT 10,
    "canon_pct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "commission_pct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "overhead_pct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "freight_pct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "custom_pct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "sell_price_calc" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_spare_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forwarder" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "supplier_number" VARCHAR(100),
    "country" VARCHAR(100),
    "email" VARCHAR(150),
    "phone" VARCHAR(50),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forwarder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_spare_part" (
    "id" BIGSERIAL NOT NULL,
    "po_id" BIGINT NOT NULL,
    "vendor_id" INTEGER,
    "ship_to_party_name" VARCHAR(200),
    "expected_to" DATE,
    "internal_po_uploaded_at" TIMESTAMPTZ(6),
    "po_sent_to_vendor_at" TIMESTAMPTZ(6),
    "oc_received_at" TIMESTAMPTZ(6),
    "estimated_production_done" DATE,
    "estimated_ready_to_ship" DATE,
    "internal_po_file" TEXT,
    "oc_file" TEXT,
    "vendor_invoice_file" TEXT,
    "vendor_packing_list_file" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_spare_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_target" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "inquiry" INTEGER NOT NULL DEFAULT 0,
    "quotation" INTEGER NOT NULL DEFAULT 0,
    "po" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_target_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotation_spare_part_quotation_id_key" ON "quotation_spare_part"("quotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_spare_part_po_id_key" ON "purchase_order_spare_part"("po_id");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_target_year_key" ON "pipeline_target"("year");

-- AddForeignKey
ALTER TABLE "quotation_spare_part" ADD CONSTRAINT "quotation_spare_part_end_customer_id_fkey" FOREIGN KEY ("end_customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_spare_part" ADD CONSTRAINT "quotation_spare_part_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwarder" ADD CONSTRAINT "forwarder_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwarder" ADD CONSTRAINT "forwarder_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_spare_part" ADD CONSTRAINT "purchase_order_spare_part_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_spare_part" ADD CONSTRAINT "purchase_order_spare_part_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
