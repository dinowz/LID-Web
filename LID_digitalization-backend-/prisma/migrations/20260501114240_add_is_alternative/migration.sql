-- AlterTable
ALTER TABLE "purchase_order_project" ADD COLUMN     "engineer_name" TEXT,
ADD COLUMN     "internal_po_uploaded_at" TIMESTAMPTZ,
ADD COLUMN     "oc_file" TEXT,
ADD COLUMN     "oc_received_at" TIMESTAMPTZ,
ADD COLUMN     "pic_name" TEXT,
ADD COLUMN     "po_sent_to_vendor_at" TIMESTAMPTZ,
ADD COLUMN     "service_end_date" DATE,
ADD COLUMN     "service_start_date" DATE,
ADD COLUMN     "vendor_id" INTEGER;

-- AlterTable
ALTER TABLE "quotation" ADD COLUMN     "quotation_type" "WorkflowType";

-- AlterTable
ALTER TABLE "quotation_detail" ADD COLUMN     "is_alternative" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "quotation_sparepart" (
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
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_sparepart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotation_sparepart_quotation_id_key" ON "quotation_sparepart"("quotation_id");

-- AddForeignKey
ALTER TABLE "quotation_sparepart" ADD CONSTRAINT "quotation_sparepart_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_sparepart" ADD CONSTRAINT "quotation_sparepart_end_customer_id_fkey" FOREIGN KEY ("end_customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_project" ADD CONSTRAINT "purchase_order_project_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
