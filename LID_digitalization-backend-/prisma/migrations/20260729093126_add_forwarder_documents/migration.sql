-- AlterTable
ALTER TABLE "delivery" ADD COLUMN     "forwarder_po_file" TEXT,
ADD COLUMN     "forwarder_quotation_file" TEXT,
ADD COLUMN     "other_forwarder_quotation_files" JSONB;
