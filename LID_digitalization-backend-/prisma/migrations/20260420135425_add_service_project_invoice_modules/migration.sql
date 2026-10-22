-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('EXTERNAL_PURCHASE', 'EXTERNAL_TFS', 'IC_TFS');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('NEW_PLANT', 'UPGRADE', 'OM');

-- CreateEnum
CREATE TYPE "TfsType" AS ENUM ('EXTERNAL', 'IC');

-- CreateEnum
CREATE TYPE "InvoiceSourceType" AS ENUM ('SERVICE', 'PROJECT');

-- CreateEnum
CREATE TYPE "ServiceSourceType" AS ENUM ('PURCHASE_ORDER', 'IC_TFS');

-- AlterTable
ALTER TABLE "inquiry" ADD COLUMN     "project_type" "ProjectType",
ADD COLUMN     "service_category" "ServiceCategory",
ALTER COLUMN "request_type" SET DATA TYPE VARCHAR(40);

-- CreateTable
CREATE TABLE "service_execution" (
    "id" BIGSERIAL NOT NULL,
    "service_number" VARCHAR(50) NOT NULL,
    "source_type" "ServiceSourceType" NOT NULL,
    "po_id" BIGINT,
    "tfs_id" BIGINT,
    "status" "EntityStatus" NOT NULL DEFAULT 'PENDING',
    "progress_note" TEXT,
    "start_date" DATE,
    "target_date" DATE,
    "completed_date" DATE,
    "engineer_name" VARCHAR(150),
    "remarks" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tfs" (
    "id" BIGSERIAL NOT NULL,
    "tfs_number" VARCHAR(50) NOT NULL,
    "tfs_type" "TfsType" NOT NULL,
    "service_id" BIGINT,
    "po_number" VARCHAR(50),
    "customer_name" VARCHAR(200) NOT NULL,
    "plant_location" VARCHAR(200),
    "description" TEXT,
    "engineer_name" VARCHAR(150),
    "scheduled_date" DATE,
    "completed_date" DATE,
    "status" "EntityStatus" NOT NULL DEFAULT 'PENDING',
    "stock_checked" BOOLEAN NOT NULL DEFAULT false,
    "stock_check_note" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tfs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_execution" (
    "id" BIGSERIAL NOT NULL,
    "project_number" VARCHAR(50) NOT NULL,
    "project_type" "ProjectType" NOT NULL,
    "po_id" BIGINT NOT NULL,
    "project_name" VARCHAR(200) NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "start_date" DATE,
    "target_date" DATE,
    "completed_date" DATE,
    "progress_note" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" BIGSERIAL NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "source_type" "InvoiceSourceType" NOT NULL,
    "service_id" BIGINT,
    "project_id" BIGINT,
    "tfs_id" BIGINT,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'IDR',
    "due_date" DATE,
    "status" "EntityStatus" NOT NULL DEFAULT 'DRAFT',
    "payment_date" DATE,
    "payment_note" TEXT,
    "remarks" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_execution_service_number_key" ON "service_execution"("service_number");

-- CreateIndex
CREATE UNIQUE INDEX "tfs_tfs_number_key" ON "tfs"("tfs_number");

-- CreateIndex
CREATE UNIQUE INDEX "project_execution_project_number_key" ON "project_execution"("project_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_invoice_number_key" ON "invoice"("invoice_number");

-- AddForeignKey
ALTER TABLE "service_execution" ADD CONSTRAINT "service_execution_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_execution" ADD CONSTRAINT "service_execution_tfs_id_fkey" FOREIGN KEY ("tfs_id") REFERENCES "tfs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_execution" ADD CONSTRAINT "project_execution_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service_execution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project_execution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_tfs_id_fkey" FOREIGN KEY ("tfs_id") REFERENCES "tfs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
