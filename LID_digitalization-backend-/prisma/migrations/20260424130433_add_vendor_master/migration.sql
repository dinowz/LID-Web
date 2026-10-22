/*
  Warnings:

  - A unique constraint covering the columns `[tfs_id]` on the table `purchase_order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "ServiceSourceType" ADD VALUE 'EXTERNAL_TFS';

-- DropForeignKey
ALTER TABLE "purchase_order" DROP CONSTRAINT "purchase_order_quotation_id_fkey";

-- AlterTable
ALTER TABLE "purchase_order" ADD COLUMN     "tfs_id" BIGINT,
ALTER COLUMN "quotation_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "service_execution" ADD COLUMN     "pic_name" VARCHAR(150);

-- AlterTable
ALTER TABLE "tfs" ADD COLUMN     "days" INTEGER,
ADD COLUMN     "divisions" JSONB,
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "inquiry_id" BIGINT,
ADD COLUMN     "manhour" DECIMAL(10,2),
ADD COLUMN     "pic_name" VARCHAR(150),
ADD COLUMN     "quantity_worker" INTEGER,
ADD COLUMN     "reason_for_change" TEXT,
ADD COLUMN     "service_order" VARCHAR(100),
ADD COLUMN     "start_date" DATE,
ADD COLUMN     "title" VARCHAR(300);

-- CreateTable
CREATE TABLE "master_division" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "manhour" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rate_per_hour" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_division_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_division_code_key" ON "master_division"("code");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_tfs_id_key" ON "purchase_order"("tfs_id");

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_tfs_id_fkey" FOREIGN KEY ("tfs_id") REFERENCES "tfs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tfs" ADD CONSTRAINT "tfs_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
