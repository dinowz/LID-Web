-- Migration: add_vendor_fields_to_service_po
-- Tahap 1: Tambah field vendor & OC ke purchase_order_service

-- AlterTable
ALTER TABLE "purchase_order_service" ADD COLUMN     "internal_po_file" TEXT,
ADD COLUMN     "internal_po_uploaded_at" TIMESTAMPTZ,
ADD COLUMN     "oc_file" TEXT,
ADD COLUMN     "oc_received_at" TIMESTAMPTZ,
ADD COLUMN     "po_sent_to_vendor_at" TIMESTAMPTZ,
ADD COLUMN     "vendor_id" INTEGER,
ADD COLUMN     "vendor_invoice_file" TEXT;

-- AddForeignKey
ALTER TABLE "purchase_order_service" ADD CONSTRAINT "purchase_order_service_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
