-- AlterTable
ALTER TABLE "quotation_project" ADD COLUMN     "payment_conditions" TEXT;

-- AlterTable
ALTER TABLE "quotation_service" ADD COLUMN     "payment_conditions" TEXT;

-- AlterTable
ALTER TABLE "quotation_spare_part" ADD COLUMN     "payment_conditions" TEXT;
