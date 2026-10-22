/*
  Warnings:

  - You are about to drop the column `tfs_id` on the `invoice` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `master_division` table. All the data in the column will be lost.
  - You are about to drop the column `manhour` on the `master_division` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `master_division` table. All the data in the column will be lost.
  - You are about to drop the column `rate_per_hour` on the `master_division` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `master_division` table. All the data in the column will be lost.
  - You are about to drop the column `tfs_id` on the `purchase_order` table. All the data in the column will be lost.
  - You are about to drop the column `tfs_id` on the `service_execution` table. All the data in the column will be lost.
  - You are about to drop the column `completed_date` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `customer_name` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `divisions` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `engineer_name` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `inquiry_id` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `manhour` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `pic_name` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `plant_location` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `po_number` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `quantity_worker` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `reason_for_change` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `scheduled_date` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `service_id` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `service_order` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `stock_check_note` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `stock_checked` on the `tfs` table. All the data in the column will be lost.
  - You are about to drop the column `tfs_type` on the `tfs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[personnel_code]` on the table `master_division` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `personnel_code` to the `master_division` table without a default value. This is not possible if the table is not empty.
  - Added the required column `personnel_id` to the `tfs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `service_execution_id` to the `tfs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityStatus" ADD VALUE 'ASSIGNED';
ALTER TYPE "EntityStatus" ADD VALUE 'READY_FOR_EXECUTION';

-- DropForeignKey
ALTER TABLE "invoice" DROP CONSTRAINT "invoice_tfs_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_order" DROP CONSTRAINT "purchase_order_tfs_id_fkey";

-- DropForeignKey
ALTER TABLE "service_execution" DROP CONSTRAINT "service_execution_tfs_id_fkey";

-- DropForeignKey
ALTER TABLE "tfs" DROP CONSTRAINT "tfs_inquiry_id_fkey";

-- DropIndex
DROP INDEX "master_division_code_key";

-- DropIndex
DROP INDEX "purchase_order_tfs_id_key";

-- AlterTable
ALTER TABLE "invoice" DROP COLUMN "tfs_id";

-- AlterTable
ALTER TABLE "master_division" DROP COLUMN "code",
DROP COLUMN "manhour",
DROP COLUMN "quantity",
DROP COLUMN "rate_per_hour",
DROP COLUMN "status",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "division" VARCHAR(100),
ADD COLUMN     "email" VARCHAR(100),
ADD COLUMN     "personnel_code" VARCHAR(50) NOT NULL,
ADD COLUMN     "phone" VARCHAR(50),
ADD COLUMN     "title" VARCHAR(100);

-- AlterTable
ALTER TABLE "purchase_order" DROP COLUMN "tfs_id";

-- AlterTable
ALTER TABLE "service_execution" DROP COLUMN "tfs_id",
ADD COLUMN     "inquiry_id" BIGINT,
ADD COLUMN     "issue" TEXT,
ADD COLUMN     "next_action" TEXT,
ADD COLUMN     "quotation_id" BIGINT;

-- AlterTable
ALTER TABLE "service_execution_history" ADD COLUMN     "issue" TEXT,
ADD COLUMN     "next_action" TEXT;

-- AlterTable
ALTER TABLE "tfs" DROP COLUMN "completed_date",
DROP COLUMN "created_by",
DROP COLUMN "customer_name",
DROP COLUMN "description",
DROP COLUMN "divisions",
DROP COLUMN "engineer_name",
DROP COLUMN "inquiry_id",
DROP COLUMN "manhour",
DROP COLUMN "pic_name",
DROP COLUMN "plant_location",
DROP COLUMN "po_number",
DROP COLUMN "quantity_worker",
DROP COLUMN "reason_for_change",
DROP COLUMN "scheduled_date",
DROP COLUMN "service_id",
DROP COLUMN "service_order",
DROP COLUMN "stock_check_note",
DROP COLUMN "stock_checked",
DROP COLUMN "tfs_type",
ADD COLUMN     "job_description" TEXT,
ADD COLUMN     "personnel_id" BIGINT NOT NULL,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "service_execution_id" BIGINT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- CreateIndex
CREATE UNIQUE INDEX "master_division_personnel_code_key" ON "master_division"("personnel_code");

-- AddForeignKey
ALTER TABLE "service_execution" ADD CONSTRAINT "service_execution_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_execution" ADD CONSTRAINT "service_execution_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tfs" ADD CONSTRAINT "tfs_service_execution_id_fkey" FOREIGN KEY ("service_execution_id") REFERENCES "service_execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tfs" ADD CONSTRAINT "tfs_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "master_division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
