-- AlterTable
ALTER TABLE "purchase_order_spare_part" ADD COLUMN     "bast_file" TEXT,
ADD COLUMN     "qc_check_file" TEXT,
ALTER COLUMN "vendor_quotation_file" SET DATA TYPE TEXT;
