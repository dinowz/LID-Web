-- AlterEnum
ALTER TYPE "EntityStatus" ADD VALUE 'MANUFACTURING';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "delivery" ADD COLUMN     "proof_of_delivery" TEXT,
ADD COLUMN     "updated_by" INTEGER;

-- AlterTable
ALTER TABLE "project_execution" ADD COLUMN     "updated_by" INTEGER;

-- AlterTable
ALTER TABLE "purchase_order" ADD COLUMN     "customer_po_file" TEXT,
ADD COLUMN     "updated_by" INTEGER;

-- AlterTable
ALTER TABLE "quotation" ADD COLUMN     "updated_by" INTEGER;

-- AlterTable
ALTER TABLE "service_execution" ADD COLUMN     "timesheet_file" TEXT,
ADD COLUMN     "updated_by" INTEGER;

-- CreateTable
CREATE TABLE "quotation_project" (
    "id" BIGSERIAL NOT NULL,
    "quotation_id" BIGINT NOT NULL,
    "location" VARCHAR(200),
    "project_no" VARCHAR(100),
    "project_title" VARCHAR(300),
    "project_site_name" VARCHAR(200),
    "project_site_address" TEXT,
    "project_duration" VARCHAR(200),
    "attention_title" VARCHAR(10),
    "attention" VARCHAR(200),
    "validity_days" INTEGER NOT NULL DEFAULT 30,
    "payment_terms" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_forwarder" (
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

    CONSTRAINT "master_forwarder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotation_project_quotation_id_key" ON "quotation_project"("quotation_id");

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_project" ADD CONSTRAINT "quotation_project_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_forwarder" ADD CONSTRAINT "master_forwarder_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_forwarder" ADD CONSTRAINT "master_forwarder_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_execution" ADD CONSTRAINT "service_execution_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_execution" ADD CONSTRAINT "service_execution_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_execution" ADD CONSTRAINT "project_execution_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_execution" ADD CONSTRAINT "project_execution_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
