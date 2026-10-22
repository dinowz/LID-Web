-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "EntityStatus" ADD VALUE 'WAITING_OC';
ALTER TYPE "EntityStatus" ADD VALUE 'READY';

-- AlterTable
ALTER TABLE "purchase_order" ADD COLUMN     "estimated_production_done" DATE,
ADD COLUMN     "estimated_ready_to_ship" DATE,
ADD COLUMN     "internal_po_file" TEXT,
ADD COLUMN     "internal_po_uploaded_at" TIMESTAMPTZ,
ADD COLUMN     "oc_file" TEXT,
ADD COLUMN     "oc_received_at" TIMESTAMPTZ,
ADD COLUMN     "po_sent_to_vendor_at" TIMESTAMPTZ,
ADD COLUMN     "vendor_id" INTEGER,
ADD COLUMN     "vendor_invoice_file" TEXT,
ADD COLUMN     "vendor_packing_list_file" TEXT;

-- CreateTable
CREATE TABLE "Vendor" (
    "id" SERIAL NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "country" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendorCode_key" ON "Vendor"("vendorCode");

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
