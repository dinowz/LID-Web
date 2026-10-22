-- AlterTable
ALTER TABLE "master_spare_part" ADD COLUMN     "estimated_price" DECIMAL(18,2);

-- CreateTable
CREATE TABLE "purchase_order_project" (
    "id" BIGSERIAL NOT NULL,
    "po_id" BIGINT NOT NULL,
    "internal_po_file" TEXT,
    "vendor_invoice_file" TEXT,
    "ba_file" TEXT,
    "project_report_file" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_project_po_id_key" ON "purchase_order_project"("po_id");

-- AddForeignKey
ALTER TABLE "purchase_order_project" ADD CONSTRAINT "purchase_order_project_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
