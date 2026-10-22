-- AlterTable
ALTER TABLE "quotation_spare_part"
ADD COLUMN IF NOT EXISTS "has_dp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "dp_percent" DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "dp_amount" DECIMAL(18, 2) DEFAULT 0;

-- AlterTable
ALTER TABLE "purchase_order"
ADD COLUMN IF NOT EXISTS "has_dp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "dp_percent" DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "dp_amount" DECIMAL(18, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "dp_invoiced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "dp_invoice_id" BIGINT;

-- AlterTable
ALTER TABLE "invoice"
ADD COLUMN IF NOT EXISTS "is_dp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "dp_percent" DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS "dp_deduction" DECIMAL(18, 2) DEFAULT 0;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_dp_invoice_id_fkey'
  ) THEN
    ALTER TABLE "purchase_order"
    ADD CONSTRAINT "purchase_order_dp_invoice_id_fkey"
    FOREIGN KEY ("dp_invoice_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
