-- Migration: cleanup_po_legacy_fields
-- Tahap 4: Hapus kolom lama dari purchase_order setelah data sudah di-migrate ke tabel ekstensi

-- DropForeignKey
ALTER TABLE "purchase_order" DROP CONSTRAINT "purchase_order_vendor_id_fkey";

-- AlterTable: drop semua kolom lama yang sudah dipindahkan ke purchase_order_sparepart
ALTER TABLE "purchase_order"
DROP COLUMN "estimated_production_done",
DROP COLUMN "estimated_ready_to_ship",
DROP COLUMN "expected_to",
DROP COLUMN "internal_po_file",
DROP COLUMN "internal_po_uploaded_at",
DROP COLUMN "oc_file",
DROP COLUMN "oc_received_at",
DROP COLUMN "po_sent_to_vendor_at",
DROP COLUMN "ship_to_party_name",
DROP COLUMN "vendor_id",
DROP COLUMN "vendor_invoice_file",
DROP COLUMN "vendor_packing_list_file";
