-- Migration: refactor_po_add_type_and_extensions
-- Tahap 1: Tambah kolom po_type dan buat tabel ekstensi PO (NON-DESTRUCTIVE)
-- Field lama di purchase_order TIDAK dihapus di tahap ini

-- AlterTable: tambah kolom po_type (nullable)
ALTER TABLE "purchase_order" ADD COLUMN "po_type" "WorkflowType";

-- CreateTable: purchase_order_sparepart
CREATE TABLE "purchase_order_sparepart" (
    "id" BIGSERIAL NOT NULL,
    "po_id" BIGINT NOT NULL,
    "vendor_id" INTEGER,
    "ship_to_party_name" VARCHAR(200),
    "expected_to" DATE,
    "internal_po_uploaded_at" TIMESTAMPTZ,
    "po_sent_to_vendor_at" TIMESTAMPTZ,
    "oc_received_at" TIMESTAMPTZ,
    "estimated_production_done" DATE,
    "estimated_ready_to_ship" DATE,
    "internal_po_file" TEXT,
    "oc_file" TEXT,
    "vendor_invoice_file" TEXT,
    "vendor_packing_list_file" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_sparepart_pkey" PRIMARY KEY ("id")
);

-- CreateTable: purchase_order_service
CREATE TABLE "purchase_order_service" (
    "id" BIGSERIAL NOT NULL,
    "po_id" BIGINT NOT NULL,
    "service_start_date" DATE,
    "service_end_date" DATE,
    "pic_name" VARCHAR(150),
    "engineer_name" VARCHAR(150),
    "service_report_file" TEXT,
    "ba_file" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_service_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint one-to-one
CREATE UNIQUE INDEX "purchase_order_sparepart_po_id_key" ON "purchase_order_sparepart"("po_id");
CREATE UNIQUE INDEX "purchase_order_service_po_id_key" ON "purchase_order_service"("po_id");

-- AddForeignKey: purchase_order_sparepart -> purchase_order
ALTER TABLE "purchase_order_sparepart" ADD CONSTRAINT "purchase_order_sparepart_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: purchase_order_sparepart -> Vendor
ALTER TABLE "purchase_order_sparepart" ADD CONSTRAINT "purchase_order_sparepart_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: purchase_order_service -> purchase_order
ALTER TABLE "purchase_order_service" ADD CONSTRAINT "purchase_order_service_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
