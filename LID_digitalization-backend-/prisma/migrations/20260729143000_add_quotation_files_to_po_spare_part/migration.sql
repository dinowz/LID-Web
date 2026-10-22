-- AlterTable
ALTER TABLE "purchase_order_spare_part" ADD COLUMN "vendor_quotation_file" VARCHAR(255),
                                      ADD COLUMN "other_quotation_files" JSONB;
