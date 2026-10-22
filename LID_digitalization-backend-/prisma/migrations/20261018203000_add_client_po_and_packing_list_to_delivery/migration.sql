-- AlterTable
ALTER TABLE "delivery"
ADD COLUMN IF NOT EXISTS "client_po_number" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "packing_list" TEXT;
