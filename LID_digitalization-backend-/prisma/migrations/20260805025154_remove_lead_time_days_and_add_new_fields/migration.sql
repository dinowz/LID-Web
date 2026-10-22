/*
  Warnings:

  - You are about to drop the column `lead_time_days` on the `quotation` table. All the data in the column will be lost.
  - You are about to drop the column `lead_time_days` on the `quotation_detail` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "quotation" DROP COLUMN "lead_time_days";

-- AlterTable
ALTER TABLE "quotation_detail" DROP COLUMN "lead_time_days";

-- AlterTable
ALTER TABLE "quotation_service" ADD COLUMN     "payment_method" TEXT,
ADD COLUMN     "pricing_condition_text" TEXT,
ADD COLUMN     "pricing_type" VARCHAR(50) DEFAULT 'standard',
ADD COLUMN     "tc_items" JSONB,
ADD COLUMN     "tc_type" VARCHAR(50) DEFAULT 'standard';
